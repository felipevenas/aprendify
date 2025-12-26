-- Habilita REPLICA IDENTITY FULL para capturar dados completos em updates nas tabelas principais
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.notes REPLICA IDENTITY FULL;
ALTER TABLE public.essays REPLICA IDENTITY FULL;
ALTER TABLE public.flashcards REPLICA IDENTITY FULL;
ALTER TABLE public.simulados REPLICA IDENTITY FULL;
ALTER TABLE public.question_attempts REPLICA IDENTITY FULL;
ALTER TABLE public.schedule_items REPLICA IDENTITY FULL;

-- Adiciona tabelas à publicação de realtime do Supabase (algumas podem já estar)
DO $$
BEGIN
  -- Tasks
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
  END IF;

  -- Notes
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'notes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
  END IF;

  -- Essays
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'essays'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.essays;
  END IF;

  -- Flashcards
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'flashcards'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.flashcards;
  END IF;

  -- Simulados
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'simulados'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.simulados;
  END IF;

  -- Question Attempts
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'question_attempts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.question_attempts;
  END IF;

  -- Schedule Items
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'schedule_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_items;
  END IF;
END $$;