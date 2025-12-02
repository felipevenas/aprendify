import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PremiumStatus {
  isPremium: boolean;
  isLoading: boolean;
  dailyQuestionCount: number;
}

/**
 * Hook to check if the current user has an active premium subscription
 * and get their daily question count
 */
export const usePremium = (): PremiumStatus => {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dailyQuestionCount, setDailyQuestionCount] = useState(0);

  useEffect(() => {
    const checkPremiumStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setIsPremium(false);
          setIsLoading(false);
          return;
        }

        // Check if user has active subscription
        const { data: subscriptions, error } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
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
          .eq("user_id", user.id)
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
    };

    checkPremiumStatus();

    // Listen for subscription changes
    const channel = supabase
      .channel('subscriptions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions'
        },
        () => {
          checkPremiumStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { isPremium, isLoading, dailyQuestionCount };
};
