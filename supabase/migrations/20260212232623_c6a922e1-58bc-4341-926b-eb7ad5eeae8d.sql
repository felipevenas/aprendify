-- Allow creators to update their own PIX key data
CREATE POLICY "Creators can update their own pix key"
ON public.creator_coupons
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);