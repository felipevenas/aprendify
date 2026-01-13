-- Tabela de notificações do sistema (criadas por admins)
CREATE TABLE public.system_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  notification_type TEXT NOT NULL DEFAULT 'update', -- 'update', 'patch_notes', 'announcement', 'maintenance'
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para rastrear leituras de notificações por usuário
CREATE TABLE public.notification_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  notification_id UUID NOT NULL REFERENCES public.system_notifications(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, notification_id)
);

-- Enable RLS
ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

-- Policies para system_notifications
-- Todos podem ler notificações ativas
CREATE POLICY "Anyone can read active notifications"
ON public.system_notifications
FOR SELECT
USING (is_active = true);

-- Admins podem gerenciar todas as notificações
CREATE POLICY "Admins can manage notifications"
ON public.system_notifications
FOR ALL
USING (get_user_role(auth.uid()) = 'admin'::user_role)
WITH CHECK (get_user_role(auth.uid()) = 'admin'::user_role);

-- Policies para notification_reads
-- Usuários podem gerenciar suas próprias leituras
CREATE POLICY "Users can manage their own notification reads"
ON public.notification_reads
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins podem ver todas as leituras (para analytics)
CREATE POLICY "Admins can view all notification reads"
ON public.notification_reads
FOR SELECT
USING (get_user_role(auth.uid()) = 'admin'::user_role);