-- PR #16 first exposed the trial feature on 2026-09-23 22:24:52 UTC. The
-- corresponding database migrations were not applied in production, so users
-- created after that merge missed the auth.users eligibility trigger. Restore
-- eligibility only for that cohort; the regular trigger covers future users.
-- This is intentionally an eligibility repair, not trial activation.
-- Technical rollback: delete only rows with started_at IS NULL and user_id in
-- this backfill cohort after reviewing provenance. Activated trial history
-- requires a forward repair or backup restore; do not delete it blindly.
BEGIN;

INSERT INTO public.free_trial_entitlements (user_id)
SELECT u.id
  FROM auth.users u
 WHERE u.created_at >= timestamptz '2026-09-23 22:24:52+00'
   AND NOT EXISTS (
     SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = u.id
        AND s.status = 'authorized'
        AND (s.end_date IS NULL OR s.end_date > now())
   )
ON CONFLICT (user_id) DO NOTHING;

COMMIT;
