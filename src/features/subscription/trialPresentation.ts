import type { TrialStatus } from "./premiumSnapshot";

export type TrialNoticeState = "active" | "expired";

/** Only the server status may switch an active trial notice to expired. */
export function getTrialNoticeState(status: TrialStatus): TrialNoticeState | null {
  if (status === "expired") return "expired";
  if (status !== "active") return null;
  return "active";
}

export function formatTrialDeadline(endsAt: string | null): string | null {
  if (!endsAt) return null;
  const date = new Date(endsAt);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}
