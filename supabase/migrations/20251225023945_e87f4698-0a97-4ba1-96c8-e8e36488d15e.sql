-- Tabela para rastrear streaks diários dos usuários
CREATE TABLE public.user_streaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  questions_today INTEGER NOT NULL DEFAULT 0,
  streak_completed_today BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

-- Política para usuários gerenciarem seus próprios streaks
CREATE POLICY "Users can manage their own streaks"
ON public.user_streaks
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_user_streaks_updated_at
BEFORE UPDATE ON public.user_streaks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índice para busca rápida por user_id
CREATE INDEX idx_user_streaks_user_id ON public.user_streaks(user_id);

-- Comentários
COMMENT ON TABLE public.user_streaks IS 'Rastreia sequências diárias de estudo dos usuários';
COMMENT ON COLUMN public.user_streaks.current_streak IS 'Número de dias consecutivos com 5+ questões respondidas';
COMMENT ON COLUMN public.user_streaks.questions_today IS 'Questões respondidas no dia atual';
COMMENT ON COLUMN public.user_streaks.streak_completed_today IS 'Se o usuário já completou as 5 questões hoje';