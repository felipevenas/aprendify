-- Habilitar REPLICA IDENTITY FULL para captura completa de dados em atualizações
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.subjects REPLICA IDENTITY FULL;
ALTER TABLE public.notes REPLICA IDENTITY FULL;
ALTER TABLE public.schedule_items REPLICA IDENTITY FULL;
ALTER TABLE public.questions REPLICA IDENTITY FULL;

-- Adicionar tabelas à publicação supabase_realtime (exceto notes e questions que já estão)
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subjects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_items;