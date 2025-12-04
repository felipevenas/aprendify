-- Adiciona unique constraint no user_id da tabela subscriptions
-- Primeiro remove duplicatas se existirem, mantendo apenas a mais recente
DELETE FROM public.subscriptions a
USING public.subscriptions b
WHERE a.user_id = b.user_id
  AND a.created_at < b.created_at;

-- Agora adiciona a constraint unique
ALTER TABLE public.subscriptions 
ADD CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id);