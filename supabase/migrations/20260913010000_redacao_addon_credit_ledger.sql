-- Server-owned ledger for the Redação Combo order bump.
-- Technical rollback: deploy callers rolled back first, then revoke/drop this
-- RPC/table. This does not restore rows removed by a data rollback.
BEGIN;

CREATE TABLE IF NOT EXISTS public.essay_addon_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  benefit_code text NOT NULL CHECK (benefit_code = 'order_bump_redacao'),
  source_event_id text NOT NULL UNIQUE,
  amount integer NOT NULL CHECK (amount > 0 AND amount <= 1000000),
  entry_type text NOT NULL DEFAULT 'grant' CHECK (entry_type = 'grant'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.essay_addon_credit_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.essay_addon_credit_ledger FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.essay_addon_credit_ledger TO authenticated;

CREATE POLICY "Users can view their own essay add-on credits"
  ON public.essay_addon_credit_ledger
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_essay_addon_credit_ledger_user_created
  ON public.essay_addon_credit_ledger(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.grant_essay_addon_credits(
  _source_event_id text,
  _user_id uuid,
  _amount integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing public.essay_addon_credit_ledger;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Credit grant RPC is internal' USING ERRCODE = '42501';
  END IF;
  IF _source_event_id IS NULL OR _source_event_id !~ '^evt_[A-Za-z0-9]+$'
     OR _user_id IS NULL OR _amount IS NULL OR _amount < 1 OR _amount > 1000000 THEN
    RAISE EXCEPTION 'Invalid credit grant' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.essay_addon_credit_ledger(
    user_id, benefit_code, source_event_id, amount
  ) VALUES (
    _user_id, 'order_bump_redacao', _source_event_id, _amount
  ) ON CONFLICT (source_event_id) DO NOTHING;

  IF FOUND THEN RETURN true; END IF;

  SELECT * INTO _existing
    FROM public.essay_addon_credit_ledger
   WHERE source_event_id = _source_event_id;
  IF _existing.user_id IS DISTINCT FROM _user_id
     OR _existing.amount IS DISTINCT FROM _amount
     OR _existing.benefit_code IS DISTINCT FROM 'order_bump_redacao' THEN
    RAISE EXCEPTION 'Credit grant idempotency conflict' USING ERRCODE = '23505';
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_essay_addon_credit_balance(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount), 0)::integer
    FROM public.essay_addon_credit_ledger
   WHERE user_id = _user_id;
$$;

REVOKE ALL ON FUNCTION public.grant_essay_addon_credits(text, uuid, integer), public.get_essay_addon_credit_balance(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_essay_addon_credits(text, uuid, integer), public.get_essay_addon_credit_balance(uuid)
  TO service_role;

COMMIT;
