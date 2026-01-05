-- Adiciona coluna is_active para controlar se a questão está ativa ou em manutenção
ALTER TABLE public.enem_questions 
ADD COLUMN is_active boolean NOT NULL DEFAULT true;

-- Comentário explicativo
COMMENT ON COLUMN public.enem_questions.is_active IS 
  'Indica se a questão está ativa. Questões desativadas não aparecem para usuários comuns.';