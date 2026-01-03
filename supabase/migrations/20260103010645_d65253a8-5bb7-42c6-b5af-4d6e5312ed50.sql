-- Drop the foreign key constraint if it exists
ALTER TABLE public.flashcards DROP CONSTRAINT IF EXISTS flashcards_subject_id_fkey;

-- Change subject_id from UUID to TEXT to store fixed subject slugs
ALTER TABLE public.flashcards ALTER COLUMN subject_id TYPE text USING subject_id::text;

-- Also fix notes table if needed (already text based on schema)
-- Check and fix tasks table
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_subject_id_fkey;
ALTER TABLE public.tasks ALTER COLUMN subject_id TYPE text USING subject_id::text;

-- Fix schedule_items table
ALTER TABLE public.schedule_items DROP CONSTRAINT IF EXISTS schedule_items_subject_id_fkey;
ALTER TABLE public.schedule_items ALTER COLUMN subject_id TYPE text USING subject_id::text;

-- Fix questions table
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_subject_id_fkey;
ALTER TABLE public.questions ALTER COLUMN subject_id TYPE text USING subject_id::text;