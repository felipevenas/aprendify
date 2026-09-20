import { supabase } from "@/integrations/supabase/client";
import { normalizeSocialQuery } from "../socialUtils";
import type {
  FocusChallenge,
  FocusChallengeAction,
  FriendMessage,
  FriendRequest,
  SocialNotification,
  SocialProfile,
} from "../types";

const mapProfile = (profile: { id?: string; user_id?: string; username: string | null; full_name: string | null; is_online?: boolean; friendship_id?: string; created_at?: string }): SocialProfile => ({
  id: profile.id ?? profile.user_id ?? "",
  username: profile.username,
  fullName: profile.full_name,
  isOnline: profile.is_online,
  friendshipId: profile.friendship_id,
  createdAt: profile.created_at,
});

const mapMessage = (message: { id: string; sender_id: string; recipient_id: string; body: string; read_at: string | null; created_at: string }): FriendMessage => ({
  id: message.id,
  senderId: message.sender_id,
  recipientId: message.recipient_id,
  body: message.body,
  readAt: message.read_at,
  createdAt: message.created_at,
});

const mapChallenge = (challenge: {
  id: string;
  creator_id: string;
  invitee_id: string;
  duration_minutes: number;
  status: string;
  creator_completed_at: string | null;
  invitee_completed_at: string | null;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string;
  created_at: string;
  creator_name: string;
  invitee_name: string;
}): FocusChallenge => ({
  id: challenge.id,
  creatorId: challenge.creator_id,
  inviteeId: challenge.invitee_id,
  durationMinutes: challenge.duration_minutes as FocusChallenge["durationMinutes"],
  status: challenge.status as FocusChallenge["status"],
  creatorCompletedAt: challenge.creator_completed_at,
  inviteeCompletedAt: challenge.invitee_completed_at,
  acceptedAt: challenge.accepted_at,
  startedAt: challenge.started_at,
  completedAt: challenge.completed_at,
  expiresAt: challenge.expires_at,
  createdAt: challenge.created_at,
  creatorName: challenge.creator_name,
  inviteeName: challenge.invitee_name,
});

export const friendsService = {
  async searchUsers(query: string): Promise<SocialProfile[]> {
    const normalized = normalizeSocialQuery(query);
    if (normalized.length < 2) return [];
    const { data, error } = await supabase.rpc("social_search_users", { _query: normalized });
    if (error) throw error;
    return (data ?? []).map(mapProfile);
  },

  async listFriends(): Promise<SocialProfile[]> {
    const { data, error } = await supabase.rpc("social_list_friends");
    if (error) throw error;
    return (data ?? []).map(mapProfile);
  },

  async listRequests(incoming: boolean): Promise<FriendRequest[]> {
    const { data, error } = await supabase.rpc("social_list_requests", { _incoming: incoming });
    if (error) throw error;
    return (data ?? []).map((request) => ({ ...mapProfile(request), friendshipId: request.friendship_id, createdAt: request.created_at }));
  },

  async sendFriendRequest(userId: string): Promise<string> {
    const { data, error } = await supabase.rpc("social_send_friend_request", { _target_user_id: userId });
    if (error) throw error;
    return data;
  },

  async respondFriendRequest(friendshipId: string, accept: boolean): Promise<string> {
    const { data, error } = await supabase.rpc("social_respond_friend_request", { _friendship_id: friendshipId, _accept: accept });
    if (error) throw error;
    return data;
  },

  async cancelFriendRequest(friendshipId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc("social_cancel_friend_request", { _friendship_id: friendshipId });
    if (error) throw error;
    return data;
  },

  async removeFriend(friendshipId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc("social_remove_friend", { _friendship_id: friendshipId });
    if (error) throw error;
    return data;
  },

  async blockUser(userId: string): Promise<string> {
    const { data, error } = await supabase.rpc("social_block_user", { _target_user_id: userId });
    if (error) throw error;
    return data;
  },

  async listMessages(friendId: string): Promise<FriendMessage[]> {
    const { data, error } = await supabase.rpc("social_list_messages", { _friend_id: friendId });
    if (error) throw error;
    return (data ?? []).map(mapMessage);
  },

  async sendMessage(recipientId: string, body: string): Promise<FriendMessage> {
    const { data, error } = await supabase.rpc("social_send_message", { _recipient_id: recipientId, _body: body });
    if (error) throw error;
    return mapMessage(data);
  },

  async markMessagesRead(friendId: string): Promise<number> {
    const { data, error } = await supabase.rpc("social_mark_messages_read", { _friend_id: friendId });
    if (error) throw error;
    return data ?? 0;
  },

  async setPresence(isOnline: boolean): Promise<void> {
    const { error } = await supabase.rpc("social_set_presence", { _is_online: isOnline });
    if (error) throw error;
  },

  async createFocusChallenge(friendId: string, durationMinutes: 15 | 25 | 50): Promise<FocusChallenge> {
    const { data, error } = await supabase.rpc("social_create_focus_challenge", { _friend_id: friendId, _duration_minutes: durationMinutes });
    if (error) throw error;
    return {
      id: data.id,
      creatorId: data.creator_id,
      inviteeId: data.invitee_id,
      durationMinutes: data.duration_minutes as FocusChallenge["durationMinutes"],
      status: data.status as FocusChallenge["status"],
      creatorCompletedAt: data.creator_completed_at,
      inviteeCompletedAt: data.invitee_completed_at,
      acceptedAt: data.accepted_at,
      startedAt: data.started_at,
      completedAt: data.completed_at,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
      creatorName: "Você",
      inviteeName: "Amigo",
    };
  },

  async getFocusChallenge(challengeId: string): Promise<FocusChallenge | null> {
    const { data, error } = await supabase.rpc("social_get_focus_challenge", { _challenge_id: challengeId });
    if (error) throw error;
    return data?.[0] ? mapChallenge(data[0]) : null;
  },

  async updateFocusChallenge(challengeId: string, action: FocusChallengeAction): Promise<FocusChallenge> {
    const { data, error } = await supabase.rpc("social_update_focus_challenge", { _challenge_id: challengeId, _action: action });
    if (error) throw error;
    const challenge = await friendsService.getFocusChallenge(data.id);
    if (!challenge) throw new Error("Desafio não encontrado após a atualização.");
    return challenge;
  },

  async listNotifications(): Promise<SocialNotification[]> {
    const { data, error } = await supabase.rpc("social_list_notifications");
    if (error) throw error;
    return (data ?? []).map((notification) => ({
      id: notification.id,
      actorId: notification.actor_id,
      actorName: notification.actor_name,
      notificationType: notification.notification_type as SocialNotification["notificationType"],
      entityId: notification.entity_id,
      metadata: (notification.metadata ?? {}) as Record<string, unknown>,
      readAt: notification.read_at,
      createdAt: notification.created_at,
    }));
  },

  async markNotificationRead(notificationId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc("social_mark_notification_read", { _notification_id: notificationId });
    if (error) throw error;
    return data ?? false;
  },
};
