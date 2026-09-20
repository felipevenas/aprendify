export type ProfileTab =
  | "profile"
  | "statistics"
  | "subscription"
  | "security"
  | "preferences"
  | "admin";

export const PROFILE_TABS: readonly ProfileTab[] = [
  "profile",
  "statistics",
  "subscription",
  "security",
  "preferences",
  "admin",
];

export function getProfileTab(value: string | null, isAdmin = false): ProfileTab {
  if (!value || !PROFILE_TABS.includes(value as ProfileTab)) return "profile";
  if (value === "admin" && !isAdmin) return "profile";
  return value as ProfileTab;
}
