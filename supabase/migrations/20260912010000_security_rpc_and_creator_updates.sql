-- Apply before deploying the updated Edge Functions. No rows are deleted.
BEGIN;

-- Browser clients must not select arbitrary budgets or consume another user's
-- quota via this SECURITY DEFINER RPC. Only trusted Edge Functions call it.
REVOKE ALL ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) TO service_role;

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
CREATE TRIGGER protect_creator_coupon_fields
BEFORE UPDATE ON public.creator_coupons
FOR EACH ROW EXECUTE FUNCTION public.protect_creator_coupon_fields();

COMMIT;
