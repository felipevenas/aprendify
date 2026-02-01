import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
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

// Cache configuration - reduce API calls
const CACHE_KEY = "premium_status_cache";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache
const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // Refresh every 5 minutes instead of 1

interface CachedPremiumStatus {
  isPremium: boolean;
  planType: string | null;
  subscriptionEnd: string | null;
  timestamp: number;
  userId: string;
}

const getCachedStatus = (userId: string): CachedPremiumStatus | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const parsed: CachedPremiumStatus = JSON.parse(cached);
    const isExpired = Date.now() - parsed.timestamp > CACHE_TTL_MS;
    const isSameUser = parsed.userId === userId;
    
    if (isExpired || !isSameUser) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    
    return parsed;
  } catch {
    return null;
  }
};

const setCachedStatus = (userId: string, status: Omit<CachedPremiumStatus, "timestamp" | "userId">) => {
  try {
    const cached: CachedPremiumStatus = {
      ...status,
      userId,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Ignore storage errors
  }
};

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
  const lastCheckRef = useRef<number>(0);
  const isCheckingRef = useRef<boolean>(false);

  const checkPremiumStatus = useCallback(async (uid?: string, forceRefresh = false) => {
    const targetUserId = uid || userId;
    
    // Prevent concurrent checks
    if (isCheckingRef.current) return;
    
    // Throttle checks - minimum 30 seconds between calls unless forced
    const now = Date.now();
    if (!forceRefresh && now - lastCheckRef.current < 30000) {
      return;
    }
    
    try {
      isCheckingRef.current = true;
      
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

      // Check cache first (unless forced refresh)
      if (!forceRefresh) {
        const cached = getCachedStatus(currentUserId);
        if (cached) {
          setIsPremium(cached.isPremium);
          setPlanType(cached.planType);
          setSubscriptionEnd(cached.subscriptionEnd);
          setIsLoading(false);
          setInitialized(true);
          
          // Still update daily count from database
          const { data: attempts } = await supabase
            .from("question_attempts")
            .select("id")
            .eq("user_id", currentUserId)
            .gte("created_at", new Date().toISOString().split('T')[0]);

          if (attempts) {
            setDailyQuestionCount(attempts.length);
          }
          return;
        }
      }

      lastCheckRef.current = now;

      // Try to check subscription via Stripe function
      try {
        const { data, error } = await supabase.functions.invoke("check-subscription");
        
        if (!error && data && !data.rateLimited) {
          const premiumStatus = data.subscribed === true;
          setIsPremium(premiumStatus);
          setPlanType(data.plan_type || null);
          setSubscriptionEnd(data.subscription_end || null);
          
          // Cache the result
          setCachedStatus(currentUserId, {
            isPremium: premiumStatus,
            planType: data.plan_type || null,
            subscriptionEnd: data.subscription_end || null
          });
        } else if (data?.rateLimited) {
          // Rate limited - use cached data or fallback to database
          const cached = getCachedStatus(currentUserId);
          if (cached) {
            setIsPremium(cached.isPremium);
            setPlanType(cached.planType);
            setSubscriptionEnd(cached.subscriptionEnd);
          } else {
            // Fallback to local database check
            await checkLocalSubscription(currentUserId);
          }
        } else {
          // Fallback to local database check
          await checkLocalSubscription(currentUserId);
        }
      } catch {
        // Fallback to local database check
        await checkLocalSubscription(currentUserId);
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
    } finally {
      isCheckingRef.current = false;
    }
  }, [userId]);

  const checkLocalSubscription = async (currentUserId: string) => {
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
      
      // Cache the result
      setCachedStatus(currentUserId, {
        isPremium: true,
        planType: subscriptions[0].plan_type || null,
        subscriptionEnd: subscriptions[0].end_date || null
      });
    } else {
      setIsPremium(false);
      setCachedStatus(currentUserId, {
        isPremium: false,
        planType: null,
        subscriptionEnd: null
      });
    }
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        
        // Try to use cache first for faster initial load
        const cached = getCachedStatus(user.id);
        if (cached) {
          setIsPremium(cached.isPremium);
          setPlanType(cached.planType);
          setSubscriptionEnd(cached.subscriptionEnd);
          setIsLoading(false);
          setInitialized(true);
          
          // Background refresh
          checkPremiumStatus(user.id, false);
        } else {
          checkPremiumStatus(user.id, true);
        }
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
          checkPremiumStatus(session.user.id, true);
        }
      } else {
        setUserId(null);
        setIsPremium(false);
        setIsLoading(false);
        localStorage.removeItem(CACHE_KEY);
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
          // Force refresh on subscription changes
          localStorage.removeItem(CACHE_KEY);
          checkPremiumStatus(userId, true);
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

  // Auto-refresh every 5 minutes instead of 1 minute
  useEffect(() => {
    if (!userId) return;

    const interval = setInterval(() => {
      checkPremiumStatus(userId, false);
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [userId, checkPremiumStatus]);

  const refreshPremiumStatus = useCallback(() => {
    if (userId) {
      checkPremiumStatus(userId, true);
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
