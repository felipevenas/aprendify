export const webhookStripeOptions = {
  apiVersion: "2025-08-27.basil",
  maxNetworkRetries: 1,
  timeout: 15_000,
} as const;

export type WebhookFailureStage =
  | "configuration"
  | "signature"
  | "inbox_claim"
  | "process_event"
  | "complete_event"
  | "failure_recording";

const safeStages = new Set<WebhookFailureStage>([
  "configuration",
  "signature",
  "inbox_claim",
  "process_event",
  "complete_event",
  "failure_recording",
]);

export function webhookFailureDiagnostic(stage: string, code: unknown): string {
  const safeStage = safeStages.has(stage) ? stage : "unknown";
  const safeCode = typeof code === "string" && /^[A-Z0-9_]{1,80}$/.test(code)
    ? code
    : "PROCESSING_FAILED";
  return `stage=${safeStage} code=${safeCode}`;
}
