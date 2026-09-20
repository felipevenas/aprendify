import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { friendsService } from "../services/friendsService";
import type { FriendRequest, SocialNotification, SocialProfile } from "../types";
import { countUnreadSocialNotifications } from "../socialUtils";

export function useFriendsHub() {
  const [userId, setUserId] = useState<string | null>(null);
  const [friends, setFriends] = useState<SocialProfile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [notifications, setNotifications] = useState<SocialNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async (currentUserId: string) => {
    try {
      const [nextFriends, nextIncoming, nextOutgoing, nextNotifications] = await Promise.all([
        friendsService.listFriends(),
        friendsService.listRequests(true),
        friendsService.listRequests(false),
        friendsService.listNotifications(),
      ]);
      setFriends(nextFriends);
      setIncomingRequests(nextIncoming);
      setOutgoingRequests(nextOutgoing);
      setNotifications(nextNotifications);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError : new Error("Não foi possível carregar suas conexões."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const initialize = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user || cancelled) return;
      const currentUserId = data.user.id;
      setUserId(currentUserId);
      await reload(currentUserId);
      if (cancelled) return;

      channel = supabase
        .channel(`social-hub-${currentUserId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => void reload(currentUserId))
        .on("postgres_changes", { event: "*", schema: "public", table: "user_presence" }, () => void reload(currentUserId))
        .on("postgres_changes", { event: "*", schema: "public", table: "social_notifications" }, () => void reload(currentUserId))
        .subscribe();
    };

    void initialize();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [reload]);

  const unreadCount = countUnreadSocialNotifications(notifications);

  return {
    userId,
    friends,
    incomingRequests,
    outgoingRequests,
    notifications,
    unreadCount,
    loading,
    error,
    reload: userId ? () => reload(userId) : async () => undefined,
  };
}

export function useSocialUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const load = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user || cancelled) return;
      const refresh = async () => {
        const nextNotifications = await friendsService.listNotifications().catch(() => []);
        if (!cancelled) setUnreadCount(countUnreadSocialNotifications(nextNotifications));
      };
      await refresh();
      channel = supabase
        .channel(`social-unread-${data.user.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "social_notifications" }, () => void refresh())
        .subscribe();
    };

    void load();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  return unreadCount;
}
