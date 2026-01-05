-- Adicionar coluna para tracking de regeneração forçada
ALTER TABLE public.schedule_generations 
ADD COLUMN IF NOT EXISTS last_forced_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.schedule_generations.last_forced_at IS 'Data/hora da última regeneração forçada. Limita a 1 por semana para economizar tokens.';