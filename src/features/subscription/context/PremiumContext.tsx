import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeRemoteFailure, type RemoteFailure } from "@/features/auth/services/remoteErrors";
import { FREE_DAILY_QUESTION_LIMIT, FREE_MONTHLY_ESSAY_LIMIT, readPremiumSnapshot, type TrialStatus } from "../premiumSnapshot";

export type EntitlementStatus = "loading" | "ready" | "unavailable";

export interface PremiumContextValue {
  /** Effective access returned by the server: paid subscription or active trial. */
  isPremium: boolean;
  /** Paid subscription state only. A free trial never sets this to true. */
  isSubscribed: boolean;
  trialStatus: TrialStatus;
  trialEndsAt: string | null;
  isLoading: boolean;
  entitlementStatus: EntitlementStatus;
  entitlementError: RemoteFailure | null;
  dailyQuestionCount: number;
  dailyQuestionLimit: number | null;
  monthlyEssayLimit: number | null;
  tier: string | null;
  planType: string | null;
  subscriptionEnd: string | null;
  refreshPremiumStatus: () => void;
}
const PremiumContext = createContext<PremiumContextValue | undefined>(undefined);
interface PremiumProviderProps {
  children: ReactNode;
}

const asRecord = (value: unknown): Record<string, unknown> => (
  value !== null && typeof value === "object" ? value as Record<string, unknown> : {}
);

export const usePremiumContext = (): PremiumContextValue => {
  const context = useContext(PremiumContext);
  if (!context) throw new Error("usePremiumContext must be used within a PremiumProvider");
  return context;
};

export const PremiumProvider = ({ children }: PremiumProviderProps) => {
  const [isPremium, setIsPremium] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [trialStatus, setTrialStatus] = useState<TrialStatus>("ineligible");
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [entitlementStatus, setEntitlementStatus] = useState<EntitlementStatus>("loading");
  const [entitlementError, setEntitlementError] = useState<RemoteFailure | null>(null);
  const [dailyQuestionCount, setDailyQuestionCount] = useState(0);
  const [dailyQuestionLimit, setDailyQuestionLimit] = useState<number | null>(FREE_DAILY_QUESTION_LIMIT);
  const [monthlyEssayLimit, setMonthlyEssayLimit] = useState<number | null>(FREE_MONTHLY_ESSAY_LIMIT);
  const [tier, setTier] = useState<string | null>(null);
  const [planType, setPlanType] = useState<string | null>(null);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const clearEntitlement = useCallback(() => {
    setIsPremium(false);
    setIsSubscribed(false);
    setTrialStatus("ineligible");
    setTrialEndsAt(null);
    setEntitlementStatus("unavailable");
    setDailyQuestionLimit(FREE_DAILY_QUESTION_LIMIT);
    setMonthlyEssayLimit(FREE_MONTHLY_ESSAY_LIMIT);
    setTier(null);
    setPlanType(null);
    setSubscriptionEnd(null);
  }, []);

  const checkPremiumStatus = useCallback(async (currentUserId: string, isInitial = false) => {
    const requestId = ++requestIdRef.current;
    if (isInitial) setIsLoading(true);
    setEntitlementError(null);

    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const [subscriptionResult, attemptsResult] = await Promise.all([
        supabase.functions.invoke("check-subscription"),
        supabase
          .from("question_attempts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", currentUserId)
          .gte("created_at", startOfDay.toISOString()),
      ]);

      if (requestId !== requestIdRef.current) return;
      if (subscriptionResult.error) {
        throw normalizeRemoteFailure(subscriptionResult.error, { operation: "entitlement" });
      }

      const payload = asRecord(subscriptionResult.data);
      const snapshot = readPremiumSnapshot(payload);
      if (!snapshot) {
        throw normalizeRemoteFailure({ status: 503 }, { operation: "entitlement" });
      }

      setIsSubscribed(snapshot.isSubscribed);
      setIsPremium(snapshot.hasPremiumAccess);
      setTrialStatus(snapshot.trialStatus);
      setTrialEndsAt(snapshot.trialEndsAt);
      setEntitlementStatus("ready");
      setPlanType(snapshot.planType);
      setTier(snapshot.tier ?? snapshot.planType);
      setSubscriptionEnd(snapshot.subscriptionEnd);
      setDailyQuestionLimit(snapshot.dailyQuestionLimit);
      setMonthlyEssayLimit(snapshot.monthlyEssayLimit);
      if (snapshot.dailyQuestionCount !== null) {
        setDailyQuestionCount(snapshot.dailyQuestionCount);
      } else if (!attemptsResult.error && typeof attemptsResult.count === "number") {
        setDailyQuestionCount(attemptsResult.count);
      }
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      const failure = normalizeRemoteFailure(error, { operation: "entitlement" });
      clearEntitlement();
      setEntitlementError(failure);
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [clearEntitlement]);

  // Reconcile against the authoritative endpoint as soon as the server-provided
  // trial deadline is reached. The client deadline is presentation-only.
  useEffect(() => {
    if (trialStatus !== "active" || !trialEndsAt || !userId) return;
    const remaining = Date.parse(trialEndsAt) - Date.now();
    if (!Number.isFinite(remaining)) return;
    const timeout = window.setTimeout(
      () => void checkPremiumStatus(userId),
      remaining <= 0 ? 30_000 : Math.min(remaining, 2_147_000_000),
    );
    return () => window.clearTimeout(timeout);
  }, [checkPremiumStatus, trialEndsAt, trialStatus, userId]);

  useEffect(() => {
    if (!userId) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void checkPremiumStatus(userId);
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => document.removeEventListener("visibilitychange", refreshWhenVisible);
  }, [checkPremiumStatus, userId]);

  useEffect(() => {
    let mounted = true;
    const initialize = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!user) {
        setUserId(null);
        clearEntitlement();
        setEntitlementStatus("ready");
        setIsLoading(false);
        return;
      }
      setUserId(user.id);
      await checkPremiumStatus(user.id, true);
    };

    void initialize();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setUserId(null);
        clearEntitlement();
        setEntitlementStatus("ready");
        setIsLoading(false);
        return;
      }
      if (event !== "SIGNED_IN" && event !== "USER_UPDATED") return;
      if (!session?.user) return;
      setUserId(session.user.id);
      void checkPremiumStatus(session.user.id, true);
    });

    return () => {
      mounted = false;
      requestIdRef.current += 1;
      void subscription.unsubscribe();
    };
  }, [checkPremiumStatus, clearEntitlement]);

  useEffect(() => {
    if (!userId) return;
    const subscriptionsChannel = supabase
      .channel(`subscriptions-global-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` }, () => {
        void checkPremiumStatus(userId);
      })
      .subscribe();

    const attemptsChannel = supabase
      .channel(`attempts-global-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "question_attempts", filter: `user_id=eq.${userId}` }, () => {
        setDailyQuestionCount((previous) => previous + 1);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(subscriptionsChannel);
      void supabase.removeChannel(attemptsChannel);
    };
  }, [userId, checkPremiumStatus]);

  const refreshPremiumStatus = useCallback(() => {
    if (userId) void checkPremiumStatus(userId);
  }, [userId, checkPremiumStatus]);

  return (
    <PremiumContext.Provider value={{
      isPremium,
      isSubscribed,
      trialStatus,
      trialEndsAt,
      isLoading,
      entitlementStatus,
      entitlementError,
      dailyQuestionCount,
      dailyQuestionLimit,
      monthlyEssayLimit,
      tier,
      planType,
      subscriptionEnd,
      refreshPremiumStatus,
    }}>
      {children}
    </PremiumContext.Provider>
  );
};
