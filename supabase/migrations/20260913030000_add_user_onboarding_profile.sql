-- Perfil inicial para personalizar a experiência de estudo.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS primeiro_acesso BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tempo_estudo TEXT,
  ADD COLUMN IF NOT EXISTS media_atual TEXT,
  ADD COLUMN IF NOT EXISTS curso_pretendido TEXT,
  ADD COLUMN IF NOT EXISTS faculdade_desejada TEXT,
  ADD COLUMN IF NOT EXISTS maiores_dificuldades TEXT[];

-- Não interrompe usuários que já possuem conta antes deste onboarding.
UPDATE public.profiles
SET primeiro_acesso = false
WHERE primeiro_acesso = true
  AND created_at < now();

COMMENT ON COLUMN public.profiles.primeiro_acesso IS 'Indica se o usuário ainda precisa concluir o formulário inicial.';
COMMENT ON COLUMN public.profiles.tempo_estudo IS 'Faixa de tempo de estudo semanal informada no onboarding.';
COMMENT ON COLUMN public.profiles.media_atual IS 'Faixa de média atual informada pelo usuário.';
COMMENT ON COLUMN public.profiles.maiores_dificuldades IS 'Disciplinas ou áreas em que o usuário sente mais dificuldade.';
