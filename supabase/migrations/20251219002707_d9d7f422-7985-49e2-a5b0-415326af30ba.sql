-- Remove o trigger incorreto da tabela question_attempts (a tabela não possui coluna updated_at)
DROP TRIGGER IF EXISTS update_question_attempts_updated_at ON public.question_attempts;