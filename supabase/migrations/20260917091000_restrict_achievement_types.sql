-- Conquistas são um catálogo fechado; o cliente não pode poluir analytics
-- com tipos arbitrários.
CREATE OR REPLACE FUNCTION public.unlock_achievement(_user_id uuid, _achievement_type text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN
    RETURN FALSE;
  END IF;

  IF _achievement_type IS NULL OR _achievement_type NOT IN (
    'first_question', 'dedicated_7_days', 'century_100',
    'expert_matematica', 'expert_linguagens', 'expert_ciencias_natureza',
    'expert_ciencias_humanas', 'perfect_essay', 'streak_master_30',
    'speed_demon', 'night_owl', 'early_bird', 'simulado_complete',
    'flashcard_master'
  ) THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.achievements (user_id, achievement_type)
  VALUES (_user_id, _achievement_type)
  ON CONFLICT DO NOTHING;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.unlock_achievement(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unlock_achievement(uuid, text) TO authenticated;
