export const trialConfirmationStripeOptions = {
  apiVersion: "2025-08-27.basil",
  maxNetworkRetries: 1,
  timeout: 15_000,
} as const;

export type TrialConfirmationStage =
  | "authentication"
  | "rate_limit"
  | "request_validation"
  | "stripe_session"
  | "stripe_subscription_customer"
  | "snapshot_validation"
  | "activation";

const safeStages = new Set<TrialConfirmationStage>([
  "authentication",
  "rate_limit",
  "request_validation",
  "stripe_session",
  "stripe_subscription_customer",
  "snapshot_validation",
  "activation",
]);

export function trialConfirmationDiagnostic(stage: string, code: unknown): string {
  const safeStage = safeStages.has(stage as TrialConfirmationStage) ? stage : "unknown";
  const safeCode = typeof code === "string" && /^[A-Z0-9_]{1,80}$/.test(code)
    ? code
    : "TRIAL_CONFIRMATION_UNAVAILABLE";
  return `stage=${safeStage} code=${safeCode}`;
}
