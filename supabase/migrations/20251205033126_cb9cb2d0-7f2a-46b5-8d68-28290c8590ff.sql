-- Create enum for plan types
CREATE TYPE public.plan_type AS ENUM ('monthly', 'annual', 'god');

-- Add plan_type column to subscriptions table
ALTER TABLE public.subscriptions 
ADD COLUMN plan_type plan_type DEFAULT 'monthly';