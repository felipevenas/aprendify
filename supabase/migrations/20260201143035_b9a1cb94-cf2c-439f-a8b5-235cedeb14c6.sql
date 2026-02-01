-- Fix the function search path warning
CREATE OR REPLACE FUNCTION public.get_current_week_start()
RETURNS DATE AS $$
BEGIN
  RETURN date_trunc('week', CURRENT_DATE)::DATE;
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public;