-- Tabela para armazenar as respostas do usuário às questões do ENEM
CREATE TABLE public.question_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  discipline text NOT NULL,
  year text NOT NULL,
  selected_answer text NOT NULL,
  correct_answer text NOT NULL,
  is_correct boolean NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Campos adicionais para análise detalhada
  topic text,
  language text
);

-- Habilita RLS
ALTER TABLE public.question_attempts ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem gerenciar apenas suas próprias tentativas
CREATE POLICY "Users can manage their own question attempts"
ON public.question_attempts
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Índices para melhorar performance de queries
CREATE INDEX idx_question_attempts_user_id ON public.question_attempts(user_id);
CREATE INDEX idx_question_attempts_discipline ON public.question_attempts(discipline);
CREATE INDEX idx_question_attempts_created_at ON public.question_attempts(created_at DESC);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_question_attempts_updated_at
  BEFORE UPDATE ON public.question_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();