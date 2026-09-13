-- Resolve a username to its auth email without exposing the profiles table.
-- This is intentionally exact and case-insensitive so wildcard characters in
-- user input cannot alter the lookup semantics.
CREATE OR REPLACE FUNCTION public.resolve_login_email(_username TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.email
  FROM public.profiles AS p
  WHERE p.username IS NOT NULL
    AND lower(p.username) = lower(trim(_username))
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.resolve_login_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(TEXT) TO anon, authenticated;
