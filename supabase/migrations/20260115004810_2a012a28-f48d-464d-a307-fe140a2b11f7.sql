-- Criar tabela para histórico de cupons de criador
CREATE TABLE public.creator_coupon_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  coupon_code text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  revoked_at timestamp with time zone NOT NULL DEFAULT now(),
  revoked_by uuid,
  reason text DEFAULT 'manual_revocation'
);

-- Criar índice para busca por user_id
CREATE INDEX idx_creator_coupon_history_user_id ON public.creator_coupon_history(user_id);

-- Habilitar RLS
ALTER TABLE public.creator_coupon_history ENABLE ROW LEVEL SECURITY;

-- Política para admins gerenciarem todo o histórico
CREATE POLICY "Admins can manage coupon history" 
ON public.creator_coupon_history 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::user_role)
WITH CHECK (get_user_role(auth.uid()) = 'admin'::user_role);

-- Política para criadores verem seu próprio histórico
CREATE POLICY "Creators can view their own coupon history" 
ON public.creator_coupon_history 
FOR SELECT 
USING (auth.uid() = user_id);

-- Adicionar constraint case-insensitive para username na tabela profiles
-- Primeiro, dropar o índice existente se houver
DROP INDEX IF EXISTS idx_profiles_username;

-- Criar índice único case-insensitive para username
CREATE UNIQUE INDEX idx_profiles_username_lower ON public.profiles(LOWER(username)) WHERE username IS NOT NULL;