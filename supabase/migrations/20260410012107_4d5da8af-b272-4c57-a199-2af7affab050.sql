
-- ============================================
-- 1. FIX: ai_rate_limits - Remove ALL policy, keep only SELECT
-- ============================================
DROP POLICY IF EXISTS "Users can manage their own rate limits" ON public.ai_rate_limits;
-- Keep "Users can view their own rate limits" (SELECT only) as-is

-- ============================================
-- 2. FIX: achievements - Replace ALL with SELECT only, add RPC for unlocking
-- ============================================
DROP POLICY IF EXISTS "Users can manage their own achievements" ON public.achievements;

CREATE POLICY "Users can view their own achievements"
ON public.achievements
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create a SECURITY DEFINER function for unlocking achievements server-side
CREATE OR REPLACE FUNCTION public.unlock_achievement(_user_id uuid, _achievement_type text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow users to unlock their own achievements
  IF _user_id != auth.uid() THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.achievements (user_id, achievement_type)
  VALUES (_user_id, _achievement_type)
  ON CONFLICT DO NOTHING;

  RETURN FOUND;
END;
$$;

-- ============================================
-- 3. FIX: leaderboard_stats - Restrict public read to authenticated only
-- ============================================
DROP POLICY IF EXISTS "Anyone can view leaderboard stats" ON public.leaderboard_stats;

CREATE POLICY "Authenticated users can view leaderboard stats"
ON public.leaderboard_stats
FOR SELECT
TO authenticated
USING (true);
