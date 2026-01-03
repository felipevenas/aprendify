-- Add new classification fields to enem_questions table
ALTER TABLE public.enem_questions 
ADD COLUMN IF NOT EXISTS origin text DEFAULT 'enem_api',
ADD COLUMN IF NOT EXISTS main_topic text,
ADD COLUMN IF NOT EXISTS subtopics text[],
ADD COLUMN IF NOT EXISTS confidence float,
ADD COLUMN IF NOT EXISTS classification_status text DEFAULT 'pending_classification';

-- Create index for efficient filtering by status
CREATE INDEX IF NOT EXISTS idx_enem_questions_classification_status 
ON public.enem_questions(classification_status);

-- Create index for filtering by main_topic
CREATE INDEX IF NOT EXISTS idx_enem_questions_main_topic 
ON public.enem_questions(main_topic);

-- Create index for filtering by discipline + status (common query pattern)
CREATE INDEX IF NOT EXISTS idx_enem_questions_discipline_status 
ON public.enem_questions(discipline, classification_status);

-- Update existing questions to have 'ready' status if they have difficulty set
UPDATE public.enem_questions 
SET classification_status = 'ready' 
WHERE difficulty IS NOT NULL AND classification_status IS NULL;

-- Update remaining questions to 'pending_classification'
UPDATE public.enem_questions 
SET classification_status = 'pending_classification' 
WHERE classification_status IS NULL;

-- Add RLS policy for admins to update classification fields
CREATE POLICY "Admins can update enem questions" 
ON public.enem_questions 
FOR UPDATE 
USING (get_user_role(auth.uid()) = 'admin'::user_role);