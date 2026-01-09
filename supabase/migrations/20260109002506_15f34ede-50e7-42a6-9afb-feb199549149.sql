-- Add PIX key columns to creator_coupons table
ALTER TABLE public.creator_coupons
ADD COLUMN pix_key_type TEXT,
ADD COLUMN pix_key TEXT;

-- Add constraint for max 10 characters on coupon_code
ALTER TABLE public.creator_coupons
ADD CONSTRAINT coupon_code_max_length CHECK (char_length(coupon_code) <= 10);

-- Add constraint for valid pix_key_type values
ALTER TABLE public.creator_coupons
ADD CONSTRAINT valid_pix_key_type CHECK (pix_key_type IS NULL OR pix_key_type IN ('cpf', 'cnpj', 'email', 'phone', 'random'));