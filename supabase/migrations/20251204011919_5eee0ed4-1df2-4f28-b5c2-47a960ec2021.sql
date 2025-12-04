-- Tabela para armazenar as redações dos usuários
CREATE TABLE public.essays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  score_total INTEGER,
  score_competency_1 INTEGER,
  score_competency_2 INTEGER,
  score_competency_3 INTEGER,
  score_competency_4 INTEGER,
  score_competency_5 INTEGER,
  feedback TEXT,
  tips TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.essays ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem gerenciar suas próprias redações
CREATE POLICY "Users can manage their own essays"
ON public.essays
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_essays_updated_at
BEFORE UPDATE ON public.essays
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para contar redações do mês atual
CREATE OR REPLACE FUNCTION public.get_monthly_essay_count(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.essays
  WHERE user_id = _user_id
    AND created_at >= date_trunc('month', CURRENT_DATE)
$$;