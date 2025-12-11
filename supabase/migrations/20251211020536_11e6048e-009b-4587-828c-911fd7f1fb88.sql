-- Create simulados table to track exam sessions
CREATE TABLE public.simulados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL, -- 'official_day1', 'official_day2', 'custom_naturezas', 'custom_humanas', 'custom_linguagens', 'custom_matematica'
  year TEXT, -- For official exams (2009-2024), null for custom
  total_questions INTEGER NOT NULL DEFAULT 45,
  duration_minutes INTEGER NOT NULL DEFAULT 300, -- 5h = 300min, 5h30 = 330min
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'completed', 'abandoned'
  essay_topic TEXT, -- AI-generated essay topic for day 1 exams
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create simulado_answers table to track individual answers
CREATE TABLE public.simulado_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  simulado_id UUID NOT NULL REFERENCES public.simulados(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  question_index INTEGER NOT NULL,
  discipline TEXT NOT NULL,
  selected_answer TEXT,
  correct_answer TEXT NOT NULL,
  is_correct BOOLEAN,
  answered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create simulado_results table for AI analysis
CREATE TABLE public.simulado_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  simulado_id UUID NOT NULL REFERENCES public.simulados(id) ON DELETE CASCADE UNIQUE,
  total_correct INTEGER NOT NULL DEFAULT 0,
  total_incorrect INTEGER NOT NULL DEFAULT 0,
  total_unanswered INTEGER NOT NULL DEFAULT 0,
  strengths JSONB, -- Array of strong disciplines/topics
  weaknesses JSONB, -- Array of weak disciplines/topics
  tips TEXT, -- AI-generated study tips
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.simulados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulado_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulado_results ENABLE ROW LEVEL SECURITY;

-- RLS policies for simulados
CREATE POLICY "Users can manage their own simulados"
ON public.simulados
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS policies for simulado_answers
CREATE POLICY "Users can manage their own simulado answers"
ON public.simulado_answers
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.simulados
    WHERE simulados.id = simulado_answers.simulado_id
    AND simulados.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.simulados
    WHERE simulados.id = simulado_answers.simulado_id
    AND simulados.user_id = auth.uid()
  )
);

-- RLS policies for simulado_results
CREATE POLICY "Users can view their own simulado results"
ON public.simulado_results
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.simulados
    WHERE simulados.id = simulado_results.simulado_id
    AND simulados.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.simulados
    WHERE simulados.id = simulado_results.simulado_id
    AND simulados.user_id = auth.uid()
  )
);

-- Create indexes for performance
CREATE INDEX idx_simulados_user_id ON public.simulados(user_id);
CREATE INDEX idx_simulados_status ON public.simulados(status);
CREATE INDEX idx_simulado_answers_simulado_id ON public.simulado_answers(simulado_id);
CREATE INDEX idx_simulado_results_simulado_id ON public.simulado_results(simulado_id);

-- Trigger for updated_at
CREATE TRIGGER update_simulados_updated_at
BEFORE UPDATE ON public.simulados
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();