-- Criar tabela de tickets de feedback
CREATE TABLE public.feedback_tickets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    ticket_type TEXT NOT NULL DEFAULT 'suggestion', -- 'suggestion', 'improvement', 'bug'
    status TEXT NOT NULL DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'closed'
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.feedback_tickets ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ver e criar seus próprios tickets
CREATE POLICY "Users can view their own tickets"
ON public.feedback_tickets
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tickets"
ON public.feedback_tickets
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Política: admins podem ver e gerenciar todos os tickets
CREATE POLICY "Admins can view all tickets"
ON public.feedback_tickets
FOR SELECT
USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can update all tickets"
ON public.feedback_tickets
FOR UPDATE
USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can delete all tickets"
ON public.feedback_tickets
FOR DELETE
USING (get_user_role(auth.uid()) = 'admin');

-- Trigger para atualizar updated_at
CREATE TRIGGER update_feedback_tickets_updated_at
BEFORE UPDATE ON public.feedback_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();