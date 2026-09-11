import { usePremiumContext, PremiumContextValue } from "../context/PremiumContext";

export type PremiumStatus = PremiumContextValue;

export const usePremium = (): PremiumStatus => {
  return usePremiumContext();
};

export default usePremium;
