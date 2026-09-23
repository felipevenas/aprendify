-- Keep the legacy boolean RPC used by older Edge Functions compatible with
-- the scoped rate-limit table introduced by the atomic quota migration.
BEGIN;

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

COMMIT;
