import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeRemoteFailure, type RemoteFailure } from "@/features/auth/services/remoteErrors";

export type EntitlementStatus = "loading" | "ready" | "unavailable";

export interface PremiumContextValue {
  /** Only true after the server has authoritatively returned subscribed=true. */
  isPremium: boolean;
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
const FREE_DAILY_QUESTION_LIMIT = 10;
const FREE_MONTHLY_ESSAY_LIMIT = 1;

interface PremiumProviderProps {
  children: ReactNode;
}

type RecordValue = Record<string, unknown>;

const asRecord = (value: unknown): RecordValue => (
  value !== null && typeof value === "object" ? value as RecordValue : {}
);

const firstRecord = (...values: unknown[]): RecordValue => values
  .map(asRecord)
  .find((value) => Object.keys(value).length > 0) ?? {};

const getFiniteNonNegative = (...values: unknown[]): number | null => {
  const value = values.find((candidate) => (
    typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0
  ));
  return typeof value === "number" ? Math.floor(value) : null;
};

const readEntitlements = (payload: RecordValue, subscribed: boolean) => {
  const entitlements = asRecord(payload.entitlements);
  const limits = firstRecord(payload.limits, payload.quota, entitlements.limits);
  const usage = firstRecord(payload.usage, entitlements.usage);

  const dailyQuestionLimit = getFiniteNonNegative(
    limits.daily_questions,
    limits.dailyQuestionLimit,
    limits.questions_per_day,
    payload.daily_question_limit,
  );
  const monthlyEssayLimit = getFiniteNonNegative(
    limits.monthly_essays,
    limits.monthlyEssayLimit,
    limits.essays_per_month,
    payload.monthly_essay_limit,
  );
  const dailyQuestionCount = getFiniteNonNegative(
    usage.daily_questions,
    usage.dailyQuestionCount,
    payload.daily_question_count,
  );

  return {
    dailyQuestionLimit: dailyQuestionLimit ?? (subscribed ? null : FREE_DAILY_QUESTION_LIMIT),
    monthlyEssayLimit: monthlyEssayLimit ?? FREE_MONTHLY_ESSAY_LIMIT,
    dailyQuestionCount,
    tier: typeof payload.tier === "string"
      ? payload.tier
      : typeof entitlements.tier === "string" ? entitlements.tier : null,
  };
};

export const usePremiumContext = (): PremiumContextValue => {
  const context = useContext(PremiumContext);
  if (!context) throw new Error("usePremiumContext must be used within a PremiumProvider");
  return context;
};

export const PremiumProvider = ({ children }: PremiumProviderProps) => {
  const [isPremium, setIsPremium] = useState(false);
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
      if (typeof payload.subscribed !== "boolean") {
        throw normalizeRemoteFailure({ status: 503 }, { operation: "entitlement" });
      }

      const entitlement = readEntitlements(payload, payload.subscribed);
      setIsPremium(payload.subscribed);
      setEntitlementStatus("ready");
      setPlanType(typeof payload.plan_type === "string" ? payload.plan_type : entitlement.tier);
      setTier(entitlement.tier ?? (typeof payload.plan_type === "string" ? payload.plan_type : null));
      setSubscriptionEnd(typeof payload.subscription_end === "string" ? payload.subscription_end : null);
      setDailyQuestionLimit(entitlement.dailyQuestionLimit);
      setMonthlyEssayLimit(entitlement.monthlyEssayLimit);
      if (entitlement.dailyQuestionCount !== null) {
        setDailyQuestionCount(entitlement.dailyQuestionCount);
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUserId(null);
        clearEntitlement();
        setEntitlementStatus("ready");
        setIsLoading(false);
        return;
      }
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
