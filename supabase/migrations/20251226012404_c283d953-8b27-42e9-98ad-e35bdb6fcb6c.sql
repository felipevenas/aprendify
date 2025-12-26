-- Habilita REPLICA IDENTITY FULL para capturar dados completos em updates
ALTER TABLE public.user_streaks REPLICA IDENTITY FULL;

-- Adiciona a tabela user_streaks à publicação de realtime do Supabase
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_streaks;