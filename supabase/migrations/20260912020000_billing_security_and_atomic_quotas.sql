-- P0/P1 billing and resource-integrity primitives.
-- Technical rollback: restore previous function definitions and drop the new
-- tables only after dependent Edge Functions are rolled back. This migration
-- does not restore rows removed by a later operator.
BEGIN;

-- Rate limits keep the existing table, but add a second dimension so a single
-- user cannot bypass the control merely by changing network origin. The user
-- bucket remains authoritative when no trusted proxy address is available.
ALTER TABLE public.ai_rate_limits
  ADD COLUMN IF NOT EXISTS scope_key text NOT NULL DEFAULT 'user';

-- Rate-limit rows are server-owned state. Do not rely on RLS policies for this
-- table: clients must not be able to reset or rewrite their own counters.
REVOKE ALL ON TABLE public.ai_rate_limits FROM PUBLIC, anon, authenticated;

ALTER TABLE public.ai_rate_limits
  DROP CONSTRAINT IF EXISTS ai_rate_limits_user_id_function_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS ai_rate_limits_user_function_scope_key
  ON public.ai_rate_limits(user_id, function_name, scope_key);

CREATE INDEX IF NOT EXISTS idx_ai_rate_limits_function_window
  ON public.ai_rate_limits(function_name, window_start);

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  _user_id uuid,
  _function_name text,
  _max_calls integer,
  _window_minutes integer,
  _client_key text DEFAULT NULL
)
RETURNS TABLE(
  allowed boolean,
  remaining integer,
  limit_value integer,
  retry_after_seconds integer,
  reset_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _scope text;
  _scopes text[] := ARRAY['user'];
  _now timestamptz := now();
  _window_start timestamptz;
  _current integer;
  _min_remaining integer;
  _reset_at timestamptz := _now + make_interval(mins => _window_minutes);
  _all_allowed boolean := true;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Rate limit RPC is internal' USING ERRCODE = '42501';
  END IF;

  IF _user_id IS NULL OR _function_name IS NULL OR
     _function_name !~ '^[a-z0-9][a-z0-9-]{0,63}$' OR
     _max_calls < 1 OR _max_calls > 1000 OR
     _window_minutes < 1 OR _window_minutes > 1440 OR
     (_client_key IS NOT NULL AND _client_key !~ '^[a-f0-9]{64}$') THEN
    RAISE EXCEPTION 'Invalid rate limit parameters' USING ERRCODE = '22023';
  END IF;

  _window_start := _now - make_interval(mins => _window_minutes);
  IF _client_key IS NOT NULL THEN
    _scopes := array_append(_scopes, 'ip:' || _client_key);
  END IF;

  -- Insert first, then lock every bucket in deterministic order. This closes
  -- the old read-then-insert race and lets the two dimensions be evaluated
  -- before either one is incremented.
  FOREACH _scope IN ARRAY _scopes LOOP
    INSERT INTO public.ai_rate_limits(user_id, function_name, scope_key, calls_count, window_start)
    VALUES (_user_id, _function_name, _scope, 0, _now)
    ON CONFLICT (user_id, function_name, scope_key) DO NOTHING;

    SELECT calls_count, window_start
      INTO _current, _reset_at
      FROM public.ai_rate_limits
     WHERE user_id = _user_id
       AND function_name = _function_name
       AND scope_key = _scope
     FOR UPDATE;

    IF _reset_at <= _window_start THEN
      UPDATE public.ai_rate_limits
         SET calls_count = 0, window_start = _now, updated_at = _now
       WHERE user_id = _user_id
         AND function_name = _function_name
         AND scope_key = _scope;
      _current := 0;
      _reset_at := _now;
    END IF;

    IF _current >= _max_calls THEN
      _all_allowed := false;
    END IF;
    _reset_at := (SELECT window_start + make_interval(mins => _window_minutes)
                    FROM public.ai_rate_limits
                   WHERE user_id = _user_id
                     AND function_name = _function_name
                     AND scope_key = _scope);
  END LOOP;

  IF _all_allowed THEN
    FOREACH _scope IN ARRAY _scopes LOOP
      UPDATE public.ai_rate_limits
         SET calls_count = calls_count + 1, updated_at = _now
       WHERE user_id = _user_id
         AND function_name = _function_name
         AND scope_key = _scope;
    END LOOP;
  END IF;

  SELECT COALESCE(MIN(GREATEST(_max_calls - calls_count - CASE WHEN _all_allowed THEN 1 ELSE 0 END, 0)), 0)
    INTO _min_remaining
    FROM public.ai_rate_limits
   WHERE user_id = _user_id
     AND function_name = _function_name
     AND scope_key = ANY(_scopes);

  -- Use the latest reset time across dimensions. A denial tells the caller
  -- when retrying can become meaningful without exposing internal rows.
  SELECT MAX(window_start + make_interval(mins => _window_minutes))
    INTO _reset_at
    FROM public.ai_rate_limits
   WHERE user_id = _user_id
     AND function_name = _function_name
     AND scope_key = ANY(_scopes);

  RETURN QUERY SELECT
    _all_allowed,
    _min_remaining,
    _max_calls,
    CASE WHEN _all_allowed THEN 0 ELSE GREATEST(1, CEIL(EXTRACT(EPOCH FROM (_reset_at - _now)))::integer) END,
    _reset_at;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(uuid, text, integer, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(uuid, text, integer, integer, text) TO service_role;

-- Keep the legacy boolean contract for untouched functions, but route it
-- through the atomic user bucket implementation.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _user_id uuid,
  _function_name text,
  _max_calls integer DEFAULT 10,
  _window_minutes integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _allowed boolean;
BEGIN
  SELECT r.allowed INTO _allowed
    FROM public.consume_rate_limit(_user_id, _function_name, _max_calls, _window_minutes, NULL) r;
  RETURN _allowed;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) TO service_role;

-- Stripe inbox: a signed event is claimed once, with a short lease so a
-- crashed worker can be reclaimed without allowing concurrent processing.
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'processed', 'failed')),
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts > 0),
  locked_until timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_webhook_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_stripe_webhook_event(
  _event_id text,
  _event_type text,
  _payload jsonb
)
RETURNS TABLE(claimed boolean, duplicate boolean, current_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.stripe_webhook_events;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Webhook inbox is internal' USING ERRCODE = '42501';
  END IF;
  IF _event_id IS NULL OR _event_id !~ '^evt_[A-Za-z0-9]+$' OR
     _event_type IS NULL OR length(_event_type) > 128 OR _payload IS NULL THEN
    RAISE EXCEPTION 'Invalid webhook event' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.stripe_webhook_events(event_id, event_type, payload)
  VALUES (_event_id, _event_type, _payload)
  ON CONFLICT (event_id) DO NOTHING;

  SELECT * INTO _row FROM public.stripe_webhook_events WHERE event_id = _event_id FOR UPDATE;
  IF _row.status = 'processed' THEN
    RETURN QUERY SELECT false, true, _row.status;
    RETURN;
  END IF;
  IF _row.status = 'processing' AND _row.locked_until > now() THEN
    RETURN QUERY SELECT false, true, _row.status;
    RETURN;
  END IF;

  UPDATE public.stripe_webhook_events
     SET status = 'processing', attempts = _row.attempts + 1,
         locked_until = now() + interval '5 minutes', updated_at = now(), last_error = NULL
   WHERE event_id = _event_id;
  RETURN QUERY SELECT true, false, 'processing'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_stripe_webhook_event(_event_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Webhook inbox is internal' USING ERRCODE = '42501';
  END IF;
  UPDATE public.stripe_webhook_events
     SET status = 'processed', processed_at = now(), locked_until = now(), updated_at = now()
   WHERE event_id = _event_id AND status = 'processing';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Webhook event was not claimed' USING ERRCODE = '55000';
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_stripe_webhook_event(_event_id text, _error_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Webhook inbox is internal' USING ERRCODE = '42501';
  END IF;
  UPDATE public.stripe_webhook_events
     SET status = 'failed', last_error = left(COALESCE(_error_code, 'PROCESSING_FAILED'), 120),
         locked_until = now(), updated_at = now()
   WHERE event_id = _event_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_stripe_webhook_event(text, text, jsonb), public.complete_stripe_webhook_event(text), public.fail_stripe_webhook_event(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stripe_webhook_event(text, text, jsonb), public.complete_stripe_webhook_event(text), public.fail_stripe_webhook_event(text, text) TO service_role;

CREATE TABLE IF NOT EXISTS public.subscription_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_event_id text UNIQUE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_subscription_id text,
  stripe_customer_id text,
  status text NOT NULL,
  plan_type public.plan_type,
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscription_history FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_subscription_history_user_created
  ON public.subscription_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_essays_user_created_at
  ON public.essays(user_id, created_at);

-- Essay corrections are created by the authenticated Edge Function only.
-- Keeping direct client writes open would let callers forge corrected rows or
-- bypass the quota reservation; service_role remains the server authority.
DROP POLICY IF EXISTS "Users can manage their own essays" ON public.essays;
CREATE POLICY "Users can view their own essays"
  ON public.essays FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.record_subscription_projection(
  _event_id text,
  _user_id uuid,
  _stripe_subscription_id text,
  _stripe_customer_id text,
  _status text,
  _plan_type public.plan_type,
  _start_date timestamptz,
  _end_date timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  projection_id uuid;
BEGIN
  IF auth.role() <> 'service_role' OR _event_id IS NULL OR _user_id IS NULL
     OR _stripe_subscription_id IS NULL OR _status IS NULL THEN
    RAISE EXCEPTION 'Invalid subscription projection' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.subscriptions(
    user_id, status, plan_type, stripe_subscription_id, stripe_customer_id,
    start_date, end_date, updated_at
  ) VALUES (
    _user_id, _status, _plan_type, _stripe_subscription_id, _stripe_customer_id,
    _start_date, _end_date, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    status = EXCLUDED.status,
    plan_type = EXCLUDED.plan_type,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    updated_at = now()
  RETURNING id INTO projection_id;

  INSERT INTO public.subscription_history(
    source_event_id, user_id, stripe_subscription_id, stripe_customer_id,
    status, plan_type, start_date, end_date
  ) VALUES (
    _event_id, _user_id, _stripe_subscription_id, _stripe_customer_id,
    _status, _plan_type, _start_date, _end_date
  )
  ON CONFLICT (source_event_id) DO NOTHING;
  RETURN projection_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_subscription_projection(text, uuid, text, text, text, public.plan_type, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_subscription_projection(text, uuid, text, text, text, public.plan_type, timestamptz, timestamptz)
  TO service_role;

-- One row per user/month. The conditional upsert is the quota gate: two
-- concurrent requests cannot both pass the same final slot.
CREATE TABLE IF NOT EXISTS public.essay_quota_counters (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quota_month date NOT NULL,
  used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, quota_month)
);

ALTER TABLE public.essay_quota_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.essay_quota_counters FROM PUBLIC, anon, authenticated;

-- Preserve usage already recorded in essays before the counter existed.
INSERT INTO public.essay_quota_counters(user_id, quota_month, used_count)
SELECT user_id, date_trunc('month', created_at)::date, COUNT(*)::integer
  FROM public.essays
 GROUP BY user_id, date_trunc('month', created_at)::date
ON CONFLICT (user_id, quota_month) DO UPDATE
  SET used_count = GREATEST(public.essay_quota_counters.used_count, EXCLUDED.used_count),
      updated_at = now();

CREATE OR REPLACE FUNCTION public.consume_essay_quota(_user_id uuid)
RETURNS TABLE(allowed boolean, used_count integer, quota_limit integer, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _month date := date_trunc('month', CURRENT_DATE)::date;
  _limit integer;
  _used integer;
BEGIN
  IF auth.role() <> 'service_role' OR _user_id IS NULL THEN
    RAISE EXCEPTION 'Essay quota RPC is internal' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE((
    SELECT CASE
      WHEN s.status = 'authorized' AND (s.end_date IS NULL OR s.end_date > now()) THEN
        CASE s.plan_type::text
          WHEN 'annual' THEN 12
          WHEN 'monthly' THEN 4
          WHEN 'god' THEN 12
          WHEN 'creator' THEN 12
          ELSE 1
        END
      ELSE 1
    END
    FROM public.subscriptions s
    WHERE s.user_id = _user_id
    ORDER BY s.updated_at DESC
    LIMIT 1
  ), 1) INTO _limit;

  INSERT INTO public.essay_quota_counters(user_id, quota_month, used_count)
  VALUES (_user_id, _month, 1)
  ON CONFLICT (user_id, quota_month) DO UPDATE
    SET used_count = public.essay_quota_counters.used_count + 1,
        updated_at = now()
    WHERE public.essay_quota_counters.used_count < _limit
  RETURNING essay_quota_counters.used_count INTO _used;

  IF NOT FOUND THEN
    SELECT e.used_count INTO _used
      FROM public.essay_quota_counters e
     WHERE e.user_id = _user_id AND e.quota_month = _month;
    RETURN QUERY SELECT false, COALESCE(_used, 0), _limit, GREATEST(_limit - COALESCE(_used, 0), 0);
    RETURN;
  END IF;

  RETURN QUERY SELECT true, _used, _limit, GREATEST(_limit - _used, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_essay_quota(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_essay_quota(uuid) TO service_role;

COMMIT;
