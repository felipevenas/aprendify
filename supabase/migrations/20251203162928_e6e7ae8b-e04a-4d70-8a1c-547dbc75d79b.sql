-- Criar tabela de flashcards
CREATE TABLE public.flashcards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  front_content TEXT NOT NULL,
  back_content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

-- Política para usuários gerenciarem seus próprios flashcards
CREATE POLICY "Users can manage their own flashcards"
ON public.flashcards
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_flashcards_updated_at
BEFORE UPDATE ON public.flashcards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar realtime
ALTER TABLE public.flashcards REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.flashcards;

-- Função para contar flashcards do usuário
CREATE OR REPLACE FUNCTION public.get_user_flashcard_count(_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.flashcards
  WHERE user_id = _user_id
$$;