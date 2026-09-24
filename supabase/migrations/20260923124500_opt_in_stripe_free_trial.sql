-- Reserve one Stripe trial Checkout per eligible account and activate it only
-- after an authenticated endpoint or signed webhook verifies Stripe state.
-- Technical rollback: deploy prior Edge Function versions, then drop these RPCs
-- and columns. This preserves existing trial data; deleting the added columns
-- discards Stripe attempt/session history and requires backup/forward repair.
BEGIN;

ALTER TABLE public.free_trial_entitlements
  ADD COLUMN trial_checkout_idempotency_key uuid,
  ADD COLUMN trial_stripe_customer_id text,
  ADD COLUMN trial_checkout_session_id text,
  ADD COLUMN trial_checkout_session_expires_at timestamptz,
  ADD COLUMN trial_stripe_subscription_id text;

CREATE UNIQUE INDEX free_trial_checkout_session_id_uidx
  ON public.free_trial_entitlements(trial_checkout_session_id)
  WHERE trial_checkout_session_id IS NOT NULL;
CREATE UNIQUE INDEX free_trial_stripe_subscription_id_uidx
  ON public.free_trial_entitlements(trial_stripe_subscription_id)
  WHERE trial_stripe_subscription_id IS NOT NULL;
ALTER TABLE public.free_trial_entitlements
  ADD CONSTRAINT free_trial_checkout_session_expiry_pair CHECK (
    (trial_checkout_session_id IS NULL AND trial_checkout_session_expires_at IS NULL)
    OR (trial_checkout_session_id IS NOT NULL AND trial_checkout_session_expires_at IS NOT NULL)
  );

-- Keep the old service-role RPC as a no-op during rolling deployment: already
-- deployed check-subscription functions still call it until their replacement
-- is deployed. This prevents both auto-start and transient 503 responses.
CREATE OR REPLACE FUNCTION public.start_free_trial(_user_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR _user_id IS NULL THEN
    RAISE EXCEPTION 'Trial activation is internal' USING ERRCODE = '42501';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.start_free_trial(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_free_trial(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_free_trial_checkout(_user_id uuid)
RETURNS TABLE(
  eligible boolean,
  idempotency_key text,
  stripe_customer_id text,
  checkout_session_id text,
  checkout_session_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _trial public.free_trial_entitlements;
  _confirmed boolean;
  _paid boolean;
  _now timestamptz := clock_timestamp();
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR _user_id IS NULL THEN
    RAISE EXCEPTION 'Trial checkout reservation is internal' USING ERRCODE = '42501';
  END IF;

  SELECT (email_confirmed_at IS NOT NULL OR confirmed_at IS NOT NULL)
    INTO _confirmed FROM auth.users WHERE id = _user_id;
  IF COALESCE(_confirmed, false) IS FALSE THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
     WHERE s.user_id = _user_id
       AND s.status = 'authorized'
       AND (s.end_date IS NULL OR s.end_date > _now)
  ) INTO _paid;
  IF _paid THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT * INTO _trial
    FROM public.free_trial_entitlements
   WHERE user_id = _user_id
   FOR UPDATE;
  IF NOT FOUND OR _trial.started_at IS NOT NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  IF _trial.trial_checkout_idempotency_key IS NULL THEN
    UPDATE public.free_trial_entitlements
       SET trial_checkout_idempotency_key = gen_random_uuid()
     WHERE user_id = _user_id
    RETURNING * INTO _trial;
  END IF;

  RETURN QUERY SELECT true, _trial.trial_checkout_idempotency_key::text,
    _trial.trial_stripe_customer_id, _trial.trial_checkout_session_id,
    _trial.trial_checkout_session_expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_expired_free_trial_checkout(
  _user_id uuid,
  _idempotency_key uuid,
  _checkout_session_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _trial public.free_trial_entitlements;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR _user_id IS NULL
     OR _idempotency_key IS NULL OR _checkout_session_id !~ '^cs_[A-Za-z0-9_]+$' THEN
    RAISE EXCEPTION 'Invalid trial checkout release' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _trial FROM public.free_trial_entitlements
   WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND OR _trial.started_at IS NOT NULL
     OR _trial.trial_checkout_idempotency_key IS DISTINCT FROM _idempotency_key
     OR _trial.trial_checkout_session_id IS DISTINCT FROM _checkout_session_id
     OR _trial.trial_checkout_session_expires_at > clock_timestamp() THEN
    RETURN false;
  END IF;
  UPDATE public.free_trial_entitlements
     SET trial_checkout_idempotency_key = gen_random_uuid(),
         trial_checkout_session_id = NULL,
         trial_checkout_session_expires_at = NULL
   WHERE user_id = _user_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_free_trial_stripe_customer(
  _user_id uuid,
  _idempotency_key uuid,
  _stripe_customer_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _trial public.free_trial_entitlements;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR _user_id IS NULL
     OR _idempotency_key IS NULL OR _stripe_customer_id !~ '^cus_[A-Za-z0-9]+$' THEN
    RAISE EXCEPTION 'Invalid trial customer reservation' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _trial FROM public.free_trial_entitlements
   WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND OR _trial.started_at IS NOT NULL
     OR _trial.trial_checkout_idempotency_key IS DISTINCT FROM _idempotency_key THEN
    RETURN false;
  END IF;
  IF _trial.trial_stripe_customer_id IS NOT NULL
     AND _trial.trial_stripe_customer_id IS DISTINCT FROM _stripe_customer_id THEN
    RETURN false;
  END IF;
  UPDATE public.free_trial_entitlements
     SET trial_stripe_customer_id = _stripe_customer_id
   WHERE user_id = _user_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_free_trial_checkout_session(
  _user_id uuid,
  _idempotency_key uuid,
  _stripe_customer_id text,
  _checkout_session_id text,
  _checkout_session_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _trial public.free_trial_entitlements;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR _user_id IS NULL
     OR _idempotency_key IS NULL
     OR _stripe_customer_id !~ '^cus_[A-Za-z0-9]+$'
     OR _checkout_session_id !~ '^cs_[A-Za-z0-9_]+$'
     OR _checkout_session_expires_at IS NULL THEN
    RAISE EXCEPTION 'Invalid trial checkout session' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _trial FROM public.free_trial_entitlements
   WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND OR _trial.started_at IS NOT NULL
     OR _trial.trial_checkout_idempotency_key IS DISTINCT FROM _idempotency_key
     OR _trial.trial_stripe_customer_id IS DISTINCT FROM _stripe_customer_id THEN
    RETURN false;
  END IF;
  IF _trial.trial_checkout_session_id IS NOT NULL
     AND (_trial.trial_checkout_session_id IS DISTINCT FROM _checkout_session_id
       OR _trial.trial_checkout_session_expires_at IS DISTINCT FROM _checkout_session_expires_at) THEN
    RETURN false;
  END IF;
  UPDATE public.free_trial_entitlements
     SET trial_checkout_session_id = _checkout_session_id,
         trial_checkout_session_expires_at = _checkout_session_expires_at
   WHERE user_id = _user_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_free_trial_from_stripe(
  _user_id uuid,
  _checkout_session_id text,
  _stripe_customer_id text,
  _stripe_subscription_id text,
  _trial_started_at timestamptz,
  _trial_ends_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _trial public.free_trial_entitlements;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR _user_id IS NULL THEN
    RAISE EXCEPTION 'Trial activation is internal' USING ERRCODE = '42501';
  END IF;
  IF _checkout_session_id !~ '^cs_[A-Za-z0-9_]+$'
     OR _stripe_customer_id !~ '^cus_[A-Za-z0-9]+$'
     OR _stripe_subscription_id !~ '^sub_[A-Za-z0-9]+$'
     OR _trial_started_at IS NULL OR _trial_ends_at IS NULL
     OR _trial_ends_at <> _trial_started_at + interval '72 hours'
     OR _trial_started_at > clock_timestamp() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Invalid Stripe trial confirmation' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _trial FROM public.free_trial_entitlements
   WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND OR _trial.trial_checkout_session_id IS DISTINCT FROM _checkout_session_id
     OR _trial.trial_stripe_customer_id IS DISTINCT FROM _stripe_customer_id THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.subscriptions s
     WHERE s.user_id = _user_id
       AND s.status = 'authorized'
       AND (s.end_date IS NULL OR s.end_date > clock_timestamp())
  ) THEN
    RETURN false;
  END IF;

  IF _trial.started_at IS NOT NULL THEN
    RETURN _trial.started_at = _trial_started_at
       AND _trial.ends_at = _trial_ends_at
       AND _trial.trial_stripe_subscription_id = _stripe_subscription_id;
  END IF;

  UPDATE public.free_trial_entitlements
     SET started_at = _trial_started_at,
         ends_at = _trial_ends_at,
         trial_stripe_subscription_id = _stripe_subscription_id
   WHERE user_id = _user_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_free_trial_checkout(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_expired_free_trial_checkout(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_free_trial_stripe_customer(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attach_free_trial_checkout_session(uuid, uuid, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activate_free_trial_from_stripe(uuid, text, text, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_free_trial_checkout(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_expired_free_trial_checkout(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_free_trial_stripe_customer(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.attach_free_trial_checkout_session(uuid, uuid, text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_free_trial_from_stripe(uuid, text, text, text, timestamptz, timestamptz) TO service_role;

COMMIT;
