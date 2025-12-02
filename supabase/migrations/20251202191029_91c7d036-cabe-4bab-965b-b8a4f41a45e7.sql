-- Complete security fix: Roles table and policy migration

-- Step 1: Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role user_role NOT NULL DEFAULT 'user'::user_role,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Step 2: Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 3: Create RLS policies for user_roles (very restrictive)
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Step 4: Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, role FROM public.profiles
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 5: Create the has_role security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Step 6: Update get_user_role function to use user_roles table
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Step 7: Update handle_new_user trigger to insert into user_roles instead
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into profiles without role
  INSERT INTO public.profiles (id, email, full_name, username, phone, birthdate)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'phone',
    CASE 
      WHEN NEW.raw_user_meta_data->>'birthdate' IS NOT NULL 
      THEN (NEW.raw_user_meta_data->>'birthdate')::DATE 
      ELSE NULL 
    END
  );
  
  -- Insert default role into user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::user_role);
  
  RETURN NEW;
END;
$$;

-- Step 8: Drop the old storage policy that depends on profiles.role
DROP POLICY IF EXISTS "Admins can upload enem images" ON storage.objects;

-- Step 9: Create new storage policy using has_role function
CREATE POLICY "Admins can upload enem images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'enem-images' 
  AND public.has_role(auth.uid(), 'admin'::user_role)
);

-- Step 10: Now safely drop the role column from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;