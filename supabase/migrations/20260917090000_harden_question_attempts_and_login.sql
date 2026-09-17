-- Corrige a integridade das tentativas e remove a enumeração de e-mails.
-- A pontuação passa a depender exclusivamente da questão armazenada no servidor.
BEGIN;

DROP POLICY IF EXISTS "Users can manage their own question attempts"
  ON public.question_attempts;

CREATE POLICY "Users can view their own question attempts"
  ON public.question_attempts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update feedback on their own question attempts"
  ON public.question_attempts
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS controla as linhas; estes grants controlam as colunas que podem ser
-- alteradas pelo cliente. Inserções passam exclusivamente pela RPC abaixo.
REVOKE INSERT, DELETE, UPDATE ON public.question_attempts FROM anon, authenticated;
GRANT SELECT ON public.question_attempts TO authenticated;
GRANT UPDATE (had_doubt, topic) ON public.question_attempts TO authenticated;

CREATE OR REPLACE FUNCTION public.record_question_attempt(
  _question_id text,
  _selected_answer text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _question public.enem_questions;
  _attempt_id uuid;
  _answer text := upper(trim(_selected_answer));
  _today_count integer;
  _recent_count integer;
  _is_premium boolean;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  IF _question_id IS NULL OR length(trim(_question_id)) > 128
     OR _answer !~ '^[A-E]$' THEN
    RAISE EXCEPTION 'INVALID_QUESTION_ATTEMPT' USING ERRCODE = '22023';
  END IF;

  -- Aceita o UUID novo e o identificador histórico ano-disciplina-índice.
  -- O conteúdo e o gabarito vêm sempre da questão confiável do banco.
  SELECT * INTO _question
    FROM public.enem_questions
   WHERE id::text = trim(_question_id)
      OR format('%s-%s-%s', year, discipline, index) = trim(_question_id)
   LIMIT 1;

  IF NOT FOUND OR COALESCE(_question.is_active, true) IS FALSE THEN
    RAISE EXCEPTION 'QUESTION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.subscriptions
     WHERE user_id = _user_id
       AND status = 'authorized'
       AND (end_date IS NULL OR end_date > now())
  ) INTO _is_premium;

  -- Serializa as respostas do mesmo usuário para fechar a corrida da quota.
  PERFORM 1 FROM public.profiles WHERE id = _user_id FOR UPDATE;

  SELECT count(*)::integer INTO _today_count
    FROM public.question_attempts
   WHERE user_id = _user_id
     AND created_at >= current_date;

  IF NOT _is_premium AND _today_count >= 10 THEN
    RAISE EXCEPTION 'DAILY_QUESTION_LIMIT' USING ERRCODE = 'P0003';
  END IF;

  -- Mesmo no Premium, rejeita rajadas acidentais ou automatizadas.
  SELECT count(*)::integer INTO _recent_count
    FROM public.question_attempts
   WHERE user_id = _user_id
     AND created_at >= now() - interval '1 minute';

  IF _recent_count >= 60 THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0004';
  END IF;

  INSERT INTO public.question_attempts (
    user_id,
    question_id,
    discipline,
    year,
    selected_answer,
    correct_answer,
    is_correct,
    language
  ) VALUES (
    _user_id,
    _question.id::text,
    _question.discipline,
    _question.year,
    _answer,
    upper(trim(_question.correct_alternative)),
    _answer = upper(trim(_question.correct_alternative)),
    _question.language
  )
  RETURNING id INTO _attempt_id;

  RETURN _attempt_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_question_attempt(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_question_attempt(text, text)
  TO authenticated;

-- O login por username agora deve ser resolvido no Edge Function de auth,
-- sem devolver profiles.email para o navegador.
REVOKE ALL ON FUNCTION public.resolve_login_email(text)
  FROM PUBLIC, anon, authenticated;

COMMIT;
