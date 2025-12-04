import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PremiumStatus {
  isPremium: boolean;
  isLoading: boolean;
  dailyQuestionCount: number;
  refreshPremiumStatus: () => void;
}

/**
 * Hook to check if the current user has an active premium subscription
 * and get their daily question count
 */
export const usePremium = (): PremiumStatus => {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dailyQuestionCount, setDailyQuestionCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  const checkPremiumStatus = useCallback(async (uid?: string) => {
    try {
      const targetUserId = uid || userId;
      
      if (!targetUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsPremium(false);
          setIsLoading(false);
          return;
        }
        setUserId(user.id);
      }

      const currentUserId = targetUserId || userId;
      if (!currentUserId) return;

      // Check if user has active subscription
      const { data: subscriptions, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", currentUserId)
        .eq("status", "authorized")
        .or("end_date.is.null,end_date.gt." + new Date().toISOString())
        .limit(1);

      if (error) {
        console.error("Error checking premium status:", error);
        setIsPremium(false);
      } else {
        setIsPremium(subscriptions && subscriptions.length > 0);
      }

      // Get daily question count
      const { data: attempts, error: attemptsError } = await supabase
        .from("question_attempts")
        .select("id")
        .eq("user_id", currentUserId)
        .gte("created_at", new Date().toISOString().split('T')[0]);

      if (!attemptsError && attempts) {
        setDailyQuestionCount(attempts.length);
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error in checkPremiumStatus:", error);
      setIsPremium(false);
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        checkPremiumStatus(user.id);
      } else {
        setIsPremium(false);
        setIsLoading(false);
      }
    };

    init();
  }, []);

  useEffect(() => {
    if (!userId) return;

    // Listen for subscription changes for this specific user
    const channel = supabase
      .channel(`subscriptions-changes-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `user_id=eq.${userId}`
        },
        () => {
          // Re-check premium status when subscription changes
          checkPremiumStatus(userId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, checkPremiumStatus]);

  const refreshPremiumStatus = useCallback(() => {
    if (userId) {
      checkPremiumStatus(userId);
    }
  }, [userId, checkPremiumStatus]);

  return { isPremium, isLoading, dailyQuestionCount, refreshPremiumStatus };
};
