const TRIAL_SESSION_ID = /^cs_[A-Za-z0-9_]{8,255}$/;
export const POST_AUTH_REDIRECT_STORAGE_KEY = "aprendify:post-auth-redirect";

/** Resolve only explicitly supported post-auth destinations. */
export function getPostAuthRedirect(search: URLSearchParams): string {
  const requestedPlan = search.get("plano");
  const requestedBump = search.get("bump");
  const requestedCoupon = search.get("cupom");

  if (search.get("redirect") === "/planos" && (requestedPlan === "starter" || requestedPlan === "annual")) {
    const checkoutParams = new URLSearchParams({ plano: requestedPlan });
    if (requestedBump === "redacao") checkoutParams.set("bump", requestedBump);
    if (requestedCoupon) checkoutParams.set("cupom", requestedCoupon);
    return `/planos?${checkoutParams.toString()}`;
  }

  const trialSessionId = search.get("trial_session");
  if (search.get("redirect") === "/settings" && trialSessionId && TRIAL_SESSION_ID.test(trialSessionId)) {
    const returnParams = new URLSearchParams({ tab: "subscription", trial_session: trialSessionId });
    return `/settings?${returnParams.toString()}`;
  }

  return "/dashboard";
}

/** Return only the validated redirect query params to preserve after signup. */
export function getPostAuthRedirectParams(search: URLSearchParams): URLSearchParams {
  const destination = getPostAuthRedirect(search);
  const separatorIndex = destination.indexOf("?");
  if (separatorIndex < 0) return new URLSearchParams();

  const path = destination.slice(0, separatorIndex);
  const destinationParams = new URLSearchParams(destination.slice(separatorIndex + 1));
  const redirectParams = new URLSearchParams({ redirect: path });
  destinationParams.forEach((value, key) => redirectParams.set(key, value));
  return redirectParams;
}

/** Keep the Stripe return session when an expired user must authenticate again. */
export function getExpiredSessionRedirect(search: URLSearchParams): string {
  const trialSessionId = search.get("trial_session");
  if (!trialSessionId || !TRIAL_SESSION_ID.test(trialSessionId)) return "/auth";

  const authParams = new URLSearchParams({ redirect: "/settings", trial_session: trialSessionId });
  return `/auth?${authParams.toString()}`;
}

/** Validate a same-tab OAuth continuation before using it after the callback. */
export function getSafePostAuthRedirectTarget(target: string | null): string {
  if (!target) return "/dashboard";

  const separatorIndex = target.indexOf("?");
  const path = separatorIndex < 0 ? target : target.slice(0, separatorIndex);
  const params = new URLSearchParams(separatorIndex < 0 ? "" : target.slice(separatorIndex + 1));
  params.set("redirect", path);
  return getPostAuthRedirect(params);
}
