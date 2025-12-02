-- Criar função security definer para verificar role do usuário
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = _user_id
$$;

-- Remover política problemática que causa recursão
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Recriar política usando a função security definer
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = id 
  OR public.get_user_role(auth.uid()) = 'admin'::user_role
);