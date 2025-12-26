import { usePremiumContext, PremiumContextValue } from "@/contexts/PremiumContext";

export type PremiumStatus = PremiumContextValue;

/**
 * Hook to check if the current user has an active premium subscription
 * Uses global PremiumContext for cached state across navigation
 */
export const usePremium = (): PremiumStatus => {
  return usePremiumContext();
};
