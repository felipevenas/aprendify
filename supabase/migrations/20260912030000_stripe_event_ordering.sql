-- Preserve Stripe delivery order at the projection boundary.
-- Technical rollback: restore the previous RPC/handlers and remove the new
-- columns only after rolling back callers. This does not restore data.
BEGIN;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_last_event_created bigint,
  ADD COLUMN IF NOT EXISTS stripe_last_event_id text;

ALTER TABLE public.subscription_history
  ADD COLUMN IF NOT EXISTS applied boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_event_order
  ON public.subscriptions(stripe_subscription_id, stripe_last_event_created);

CREATE OR REPLACE FUNCTION public.record_subscription_projection(
  _event_id text,
  _event_created bigint,
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
  _projection_id uuid;
  _last_created bigint;
  _last_event_id text;
  _applied boolean := false;
BEGIN
  IF auth.role() <> 'service_role' OR _event_id IS NULL OR _event_id !~ '^evt_[A-Za-z0-9]+$'
     OR _event_created IS NULL OR _event_created < 0 OR _user_id IS NULL
     OR _stripe_subscription_id IS NULL OR _status IS NULL THEN
    RAISE EXCEPTION 'Invalid subscription projection' USING ERRCODE = '22023';
  END IF;

  -- Serialize all transitions for the user's current projection. Equal
  -- timestamps use event_id as a deterministic tie breaker.
  INSERT INTO public.subscriptions(
    user_id, status, plan_type, stripe_subscription_id, stripe_customer_id,
    start_date, end_date, stripe_last_event_created, stripe_last_event_id, updated_at
  ) VALUES (
    _user_id, _status, _plan_type, _stripe_subscription_id, _stripe_customer_id,
    _start_date, _end_date, NULL, NULL, now()
  ) ON CONFLICT (user_id) DO NOTHING;

  SELECT id, stripe_last_event_created, stripe_last_event_id
    INTO _projection_id, _last_created, _last_event_id
    FROM public.subscriptions
   WHERE user_id = _user_id
   FOR UPDATE;

  IF _last_created IS NULL OR _event_created > _last_created
     OR (_event_created = _last_created AND _event_id >= COALESCE(_last_event_id, '')) THEN
    UPDATE public.subscriptions
       SET status = _status,
           plan_type = _plan_type,
           stripe_subscription_id = _stripe_subscription_id,
           stripe_customer_id = _stripe_customer_id,
           start_date = _start_date,
           end_date = _end_date,
           stripe_last_event_created = _event_created,
           stripe_last_event_id = _event_id,
           updated_at = now()
     WHERE id = _projection_id;
    _applied := true;
  END IF;

  INSERT INTO public.subscription_history(
    source_event_id, user_id, stripe_subscription_id, stripe_customer_id,
    status, plan_type, start_date, end_date, applied
  ) VALUES (
    _event_id, _user_id, _stripe_subscription_id, _stripe_customer_id,
    _status, _plan_type, _start_date, _end_date, _applied
  ) ON CONFLICT (source_event_id) DO NOTHING;

  RETURN _projection_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_subscription_status_event(
  _event_id text,
  _event_created bigint,
  _stripe_subscription_id text,
  _status text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.subscriptions;
  _applied boolean := false;
BEGIN
  IF auth.role() <> 'service_role' OR _event_id IS NULL OR _event_id !~ '^evt_[A-Za-z0-9]+$'
     OR _event_created IS NULL OR _event_created < 0
     OR _stripe_subscription_id IS NULL OR _status IS NULL THEN
    RAISE EXCEPTION 'Invalid subscription status event' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _row
    FROM public.subscriptions
   WHERE stripe_subscription_id = _stripe_subscription_id
   FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF _row.stripe_last_event_created IS NULL
     OR _event_created > _row.stripe_last_event_created
     OR (_event_created = _row.stripe_last_event_created AND _event_id >= COALESCE(_row.stripe_last_event_id, '')) THEN
    UPDATE public.subscriptions
       SET status = _status,
           stripe_last_event_created = _event_created,
           stripe_last_event_id = _event_id,
           updated_at = now()
     WHERE id = _row.id;
    _applied := true;
  END IF;

  INSERT INTO public.subscription_history(
    source_event_id, user_id, stripe_subscription_id, stripe_customer_id,
    status, plan_type, start_date, end_date, applied
  ) VALUES (
    _event_id, _row.user_id, _stripe_subscription_id, _row.stripe_customer_id,
    _status, _row.plan_type, _row.start_date, _row.end_date, _applied
  ) ON CONFLICT (source_event_id) DO NOTHING;

  RETURN _row.id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_subscription_projection(text, bigint, uuid, text, text, text, public.plan_type, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_subscription_projection(text, bigint, uuid, text, text, text, public.plan_type, timestamptz, timestamptz) TO service_role;
REVOKE ALL ON FUNCTION public.record_subscription_status_event(text, bigint, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_subscription_status_event(text, bigint, text, text) TO service_role;

COMMIT;

