-- Update SECURITY DEFINER functions to add authorization checks
-- Users can only query their own data unless they are admins

-- Update is_user_premium function
CREATE OR REPLACE FUNCTION public.is_user_premium(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow querying own data or if caller is admin
  IF _user_id != auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN FALSE; -- Return false instead of exception for premium check
  END IF;
  
  RETURN EXISTS (
    SELECT 1
    FROM public.subscriptions
    WHERE user_id = _user_id
      AND status = 'authorized'
      AND (end_date IS NULL OR end_date > NOW())
  );
END;
$$;

-- Update get_daily_question_count function
CREATE OR REPLACE FUNCTION public.get_daily_question_count(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow querying own data or if caller is admin
  IF _user_id != auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN 0; -- Return 0 instead of exception
  END IF;
  
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM public.question_attempts
    WHERE user_id = _user_id
      AND created_at >= CURRENT_DATE
  );
END;
$$;

-- Update get_user_flashcard_count function
CREATE OR REPLACE FUNCTION public.get_user_flashcard_count(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow querying own data or if caller is admin
  IF _user_id != auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN 0; -- Return 0 instead of exception
  END IF;
  
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM public.flashcards
    WHERE user_id = _user_id
  );
END;
$$;

-- Update get_monthly_essay_count function
CREATE OR REPLACE FUNCTION public.get_monthly_essay_count(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow querying own data or if caller is admin
  IF _user_id != auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN 0; -- Return 0 instead of exception
  END IF;
  
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM public.essays
    WHERE user_id = _user_id
      AND created_at >= date_trunc('month', CURRENT_DATE)
  );
END;
$$;

-- Update get_user_role function
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS user_role
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow querying own data or if caller is admin
  IF _user_id != auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN NULL; -- Return NULL instead of exception
  END IF;
  
  RETURN (
    SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
  );
END;
$$;