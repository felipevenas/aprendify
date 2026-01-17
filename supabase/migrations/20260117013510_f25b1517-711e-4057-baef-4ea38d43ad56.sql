-- Create rate limits tracking table for AI-powered edge functions
CREATE TABLE public.ai_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  function_name text NOT NULL,
  calls_count integer NOT NULL DEFAULT 0,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, function_name)
);

-- Enable RLS
ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can only see their own rate limit records
CREATE POLICY "Users can view their own rate limits"
ON public.ai_rate_limits
FOR SELECT
USING (auth.uid() = user_id);

-- Service role can manage all rate limits (for edge functions)
CREATE POLICY "Service role can manage rate limits"
ON public.ai_rate_limits
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_ai_rate_limits_user_function ON public.ai_rate_limits(user_id, function_name);
CREATE INDEX idx_ai_rate_limits_window ON public.ai_rate_limits(window_start);

-- Create trigger for updated_at
CREATE TRIGGER update_ai_rate_limits_updated_at
BEFORE UPDATE ON public.ai_rate_limits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to check and increment rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _user_id uuid,
  _function_name text,
  _max_calls integer DEFAULT 10,
  _window_minutes integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window_start timestamp with time zone;
  _current_count integer;
BEGIN
  _window_start := now() - (_window_minutes || ' minutes')::interval;
  
  -- Try to get existing record
  SELECT calls_count INTO _current_count
  FROM public.ai_rate_limits
  WHERE user_id = _user_id 
    AND function_name = _function_name
    AND window_start > _window_start
  FOR UPDATE;
  
  IF NOT FOUND THEN
    -- Create new record, resetting the window
    INSERT INTO public.ai_rate_limits (user_id, function_name, calls_count, window_start)
    VALUES (_user_id, _function_name, 1, now())
    ON CONFLICT (user_id, function_name) 
    DO UPDATE SET 
      calls_count = 1,
      window_start = now(),
      updated_at = now();
    RETURN TRUE;
  END IF;
  
  -- Check if limit exceeded
  IF _current_count >= _max_calls THEN
    RETURN FALSE;
  END IF;
  
  -- Increment counter
  UPDATE public.ai_rate_limits
  SET calls_count = calls_count + 1,
      updated_at = now()
  WHERE user_id = _user_id 
    AND function_name = _function_name;
  
  RETURN TRUE;
END;
$$;