-- Table for weekly challenges
CREATE TABLE public.weekly_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  challenge_type TEXT NOT NULL DEFAULT 'questions', -- 'questions', 'streak', 'discipline'
  target_value INTEGER NOT NULL DEFAULT 50,
  discipline TEXT, -- null means any discipline
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reward_points INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User progress on weekly challenges
CREATE TABLE public.user_challenge_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  challenge_id UUID NOT NULL REFERENCES public.weekly_challenges(id) ON DELETE CASCADE,
  current_value INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, challenge_id)
);

-- Leaderboard stats (aggregated weekly for performance)
CREATE TABLE public.leaderboard_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  questions_answered INTEGER NOT NULL DEFAULT 0,
  questions_correct INTEGER NOT NULL DEFAULT 0,
  streak_days INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start)
);

-- Enable RLS on all tables
ALTER TABLE public.weekly_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_stats ENABLE ROW LEVEL SECURITY;

-- Policies for weekly_challenges (read-only for users)
CREATE POLICY "Anyone can view active challenges"
ON public.weekly_challenges
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage challenges"
ON public.weekly_challenges
FOR ALL
USING (get_user_role(auth.uid()) = 'admin')
WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Policies for user_challenge_progress
CREATE POLICY "Users can manage their own challenge progress"
ON public.user_challenge_progress
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policies for leaderboard_stats
CREATE POLICY "Anyone can view leaderboard stats"
ON public.leaderboard_stats
FOR SELECT
USING (true);

CREATE POLICY "Users can manage their own stats"
ON public.leaderboard_stats
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Index for faster leaderboard queries
CREATE INDEX idx_leaderboard_week_points ON public.leaderboard_stats(week_start, points DESC);
CREATE INDEX idx_leaderboard_week_questions ON public.leaderboard_stats(week_start, questions_answered DESC);

-- Function to get current week start (Monday)
CREATE OR REPLACE FUNCTION public.get_current_week_start()
RETURNS DATE AS $$
BEGIN
  RETURN date_trunc('week', CURRENT_DATE)::DATE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update leaderboard stats when question is answered
CREATE OR REPLACE FUNCTION public.update_leaderboard_on_attempt()
RETURNS TRIGGER AS $$
DECLARE
  current_week DATE;
BEGIN
  current_week := get_current_week_start();
  
  INSERT INTO public.leaderboard_stats (user_id, week_start, questions_answered, questions_correct, points)
  VALUES (
    NEW.user_id,
    current_week,
    1,
    CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
    CASE WHEN NEW.is_correct THEN 10 ELSE 2 END
  )
  ON CONFLICT (user_id, week_start) DO UPDATE SET
    questions_answered = leaderboard_stats.questions_answered + 1,
    questions_correct = leaderboard_stats.questions_correct + CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
    points = leaderboard_stats.points + CASE WHEN NEW.is_correct THEN 10 ELSE 2 END,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-update leaderboard
CREATE TRIGGER update_leaderboard_trigger
AFTER INSERT ON public.question_attempts
FOR EACH ROW
EXECUTE FUNCTION public.update_leaderboard_on_attempt();

-- Function to update challenge progress
CREATE OR REPLACE FUNCTION public.update_challenge_progress_on_attempt()
RETURNS TRIGGER AS $$
DECLARE
  challenge RECORD;
BEGIN
  -- Find active challenges that match this attempt
  FOR challenge IN 
    SELECT wc.* FROM weekly_challenges wc
    WHERE wc.is_active = true
    AND CURRENT_DATE BETWEEN wc.start_date AND wc.end_date
    AND (wc.discipline IS NULL OR wc.discipline = NEW.discipline)
    AND wc.challenge_type = 'questions'
  LOOP
    INSERT INTO public.user_challenge_progress (user_id, challenge_id, current_value)
    VALUES (NEW.user_id, challenge.id, 1)
    ON CONFLICT (user_id, challenge_id) DO UPDATE SET
      current_value = user_challenge_progress.current_value + 1,
      completed = CASE 
        WHEN user_challenge_progress.current_value + 1 >= challenge.target_value THEN true 
        ELSE user_challenge_progress.completed 
      END,
      completed_at = CASE 
        WHEN user_challenge_progress.current_value + 1 >= challenge.target_value AND user_challenge_progress.completed = false 
        THEN now() 
        ELSE user_challenge_progress.completed_at 
      END,
      updated_at = now();
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for challenge progress
CREATE TRIGGER update_challenge_progress_trigger
AFTER INSERT ON public.question_attempts
FOR EACH ROW
EXECUTE FUNCTION public.update_challenge_progress_on_attempt();

-- Insert initial weekly challenges
INSERT INTO public.weekly_challenges (title, description, challenge_type, target_value, discipline, start_date, end_date, reward_points) VALUES
('Maratonista de Questões', 'Responda 50 questões esta semana', 'questions', 50, NULL, get_current_week_start(), get_current_week_start() + 6, 100),
('Mestre da Matemática', 'Responda 30 questões de Matemática', 'questions', 30, 'Matemática', get_current_week_start(), get_current_week_start() + 6, 150),
('Linguista Dedicado', 'Responda 30 questões de Linguagens', 'questions', 30, 'Linguagens', get_current_week_start(), get_current_week_start() + 6, 150),
('Cientista Natural', 'Responda 25 questões de Ciências da Natureza', 'questions', 25, 'Ciências da Natureza', get_current_week_start(), get_current_week_start() + 6, 150),
('Humanista', 'Responda 25 questões de Ciências Humanas', 'questions', 25, 'Ciências Humanas', get_current_week_start(), get_current_week_start() + 6, 150);