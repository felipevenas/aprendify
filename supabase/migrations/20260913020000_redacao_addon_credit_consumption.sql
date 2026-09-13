-- Atomic consumption and idempotent reversal for Redação Combo credits.
-- Technical rollback: deploy the previous correct-essay function first, then
-- revoke/drop these RPCs and constraints. This does not restore consumed rows.
BEGIN;

ALTER TABLE public.essay_addon_credit_ledger
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS reversal_of uuid
    REFERENCES public.essay_addon_credit_ledger(id) ON DELETE RESTRICT;

ALTER TABLE public.essay_addon_credit_ledger
  DROP CONSTRAINT IF EXISTS essay_addon_credit_ledger_amount_check,
  DROP CONSTRAINT IF EXISTS essay_addon_credit_ledger_entry_type_check;

ALTER TABLE public.essay_addon_credit_ledger
  ADD CONSTRAINT essay_addon_credit_ledger_amount_check
    CHECK (amount <> 0 AND amount >= -1000000 AND amount <= 1000000),
  ADD CONSTRAINT essay_addon_credit_ledger_entry_type_check
    CHECK (entry_type IN ('grant', 'consume', 'refund'));

CREATE UNIQUE INDEX IF NOT EXISTS essay_addon_credit_ledger_idempotency_key_idx
  ON public.essay_addon_credit_ledger(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS essay_addon_credit_ledger_reversal_of_idx
  ON public.essay_addon_credit_ledger(reversal_of)
  WHERE reversal_of IS NOT NULL;

CREATE OR REPLACE FUNCTION public.consume_essay_addon_credit(
  _user_id uuid,
  _idempotency_key text
)
RETURNS TABLE(consumed boolean, idempotent boolean, balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing public.essay_addon_credit_ledger;
  _refunded boolean;
  _balance integer;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Credit consumption RPC is internal' USING ERRCODE = '42501';
  END IF;
  IF _user_id IS NULL OR _idempotency_key IS NULL
     OR _idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' THEN
    RAISE EXCEPTION 'Invalid credit consumption' USING ERRCODE = '22023';
  END IF;

  -- Serialize balance check plus debit for the same user. Grants may race
  -- safely; two consumptions cannot both observe the same final credit.
  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text, 0));

  SELECT * INTO _existing
    FROM public.essay_addon_credit_ledger
   WHERE entry_type = 'consume' AND idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF _existing.user_id IS DISTINCT FROM _user_id THEN
      RAISE EXCEPTION 'Credit consumption idempotency conflict' USING ERRCODE = '23505';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.essay_addon_credit_ledger
       WHERE reversal_of = _existing.id
    ) INTO _refunded;
    SELECT GREATEST(COALESCE(SUM(amount), 0), 0)::integer
      INTO _balance
      FROM public.essay_addon_credit_ledger
     WHERE user_id = _user_id;
    RETURN QUERY SELECT NOT _refunded, true, _balance;
    RETURN;
  END IF;

  SELECT GREATEST(COALESCE(SUM(amount), 0), 0)::integer
    INTO _balance
    FROM public.essay_addon_credit_ledger
   WHERE user_id = _user_id;
  IF _balance < 1 THEN
    RETURN QUERY SELECT false, false, _balance;
    RETURN;
  END IF;

  INSERT INTO public.essay_addon_credit_ledger(
    user_id, benefit_code, source_event_id, amount, entry_type, idempotency_key
  ) VALUES (
    _user_id,
    'order_bump_redacao',
    'credit_consume:' || _idempotency_key,
    -1,
    'consume',
    _idempotency_key
  );

  RETURN QUERY SELECT true, false, _balance - 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_essay_addon_credit(
  _user_id uuid,
  _idempotency_key text
)
RETURNS TABLE(refunded boolean, idempotent boolean, balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _consumption public.essay_addon_credit_ledger;
  _refund public.essay_addon_credit_ledger;
  _balance integer;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Credit refund RPC is internal' USING ERRCODE = '42501';
  END IF;
  IF _user_id IS NULL OR _idempotency_key IS NULL
     OR _idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' THEN
    RAISE EXCEPTION 'Invalid credit refund' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text, 0));
  SELECT * INTO _consumption
    FROM public.essay_addon_credit_ledger
   WHERE entry_type = 'consume' AND idempotency_key = _idempotency_key;
  IF NOT FOUND OR _consumption.user_id IS DISTINCT FROM _user_id THEN
    RAISE EXCEPTION 'Credit consumption not found' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _refund
    FROM public.essay_addon_credit_ledger
   WHERE reversal_of = _consumption.id;
  IF FOUND THEN
    SELECT GREATEST(COALESCE(SUM(amount), 0), 0)::integer
      INTO _balance
      FROM public.essay_addon_credit_ledger
     WHERE user_id = _user_id;
    RETURN QUERY SELECT true, true, _balance;
    RETURN;
  END IF;

  INSERT INTO public.essay_addon_credit_ledger(
    user_id, benefit_code, source_event_id, amount, entry_type, reversal_of
  ) VALUES (
    _user_id,
    'order_bump_redacao',
    'credit_refund:' || _idempotency_key,
    1,
    'refund',
    _consumption.id
  );

  SELECT GREATEST(COALESCE(SUM(amount), 0), 0)::integer
    INTO _balance
    FROM public.essay_addon_credit_ledger
   WHERE user_id = _user_id;
  RETURN QUERY SELECT true, false, _balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_essay_addon_credit_balance(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(COALESCE(SUM(amount), 0), 0)::integer
    FROM public.essay_addon_credit_ledger
   WHERE user_id = _user_id;
$$;

REVOKE ALL ON FUNCTION public.consume_essay_addon_credit(uuid, text), public.refund_essay_addon_credit(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_essay_addon_credit(uuid, text), public.refund_essay_addon_credit(uuid, text)
  TO service_role;

COMMIT;
