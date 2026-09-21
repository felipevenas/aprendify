-- O trigger de cadastro já persiste o ano de prova pretendido enviado pelo
-- formulário, mas a coluna não existia em todos os ambientes migrados.
-- Mantém o campo opcional e compatível com o contrato atual da aplicação.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS target_exam_year TEXT;

COMMENT ON COLUMN public.profiles.target_exam_year IS 'Ano da prova pretendida informado no cadastro';
