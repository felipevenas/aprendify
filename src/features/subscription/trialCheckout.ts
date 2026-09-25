import type { TrialStatus } from "./premiumSnapshot";

/** Whether the authenticated account may be offered the one-time trial CTA. */
export function canActivateTrial(
  trialStatus: TrialStatus,
  isSubscribed: boolean,
  isAuthenticated: boolean,
  hasVerifiedEntitlement: boolean,
): boolean {
  return hasVerifiedEntitlement && isAuthenticated && trialStatus === "not_started" && !isSubscribed;
}

/** Do not present a failed or unverified checkout as an ordinary free account. */
export function canShowFreeSubscription(
  hasVerifiedEntitlement: boolean,
  hasPendingTrialConfirmation: boolean,
  isPremium: boolean,
  isSubscribed: boolean,
): boolean {
  return hasVerifiedEntitlement && !hasPendingTrialConfirmation && !isPremium && !isSubscribed;
}

/** Keep Stripe return parsing independent from React Router and the browser. */
export function readTrialReturn(search: URLSearchParams): { sessionId: string | null; cancelled: boolean } {
  const value = search.get("trial_session");
  return {
    sessionId: value && /^cs_[A-Za-z0-9_]+$/.test(value) ? value : null,
    cancelled: search.get("trial") === "cancelled",
  };
}
