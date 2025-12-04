-- Enable REPLICA IDENTITY FULL for real-time updates on subscriptions table
ALTER TABLE public.subscriptions REPLICA IDENTITY FULL;

-- Add subscriptions table to realtime publication for live badge updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;