-- Add column to track if user had doubt answering the question
-- This will be used to increase probability of showing this question again (10% boost)
ALTER TABLE public.question_attempts 
ADD COLUMN had_doubt BOOLEAN DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.question_attempts.had_doubt IS 'Indicates if user had difficulty/doubt answering this question. Questions with had_doubt=true have 10% higher chance of appearing again.';