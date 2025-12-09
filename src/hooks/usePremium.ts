import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PremiumStatus {
  isPremium: boolean;
  isLoading: boolean;
  dailyQuestionCount: number;
  planType: string | null;
  subscriptionEnd: string | null;
  refreshPremiumStatus: () => void;
}

/**
 * Hook to check if the current user has an active premium subscription
 * Uses Stripe check-subscription function with fallback to local database
 */
export const usePremium = (): PremiumStatus => {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dailyQuestionCount, setDailyQuestionCount] = useState(0);
  const [planType, setPlanType] = useState<string | null>(null);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
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

      // Try to check subscription via Stripe function
      try {
        const { data, error } = await supabase.functions.invoke("check-subscription");
        
        if (!error && data) {
          setIsPremium(data.subscribed === true);
          setPlanType(data.plan_type || null);
          setSubscriptionEnd(data.subscription_end || null);
        } else {
          // Fallback to local database check
          const { data: subscriptions, error: subError } = await supabase
            .from("subscriptions")
            .select("*")
            .eq("user_id", currentUserId)
            .eq("status", "authorized")
            .or("end_date.is.null,end_date.gt." + new Date().toISOString())
            .limit(1);

          if (!subError && subscriptions && subscriptions.length > 0) {
            setIsPremium(true);
            setPlanType(subscriptions[0].plan_type || null);
            setSubscriptionEnd(subscriptions[0].end_date || null);
          } else {
            setIsPremium(false);
          }
        }
      } catch {
        // Fallback to local database check
        const { data: subscriptions } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", currentUserId)
          .eq("status", "authorized")
          .or("end_date.is.null,end_date.gt." + new Date().toISOString())
          .limit(1);

        if (subscriptions && subscriptions.length > 0) {
          setIsPremium(true);
          setPlanType(subscriptions[0].plan_type || null);
          setSubscriptionEnd(subscriptions[0].end_date || null);
        } else {
          setIsPremium(false);
        }
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
          checkPremiumStatus(userId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, checkPremiumStatus]);

  // Auto-refresh every minute
  useEffect(() => {
    if (!userId) return;

    const interval = setInterval(() => {
      checkPremiumStatus(userId);
    }, 60000);

    return () => clearInterval(interval);
  }, [userId, checkPremiumStatus]);

  const refreshPremiumStatus = useCallback(() => {
    if (userId) {
      checkPremiumStatus(userId);
    }
  }, [userId, checkPremiumStatus]);

  return { 
    isPremium, 
    isLoading, 
    dailyQuestionCount, 
    planType, 
    subscriptionEnd,
    refreshPremiumStatus 
  };
};
