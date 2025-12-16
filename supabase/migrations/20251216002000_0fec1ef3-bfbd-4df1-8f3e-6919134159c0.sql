-- Add completed column to schedule_items for check-in system
ALTER TABLE public.schedule_items 
ADD COLUMN IF NOT EXISTS completed boolean DEFAULT false;

-- Add completed_at timestamp
ALTER TABLE public.schedule_items 
ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;