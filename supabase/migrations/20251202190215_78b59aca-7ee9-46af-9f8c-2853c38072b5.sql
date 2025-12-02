-- Drop the existing overly permissive INSERT policy
DROP POLICY IF EXISTS "Service role can insert enem questions" ON public.enem_questions;

-- Create a new policy that only allows admins to insert ENEM questions
CREATE POLICY "Admins can insert enem questions"
ON public.enem_questions
FOR INSERT
TO authenticated
WITH CHECK (get_user_role(auth.uid()) = 'admin'::user_role);