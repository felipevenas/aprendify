-- Add unique constraint on simulado_answers for proper upsert behavior
ALTER TABLE public.simulado_answers 
ADD CONSTRAINT simulado_answers_simulado_question_unique 
UNIQUE (simulado_id, question_index);