-- Adiciona coluna de dificuldade na tabela enem_questions
-- Valores possíveis: 'easy', 'medium', 'hard' (ou NULL se ainda não classificado)
ALTER TABLE public.enem_questions
ADD COLUMN IF NOT EXISTS difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard'));

-- Cria índice para melhor performance nas consultas por dificuldade
CREATE INDEX IF NOT EXISTS idx_enem_questions_difficulty ON public.enem_questions(difficulty);

-- Comentário para documentação
COMMENT ON COLUMN public.enem_questions.difficulty IS 'Nível de dificuldade da questão: easy (fácil), medium (médio), hard (difícil)';