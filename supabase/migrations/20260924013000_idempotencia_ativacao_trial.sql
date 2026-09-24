-- Preserve a confirmed trial's idempotent result after the user later buys a
-- paid plan. A replayed Stripe checkout event must not fail indefinitely.
-- Technical rollback: restore the function from 20260923124500. No data is
-- changed by this migration, so no data restoration is required.
BEGIN;

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

  -- Validate an exact replay before considering a later paid subscription.
  IF _trial.started_at IS NOT NULL THEN
    RETURN _trial.started_at = _trial_started_at
       AND _trial.ends_at = _trial_ends_at
       AND _trial.trial_stripe_subscription_id = _stripe_subscription_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.subscriptions s
     WHERE s.user_id = _user_id
       AND s.status = 'authorized'
       AND (s.end_date IS NULL OR s.end_date > clock_timestamp())
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.free_trial_entitlements
     SET started_at = _trial_started_at,
         ends_at = _trial_ends_at,
         trial_stripe_subscription_id = _stripe_subscription_id
   WHERE user_id = _user_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_free_trial_from_stripe(uuid, text, text, text, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_free_trial_from_stripe(uuid, text, text, text, timestamptz, timestamptz)
  TO service_role;

COMMIT;
