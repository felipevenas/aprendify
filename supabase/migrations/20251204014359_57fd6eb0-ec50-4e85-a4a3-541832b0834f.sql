-- Permite que administradores insiram subscriptions
CREATE POLICY "Admins can insert subscriptions"
ON public.subscriptions
FOR INSERT
TO authenticated
WITH CHECK (get_user_role(auth.uid()) = 'admin'::user_role);

-- Permite que administradores atualizem subscriptions
CREATE POLICY "Admins can update subscriptions"
ON public.subscriptions
FOR UPDATE
TO authenticated
USING (get_user_role(auth.uid()) = 'admin'::user_role);