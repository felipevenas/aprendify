-- Atualiza a tabela notes para permitir subject_id como texto (slug da matéria fixa)
-- Remove a foreign key constraint para subjects, já que agora usamos matérias fixas

-- Primeiro, remove a constraint de foreign key se existir
ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_subject_id_fkey;

-- Altera o tipo da coluna subject_id para text (para armazenar slugs das matérias fixas)
ALTER TABLE public.notes ALTER COLUMN subject_id TYPE text USING subject_id::text;

-- Permite valores nulos temporariamente para compatibilidade com dados existentes
ALTER TABLE public.notes ALTER COLUMN subject_id DROP NOT NULL;