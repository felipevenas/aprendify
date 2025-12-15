-- Adicionar colunas para cronograma mensal
ALTER TABLE public.schedule_items 
ADD COLUMN IF NOT EXISTS scheduled_date DATE,
ADD COLUMN IF NOT EXISTS topic TEXT,
ADD COLUMN IF NOT EXISTS activities TEXT,
ADD COLUMN IF NOT EXISTS estimated_duration INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS study_tips TEXT,
ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';

-- Criar tabela para controlar regeneração de cronograma
CREATE TABLE IF NOT EXISTS public.schedule_generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  next_regeneration_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '15 days'),
  performance_snapshot JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.schedule_generations ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Users can manage their own schedule generations"
ON public.schedule_generations
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Índice para busca por data
CREATE INDEX IF NOT EXISTS idx_schedule_items_scheduled_date ON public.schedule_items(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_schedule_items_user_date ON public.schedule_items(user_id, scheduled_date);