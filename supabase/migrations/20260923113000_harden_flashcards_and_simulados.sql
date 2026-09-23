-- Enforce the free flashcard cap and Premium access for mock exams at the DB edge.
-- Technical rollback: restore the prior owner-only FOR ALL policies, then remove
-- the flashcard trigger function and index. Keep the strengthened trial constraint:
-- it preserves valid rows and closes a NULL-check loophole. No rows are deleted.
BEGIN;

-- CHECK treats NULL as passing unless completeness is stated explicitly.
-- Replace the original pair constraint with an explicit complete-pair rule.
ALTER TABLE public.free_trial_entitlements
  DROP CONSTRAINT IF EXISTS free_trial_start_end_pair,
  ADD CONSTRAINT free_trial_start_end_pair CHECK (
    (started_at IS NULL AND ends_at IS NULL)
    OR (
      started_at IS NOT NULL
      AND ends_at IS NOT NULL
      AND ends_at = started_at + interval '72 hours'
    )
  );

-- The counter is user-scoped and used on every free insert; keep that lookup indexed.
CREATE INDEX IF NOT EXISTS idx_flashcards_user_id
  ON public.flashcards(user_id);

CREATE OR REPLACE FUNCTION public.enforce_free_flashcard_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _current_count integer;
BEGIN
  -- Server-owned imports are not user-created flashcards.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF _user_id IS NULL OR NEW.user_id IS DISTINCT FROM _user_id THEN
    RAISE EXCEPTION 'Flashcard owner does not match authenticated user'
      USING ERRCODE = '42501';
  END IF;

  IF public.is_user_premium(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Serialize free inserts for the same account before counting. The row lock
  -- is shared with other per-user resource gates and leaves other accounts parallel.
  PERFORM 1 FROM public.profiles WHERE id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Flashcard owner profile unavailable' USING ERRCODE = '23503';
  END IF;

  SELECT count(*)::integer INTO _current_count
    FROM public.flashcards
   WHERE user_id = _user_id;

  IF _current_count >= 10 THEN
    RAISE EXCEPTION 'FLASHCARD_FREE_LIMIT_REACHED'
      USING ERRCODE = 'P0001', DETAIL = 'Free users can own up to 10 flashcards';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_free_flashcard_limit() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS enforce_free_flashcard_limit ON public.flashcards;
CREATE TRIGGER enforce_free_flashcard_limit
  BEFORE INSERT ON public.flashcards
  FOR EACH ROW EXECUTE FUNCTION public.enforce_free_flashcard_limit();

-- Split the former FOR ALL policy so entitlement gates writes while existing
-- users retain access to their own saved data and can delete it after trial expiry.
DROP POLICY IF EXISTS "Users can manage their own flashcards" ON public.flashcards;
CREATE POLICY "Users can view their own flashcards"
  ON public.flashcards FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own flashcards"
  ON public.flashcards FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own flashcards"
  ON public.flashcards FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own flashcards"
  ON public.flashcards FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- A user must have active paid/trial Premium to create or continue a simulado.
-- Read access and deletion remain available to preserve history and cleanup.
DROP POLICY IF EXISTS "Users can manage their own simulados" ON public.simulados;
CREATE POLICY "Users can view their own simulados"
  ON public.simulados FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Premium users can create their own simulados"
  ON public.simulados FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_user_premium(auth.uid()));
CREATE POLICY "Premium users can update their own simulados"
  ON public.simulados FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.is_user_premium(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND public.is_user_premium(auth.uid()));
CREATE POLICY "Users can delete their own simulados"
  ON public.simulados FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own simulado answers" ON public.simulado_answers;
CREATE POLICY "Users can view their own simulado answers"
  ON public.simulado_answers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.simulados s
       WHERE s.id = simulado_answers.simulado_id AND s.user_id = auth.uid()
    )
  );
CREATE POLICY "Premium users can insert their own simulado answers"
  ON public.simulado_answers FOR INSERT TO authenticated
  WITH CHECK (
    public.is_user_premium(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.simulados s
       WHERE s.id = simulado_answers.simulado_id AND s.user_id = auth.uid()
    )
  );
CREATE POLICY "Premium users can update their own simulado answers"
  ON public.simulado_answers FOR UPDATE TO authenticated
  USING (
    public.is_user_premium(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.simulados s
       WHERE s.id = simulado_answers.simulado_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_user_premium(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.simulados s
       WHERE s.id = simulado_answers.simulado_id AND s.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete their own simulado answers"
  ON public.simulado_answers FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.simulados s
       WHERE s.id = simulado_answers.simulado_id AND s.user_id = auth.uid()
    )
  );

-- Results are read-only to clients; analyze-simulado persists them with the
-- server's service role after checking entitlement and ownership.
DROP POLICY IF EXISTS "Users can view their own simulado results" ON public.simulado_results;
CREATE POLICY "Users can view their own simulado results"
  ON public.simulado_results FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.simulados s
       WHERE s.id = simulado_results.simulado_id AND s.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete their own simulado results"
  ON public.simulado_results FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.simulados s
       WHERE s.id = simulado_results.simulado_id AND s.user_id = auth.uid()
    )
  );

COMMIT;
