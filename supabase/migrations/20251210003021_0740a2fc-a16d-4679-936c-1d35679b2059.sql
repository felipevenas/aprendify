-- Remove MercadoPago columns from subscriptions table
ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS mercadopago_subscription_id;
ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS mercadopago_payer_email;