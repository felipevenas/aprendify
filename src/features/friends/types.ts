export type FriendshipStatus = "pending" | "accepted" | "declined" | "blocked";
export type FriendshipAction = "accept" | "decline" | "cancel" | "remove" | "block";

export type FocusChallengeStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "active"
  | "completed"
  | "expired"
  | "cancelled";

export type FocusChallengeAction = "accept" | "decline" | "cancel" | "start" | "complete";

export interface SocialProfile {
  id: string;
  username: string | null;
  fullName: string | null;
  isOnline?: boolean;
  friendshipId?: string;
  createdAt?: string;
}

export interface FriendRequest extends SocialProfile {
  friendshipId: string;
  createdAt: string;
}

export interface FriendMessage {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface FocusChallenge {
  id: string;
  creatorId: string;
  inviteeId: string;
  durationMinutes: 15 | 25 | 50;
  status: FocusChallengeStatus;
  creatorCompletedAt: string | null;
  inviteeCompletedAt: string | null;
  acceptedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string;
  createdAt: string;
  creatorName: string;
  inviteeName: string;
}

export interface SocialNotification {
  id: string;
  actorId: string | null;
  actorName: string;
  notificationType: "friend_request" | "friend_accepted" | "message" | "challenge_invite" | "challenge_update";
  entityId: string | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}
