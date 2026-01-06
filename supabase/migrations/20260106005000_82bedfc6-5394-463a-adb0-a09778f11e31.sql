-- Add 'creator' to plan_type enum
ALTER TYPE public.plan_type ADD VALUE IF NOT EXISTS 'creator';

-- Create table for creator coupons
CREATE TABLE public.creator_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coupon_code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create table to track coupon usage
CREATE TABLE public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.creator_coupons(id) ON DELETE CASCADE,
  redeemed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(coupon_id, redeemed_by)
);

-- Enable RLS
ALTER TABLE public.creator_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- RLS policies for creator_coupons
CREATE POLICY "Creators can view their own coupons"
ON public.creator_coupons
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage creator coupons"
ON public.creator_coupons
FOR ALL
USING (get_user_role(auth.uid()) = 'admin')
WITH CHECK (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Anyone can read active coupons by code"
ON public.creator_coupons
FOR SELECT
USING (is_active = true);

-- RLS policies for coupon_redemptions
CREATE POLICY "Creators can view their coupon redemptions"
ON public.coupon_redemptions
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.creator_coupons
  WHERE creator_coupons.id = coupon_redemptions.coupon_id
  AND creator_coupons.user_id = auth.uid()
));

CREATE POLICY "Admins can manage coupon redemptions"
ON public.coupon_redemptions
FOR ALL
USING (get_user_role(auth.uid()) = 'admin')
WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Trigger for updated_at on creator_coupons
CREATE TRIGGER update_creator_coupons_updated_at
BEFORE UPDATE ON public.creator_coupons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();