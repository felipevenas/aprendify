import { supabase } from "@/integrations/supabase/client";
import { normalizeRemoteFailure } from "@/features/auth/services/remoteErrors";

export type CheckoutPlan = "starter" | "annual";

interface CheckoutResponse {
  url: string;
}

export async function createCheckoutSession(
  plan: CheckoutPlan,
  includeOrderBump: boolean,
  couponCode?: string,
): Promise<CheckoutResponse> {
  const { data, error } = await supabase.functions.invoke("create-checkout", {
    body: {
      plan,
      includeOrderBump,
      ...(couponCode?.trim() ? { couponCode: couponCode.trim().toUpperCase() } : {}),
    },
  });

  if (error) throw normalizeRemoteFailure(error, { operation: "checkout" });

  if (!data || typeof data.url !== "string" || !data.url.startsWith("https://")) {
    throw normalizeRemoteFailure({ status: 502 }, { operation: "checkout" });
  }

  return { url: data.url };
}
