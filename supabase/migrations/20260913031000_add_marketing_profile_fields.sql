ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS current_situation TEXT,
  ADD COLUMN IF NOT EXISTS main_goal TEXT,
  ADD COLUMN IF NOT EXISTS study_preference TEXT,
  ADD COLUMN IF NOT EXISTS signup_source TEXT,
  ADD COLUMN IF NOT EXISTS accepts_marketing BOOLEAN NOT NULL DEFAULT false;

-- Mantém o trigger de cadastro alinhado com os campos opcionais enviados pelo formulário.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, username, phone, birthdate,
    city, state, current_situation, main_goal, target_exam_year,
    study_preference, signup_source, accepts_marketing
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'phone',
    CASE WHEN NEW.raw_user_meta_data->>'birthdate' IS NOT NULL THEN (NEW.raw_user_meta_data->>'birthdate')::DATE ELSE NULL END,
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'state',
    NEW.raw_user_meta_data->>'current_situation',
    NEW.raw_user_meta_data->>'main_goal',
    NEW.raw_user_meta_data->>'target_exam_year',
    NEW.raw_user_meta_data->>'study_preference',
    NEW.raw_user_meta_data->>'signup_source',
    COALESCE((NEW.raw_user_meta_data->>'accepts_marketing')::BOOLEAN, false)
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::user_role);
  RETURN NEW;
END;
$$;
