-- ============================================
-- SECURITY MIGRATION: Restringir RLS de Gamificação
-- ============================================

-- 1. Restringir leaderboard_stats para SELECT apenas (evita fraudes de pontos via frontend)
DROP POLICY IF EXISTS "Users can manage their own stats" ON public.leaderboard_stats;

-- 2. Restringir user_challenge_progress para SELECT apenas (evita fraudes de progresso nos desafios)
DROP POLICY IF EXISTS "Users can manage their own challenge progress" ON public.user_challenge_progress;

CREATE POLICY "Users can view their own challenge progress"
ON public.user_challenge_progress
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
