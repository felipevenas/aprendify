import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PremiumContextValue {
  isPremium: boolean;
  isLoading: boolean;
  dailyQuestionCount: number;
  planType: string | null;
  subscriptionEnd: string | null;
  refreshPremiumStatus: () => void;
}

const PremiumContext = createContext<PremiumContextValue | undefined>(undefined);

export const usePremiumContext = (): PremiumContextValue => {
  const context = useContext(PremiumContext);
  if (!context) {
    throw new Error("usePremiumContext must be used within a PremiumProvider");
  }
  return context;
};

interface PremiumProviderProps {
  children: ReactNode;
}

export const PremiumProvider = ({ children }: PremiumProviderProps) => {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dailyQuestionCount, setDailyQuestionCount] = useState(0);
  const [planType, setPlanType] = useState<string | null>(null);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

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
      setInitialized(true);
    } catch (error) {
      console.error("Error in checkPremiumStatus:", error);
      setIsPremium(false);
      setIsLoading(false);
      setInitialized(true);
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
        setInitialized(true);
      }
    };

    init();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        if (!initialized) {
          checkPremiumStatus(session.user.id);
        }
      } else {
        setUserId(null);
        setIsPremium(false);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;

    // Listen for subscription changes for this specific user
    const subscriptionsChannel = supabase
      .channel(`subscriptions-global-${userId}`)
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

    // Listen for question attempts to update daily count in real-time
    const attemptsChannel = supabase
      .channel(`attempts-global-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'question_attempts',
          filter: `user_id=eq.${userId}`
        },
        () => {
          // Update daily count only, not full status
          setDailyQuestionCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscriptionsChannel);
      supabase.removeChannel(attemptsChannel);
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

  return (
    <PremiumContext.Provider value={{ 
      isPremium, 
      isLoading, 
      dailyQuestionCount, 
      planType, 
      subscriptionEnd,
      refreshPremiumStatus 
    }}>
      {children}
    </PremiumContext.Provider>
  );
};
