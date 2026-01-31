-- =====================================================
-- SECURITY HARDENING MIGRATION
-- =====================================================

-- 1. Criar VIEW segura para notificações públicas (sem created_by)
CREATE VIEW public.system_notifications_public
WITH (security_invoker = on) AS
SELECT 
  id,
  title,
  content,
  notification_type,
  is_active,
  created_at
FROM public.system_notifications
WHERE is_active = true;

-- Permitir leitura pública da view
GRANT SELECT ON public.system_notifications_public TO anon, authenticated;

-- 2. Remover política permissiva de notificações e criar uma mais restritiva
DROP POLICY IF EXISTS "Anyone can read active notifications" ON public.system_notifications;

-- Apenas admins podem ler diretamente da tabela base
CREATE POLICY "Only admins can read notifications directly"
ON public.system_notifications
FOR SELECT
USING (public.get_user_role(auth.uid()) = 'admin');

-- 3. Criar VIEW segura para cupons públicos (sem pix_key e user_id)
CREATE VIEW public.creator_coupons_public
WITH (security_invoker = on) AS
SELECT 
  id,
  coupon_code,
  is_active,
  created_at
FROM public.creator_coupons
WHERE is_active = true;

-- Permitir leitura pública da view de cupons
GRANT SELECT ON public.creator_coupons_public TO anon, authenticated;

-- 4. Remover política permissiva de cupons
DROP POLICY IF EXISTS "Anyone can read active coupons by code" ON public.creator_coupons;

-- 5. Restringir política de rate limits - remover service role policy permissiva
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.ai_rate_limits;

-- Criar política mais restritiva para service role (apenas através de RPC)
CREATE POLICY "Users can manage their own rate limits"
ON public.ai_rate_limits
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. Criar índice para melhorar performance das consultas de segurança
CREATE INDEX IF NOT EXISTS idx_creator_coupons_code_active 
ON public.creator_coupons(coupon_code) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_system_notifications_active 
ON public.system_notifications(is_active) 
WHERE is_active = true;