import type { TrialStatus } from "./premiumSnapshot";

/** Whether the authenticated account may be offered the one-time trial CTA. */
export function canActivateTrial(trialStatus: TrialStatus, isSubscribed: boolean, isAuthenticated: boolean): boolean {
  return isAuthenticated && trialStatus === "not_started" && !isSubscribed;
}

/** Keep Stripe return parsing independent from React Router and the browser. */
export function readTrialReturn(search: URLSearchParams): { sessionId: string | null; cancelled: boolean } {
  const value = search.get("trial_session");
  return {
    sessionId: value && /^cs_[A-Za-z0-9_]+$/.test(value) ? value : null,
    cancelled: search.get("trial") === "cancelled",
  };
}
