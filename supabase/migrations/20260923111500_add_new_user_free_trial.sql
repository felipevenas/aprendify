-- Server-owned 72 hour Complete trial for accounts created after this migration.
-- Technical rollback: revert dependent Edge Functions, restore the previous
-- definitions of is_user_premium, record_question_attempt, and consume_essay_quota,
-- then drop the new RPCs, trigger, and table. Dropping the table permanently
-- removes trial history; restoring that data requires a backup or forward repair.
BEGIN;

CREATE TABLE public.free_trial_entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  eligible_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ends_at timestamptz,
  CONSTRAINT free_trial_start_end_pair CHECK (
    (started_at IS NULL AND ends_at IS NULL)
    OR (started_at IS NOT NULL AND ends_at = started_at + interval '72 hours')
  )
);

ALTER TABLE public.free_trial_entitlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.free_trial_entitlements FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mark_new_user_trial_eligible()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.free_trial_entitlements(user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mark_new_user_trial_eligible
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.mark_new_user_trial_eligible();

CREATE OR REPLACE FUNCTION public.start_free_trial(_user_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _now timestamptz := clock_timestamp();
  _ends_at timestamptz;
  _email_confirmed boolean;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR _user_id IS NULL THEN
    RAISE EXCEPTION 'Trial activation is internal' USING ERRCODE = '42501';
  END IF;

  SELECT (email_confirmed_at IS NOT NULL OR confirmed_at IS NOT NULL)
    INTO _email_confirmed
    FROM auth.users
   WHERE id = _user_id;

  IF COALESCE(_email_confirmed, false) IS FALSE THEN
    RETURN NULL;
  END IF;

  -- A single conditional update serializes concurrent first-session requests.
  -- A retry after activation returns the original end time and never extends it.
  UPDATE public.free_trial_entitlements
     SET started_at = _now,
         ends_at = _now + interval '72 hours'
   WHERE user_id = _user_id
     AND started_at IS NULL
  RETURNING ends_at INTO _ends_at;

  IF _ends_at IS NOT NULL THEN
    RETURN _ends_at;
  END IF;

  SELECT ends_at INTO _ends_at
    FROM public.free_trial_entitlements
   WHERE user_id = _user_id;
  RETURN _ends_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_entitlement(_user_id uuid)
RETURNS TABLE(
  subscribed boolean,
  plan_type text,
  subscription_end timestamptz,
  has_premium_access boolean,
  trial_status text,
  trial_ends_at timestamptz,
  tier text,
  monthly_essay_limit integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _subscription public.subscriptions;
  _trial public.free_trial_entitlements;
  _paid boolean := false;
  _trial_active boolean := false;
  _trial_status text := 'not_eligible';
  _premium boolean := false;
  _tier text := 'free';
  _essay_limit integer := 1;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid entitlement subject' USING ERRCODE = '22023';
  END IF;
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND _user_id IS DISTINCT FROM auth.uid()
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
     ) THEN
    RAISE EXCEPTION 'Entitlement access denied' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _subscription
    FROM public.subscriptions s
   WHERE s.user_id = _user_id
     AND s.status = 'authorized'
     AND (s.end_date IS NULL OR s.end_date > now())
   ORDER BY s.updated_at DESC
   LIMIT 1;
  _paid := FOUND;

  SELECT * INTO _trial
    FROM public.free_trial_entitlements t
   WHERE t.user_id = _user_id;

  IF FOUND THEN
    IF _trial.started_at IS NULL THEN
      _trial_status := 'eligible';
    ELSIF _trial.ends_at > now() THEN
      _trial_active := true;
      _trial_status := 'active';
    ELSE
      _trial_status := 'expired';
    END IF;
  END IF;

  _premium := _paid OR _trial_active;
  IF _paid THEN
    _tier := CASE WHEN _subscription.plan_type::text IN ('annual', 'god', 'creator')
                  THEN 'complete' ELSE 'starter' END;
    _essay_limit := CASE WHEN _subscription.plan_type::text IN ('annual', 'god', 'creator')
                         THEN 12 ELSE 4 END;
  ELSIF _trial_active THEN
    _tier := 'complete';
    _essay_limit := 12;
  END IF;

  RETURN QUERY SELECT
    _paid,
    CASE WHEN _paid THEN _subscription.plan_type::text ELSE NULL END,
    CASE WHEN _paid THEN _subscription.end_date ELSE NULL END,
    _premium,
    _trial_status,
    _trial.ends_at,
    _tier,
    _essay_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_user_premium(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _has_access boolean;
BEGIN
  -- Preserve the existing boolean contract for callers querying another user.
  IF _user_id IS NULL OR (auth.role() IS DISTINCT FROM 'service_role'
     AND _user_id IS DISTINCT FROM auth.uid()
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
     )) THEN
    RETURN false;
  END IF;
  SELECT e.has_premium_access INTO _has_access
    FROM public.get_user_entitlement(_user_id) e;
  RETURN COALESCE(_has_access, false);
END;
$$;

REVOKE ALL ON FUNCTION public.start_free_trial(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_free_trial(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.mark_new_user_trial_eligible() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_user_entitlement(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_entitlement(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_user_premium(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_user_premium(uuid) TO authenticated, service_role;

-- Premium status must be the same source of truth for the direct database path.
CREATE OR REPLACE FUNCTION public.record_question_attempt(
  _question_id text,
  _selected_answer text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _question public.enem_questions;
  _attempt_id uuid;
  _answer text := upper(trim(_selected_answer));
  _today_count integer;
  _recent_count integer;
  _is_premium boolean;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;
  IF _question_id IS NULL OR length(trim(_question_id)) > 128
     OR _answer !~ '^[A-E]$' THEN
    RAISE EXCEPTION 'INVALID_QUESTION_ATTEMPT' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _question
    FROM public.enem_questions
   WHERE id::text = trim(_question_id)
      OR format('%s-%s-%s', year, discipline, index) = trim(_question_id)
   LIMIT 1;
  IF NOT FOUND OR COALESCE(_question.is_active, true) IS FALSE THEN
    RAISE EXCEPTION 'QUESTION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  _is_premium := public.is_user_premium(_user_id);
  PERFORM 1 FROM public.profiles WHERE id = _user_id FOR UPDATE;

  SELECT count(*)::integer INTO _today_count
    FROM public.question_attempts
   WHERE user_id = _user_id AND created_at >= current_date;
  IF NOT _is_premium AND _today_count >= 10 THEN
    RAISE EXCEPTION 'DAILY_QUESTION_LIMIT' USING ERRCODE = 'P0003';
  END IF;

  SELECT count(*)::integer INTO _recent_count
    FROM public.question_attempts
   WHERE user_id = _user_id AND created_at >= now() - interval '1 minute';
  IF _recent_count >= 60 THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0004';
  END IF;

  INSERT INTO public.question_attempts (
    user_id, question_id, discipline, year, selected_answer, correct_answer,
    is_correct, language
  ) VALUES (
    _user_id, _question.id::text, _question.discipline, _question.year,
    _answer, upper(trim(_question.correct_alternative)),
    _answer = upper(trim(_question.correct_alternative)), _question.language
  ) RETURNING id INTO _attempt_id;
  RETURN _attempt_id;
END;
$$;

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
  IF auth.role() IS DISTINCT FROM 'service_role' OR _user_id IS NULL THEN
    RAISE EXCEPTION 'Essay quota RPC is internal' USING ERRCODE = '42501';
  END IF;

  SELECT e.monthly_essay_limit INTO _limit
    FROM public.get_user_entitlement(_user_id) e;
  _limit := COALESCE(_limit, 1);

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

REVOKE ALL ON FUNCTION public.record_question_attempt(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_question_attempt(text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.consume_essay_quota(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_essay_quota(uuid) TO service_role;

COMMIT;
