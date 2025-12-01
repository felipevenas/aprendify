-- Adiciona novos campos ao perfil do usuário para cadastro completo
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS birthdate DATE,
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Cria índice para otimizar busca por username
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- Adiciona comentários para documentação
COMMENT ON COLUMN public.profiles.phone IS 'Número de telefone do usuário';
COMMENT ON COLUMN public.profiles.birthdate IS 'Data de nascimento do usuário';
COMMENT ON COLUMN public.profiles.username IS 'Nome de usuário único para login';