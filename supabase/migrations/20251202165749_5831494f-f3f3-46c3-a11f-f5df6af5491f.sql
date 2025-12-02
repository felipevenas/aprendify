-- Criar bucket para imagens do ENEM
INSERT INTO storage.buckets (id, name, public) 
VALUES ('enem-images', 'enem-images', true);

-- Política de leitura pública para imagens
CREATE POLICY "Anyone can view enem images" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'enem-images');

-- Política de upload para admins
CREATE POLICY "Admins can upload enem images" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'enem-images' AND 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Criar tabela para questões locais (ENEM 2024+)
CREATE TABLE public.enem_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year TEXT NOT NULL,
  index INTEGER NOT NULL,
  title TEXT NOT NULL,
  discipline TEXT NOT NULL,
  language TEXT,
  context TEXT,
  files TEXT[],
  alternatives_introduction TEXT,
  alternatives JSONB NOT NULL,
  correct_alternative TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, index)
);

-- Habilitar RLS
ALTER TABLE public.enem_questions ENABLE ROW LEVEL SECURITY;

-- Política de leitura para usuários autenticados
CREATE POLICY "Authenticated users can read enem questions" 
ON public.enem_questions FOR SELECT 
TO authenticated 
USING (true);

-- Política de inserção apenas para admins (via Edge Function com service role)
CREATE POLICY "Service role can insert enem questions"
ON public.enem_questions FOR INSERT
WITH CHECK (true);