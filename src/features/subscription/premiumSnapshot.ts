export type TrialStatus = "not_started" | "active" | "expired" | "ineligible";
export const FREE_DAILY_QUESTION_LIMIT = 10;
export const FREE_MONTHLY_ESSAY_LIMIT = 1;
type RecordValue = Record<string, unknown>;

const asRecord = (value: unknown): RecordValue => (
  value !== null && typeof value === "object" ? value as RecordValue : {}
);

const firstRecord = (...values: unknown[]): RecordValue => values
  .map(asRecord)
  .find((value) => Object.keys(value).length > 0) ?? {};

const getFiniteNonNegative = (...values: unknown[]): number | null => {
  const value = values.find((candidate) => (
    typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0
  ));
  return typeof value === "number" ? Math.floor(value) : null;
};

export interface PremiumSnapshot {
  isSubscribed: boolean;
  hasPremiumAccess: boolean;
  trialStatus: TrialStatus;
  trialEndsAt: string | null;
  planType: string | null;
  subscriptionEnd: string | null;
  dailyQuestionLimit: number | null;
  monthlyEssayLimit: number | null;
  dailyQuestionCount: number | null;
  tier: string | null;
}

export function readPremiumSnapshot(payload: RecordValue): PremiumSnapshot | null {
  if (typeof payload.subscribed !== "boolean") return null;

  const entitlements = asRecord(payload.entitlements);
  const limits = firstRecord(payload.limits, payload.quota, entitlements.limits);
  const usage = firstRecord(payload.usage, entitlements.usage);
  const trialStatus: TrialStatus = payload.trial_status === "not_started" || payload.trial_status === "eligible"
    || payload.trial_status === "active"
    || payload.trial_status === "expired"
    || payload.trial_status === "ineligible" || payload.trial_status === "not_eligible"
    ? payload.trial_status === "eligible" ? "not_started"
      : payload.trial_status === "not_eligible" ? "ineligible"
        : payload.trial_status
    : "ineligible";
  const isSubscribed = payload.subscribed;
  const hasPremiumAccess = typeof payload.has_premium_access === "boolean"
    ? payload.has_premium_access
    : isSubscribed;
  const isTrialActive = trialStatus === "active";
  const dailyQuestionLimit = getFiniteNonNegative(
    limits.daily_questions,
    limits.dailyQuestionLimit,
    limits.questions_per_day,
    payload.daily_question_limit,
  );
  const monthlyEssayLimit = getFiniteNonNegative(
    limits.monthly_essays,
    limits.monthlyEssayLimit,
    limits.essays_per_month,
    payload.monthly_essay_limit,
  );
  const dailyQuestionCount = getFiniteNonNegative(
    usage.daily_questions,
    usage.dailyQuestionCount,
    payload.daily_question_count,
  );

  return {
    isSubscribed,
    hasPremiumAccess,
    trialStatus,
    trialEndsAt: typeof payload.trial_ends_at === "string" ? payload.trial_ends_at : null,
    // The backend deliberately returns a null plan_type during trial. Never infer
    // paid status from the effective access tier.
    planType: isTrialActive && !isSubscribed ? null : typeof payload.plan_type === "string" ? payload.plan_type : null,
    subscriptionEnd: typeof payload.subscription_end === "string" ? payload.subscription_end : null,
    dailyQuestionLimit: dailyQuestionLimit ?? (hasPremiumAccess ? null : FREE_DAILY_QUESTION_LIMIT),
    monthlyEssayLimit: monthlyEssayLimit ?? FREE_MONTHLY_ESSAY_LIMIT,
    dailyQuestionCount,
    tier: typeof payload.tier === "string"
      ? payload.tier
      : typeof entitlements.tier === "string" ? entitlements.tier : null,
  };
}
