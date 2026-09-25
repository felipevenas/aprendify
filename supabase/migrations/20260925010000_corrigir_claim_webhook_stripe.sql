-- A newly inserted event already has a live lease. It belongs to this call,
-- so return the claim before checking the lease of an existing row.
BEGIN;

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
  _inserted_event_id text;
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
  ON CONFLICT (event_id) DO NOTHING
  RETURNING event_id INTO _inserted_event_id;

  IF _inserted_event_id IS NOT NULL THEN
    RETURN QUERY SELECT true, false, 'processing'::text;
    RETURN;
  END IF;

  SELECT * INTO _row FROM public.stripe_webhook_events
   WHERE event_id = _event_id FOR UPDATE;
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

REVOKE ALL ON FUNCTION public.claim_stripe_webhook_event(text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stripe_webhook_event(text, text, jsonb)
  TO service_role;

COMMIT;
