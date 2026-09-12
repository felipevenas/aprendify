-- Apply before deploying the updated Edge Functions. No rows are deleted.
BEGIN;

-- Browser clients must not select arbitrary budgets or consume another user's
-- quota via this SECURITY DEFINER RPC. Only trusted Edge Functions call it.
REVOKE ALL ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) TO service_role;

-- Keep the SECURITY DEFINER limiter bounded even if a trusted caller passes
-- malformed values. This also avoids unbounded intervals and arbitrary keys.
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
  _window_start timestamptz;
  _current_count integer;
BEGIN
  IF _user_id IS NULL OR _function_name IS NULL OR
     _function_name !~ '^[a-z0-9][a-z0-9-]{0,63}$' OR
     _max_calls < 1 OR _max_calls > 1000 OR
     _window_minutes < 1 OR _window_minutes > 1440 THEN
    RAISE EXCEPTION 'Invalid rate limit parameters' USING ERRCODE = '22023';
  END IF;

  _window_start := now() - make_interval(mins => _window_minutes);
  SELECT calls_count INTO _current_count
  FROM public.ai_rate_limits
  WHERE user_id = _user_id AND function_name = _function_name
    AND window_start > _window_start
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.ai_rate_limits (user_id, function_name, calls_count, window_start)
    VALUES (_user_id, _function_name, 1, now())
    ON CONFLICT (user_id, function_name) DO UPDATE SET
      calls_count = 1, window_start = now(), updated_at = now();
    RETURN TRUE;
  END IF;
  IF _current_count >= _max_calls THEN RETURN FALSE; END IF;
  UPDATE public.ai_rate_limits SET calls_count = calls_count + 1, updated_at = now()
  WHERE user_id = _user_id AND function_name = _function_name;
  RETURN TRUE;
END;
$$;

-- Anonymous auth.uid() is NULL: older IF user_id != auth.uid() checks do not
-- reject that case. Remove anonymous execution, retaining authenticated APIs.
REVOKE ALL ON FUNCTION public.unlock_achievement(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unlock_achievement(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_user_premium(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_daily_question_count(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_flashcard_count(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_monthly_essay_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid), public.is_user_premium(uuid), public.get_daily_question_count(uuid), public.get_user_flashcard_count(uuid), public.get_monthly_essay_count(uuid) TO authenticated, service_role;

-- RLS limits rows, not columns. Keep the existing creator PIX editing flow,
-- but prevent creators from changing coupon codes, activation or ownership.
CREATE OR REPLACE FUNCTION public.protect_creator_coupon_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM OLD.user_id OR
     (to_jsonb(NEW) - ARRAY['pix_key', 'pix_key_type', 'updated_at']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['pix_key', 'pix_key_type', 'updated_at']) THEN
    RAISE EXCEPTION 'Only administrators can change coupon configuration' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_creator_coupon_fields() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS protect_creator_coupon_fields ON public.creator_coupons;
CREATE TRIGGER protect_creator_coupon_fields
BEFORE UPDATE ON public.creator_coupons
FOR EACH ROW EXECUTE FUNCTION public.protect_creator_coupon_fields();

COMMIT;
