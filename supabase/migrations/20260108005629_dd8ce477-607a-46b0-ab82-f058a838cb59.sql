-- Allow admins to view all subscriptions
CREATE POLICY "Admins can view all subscriptions"
ON public.subscriptions
FOR SELECT
USING (get_user_role(auth.uid()) = 'admin'::user_role);