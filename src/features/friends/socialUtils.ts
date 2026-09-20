import type {
  FocusChallengeAction,
  FocusChallengeStatus,
  FriendshipAction,
  FriendshipStatus,
  FriendMessage,
  SocialNotification,
} from "./types";

export const PRESENCE_HEARTBEAT_MS = 30_000;
export const PRESENCE_TIMEOUT_MS = 90_000;

export function normalizeSocialQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 80);
}

export function canSendFriendRequest(actorId: string, targetId: string, status?: FriendshipStatus): boolean {
  return actorId.length > 0 && targetId.length > 0 && actorId !== targetId && status !== "pending" && status !== "accepted" && status !== "blocked";
}

export function canRunFriendshipAction(status: FriendshipStatus, action: FriendshipAction): boolean {
  if (action === "accept" || action === "decline" || action === "cancel") return status === "pending";
  if (action === "remove") return status === "accepted";
  return status !== "blocked";
}

export function countUnreadMessages(messages: Pick<FriendMessage, "readAt" | "recipientId">[], currentUserId: string): number {
  return messages.filter((message) => message.recipientId === currentUserId && !message.readAt).length;
}

export function countUnreadSocialNotifications(notifications: Pick<SocialNotification, "readAt">[]): number {
  return notifications.filter((notification) => !notification.readAt).length;
}

export function getSocialDisplayName(fullName: string | null, username: string | null): string {
  return fullName?.trim() || username?.trim() || "Estudante";
}

export function getSocialInitials(fullName: string | null, username: string | null): string {
  const name = getSocialDisplayName(fullName, username);
  const parts = name.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : name.slice(0, 2)).toUpperCase();
}

export function isPresenceOnline(isOnline: boolean, lastSeenAt: string, now = Date.now()): boolean {
  return isOnline && now - new Date(lastSeenAt).getTime() <= PRESENCE_TIMEOUT_MS;
}

export function canRunChallengeAction(status: FocusChallengeStatus, action: FocusChallengeAction): boolean {
  if (action === "accept" || action === "decline") return status === "pending";
  if (action === "cancel") return status === "pending" || status === "accepted";
  if (action === "start") return status === "accepted";
  return status === "accepted" || status === "active";
}

export function getChallengeStatusLabel(status: FocusChallengeStatus): string {
  const labels: Record<FocusChallengeStatus, string> = {
    pending: "Aguardando resposta",
    accepted: "Pronto para começar",
    active: "Em foco",
    completed: "Concluído",
    declined: "Recusado",
    expired: "Expirado",
    cancelled: "Cancelado",
  };
  return labels[status];
}
