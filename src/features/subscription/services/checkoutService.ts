import { supabase } from "@/integrations/supabase/client";
import { normalizeRemoteFailure, RemoteFailure } from "@/features/auth/services/remoteErrors";
import { readCheckoutDiagnosticCode } from "./checkoutFailure";

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

  if (error) {
    const failure = normalizeRemoteFailure(error, { operation: "checkout" });
    const diagnosticCode = failure.status === 503 ? await readCheckoutDiagnosticCode(error) : null;
    if (diagnosticCode) {
      throw new RemoteFailure(
        failure.status,
        `${failure.message} Código de suporte: ${diagnosticCode}.`,
        failure.kind,
        failure.retryAfterSeconds,
      );
    }
    throw failure;
  }

  if (!data || typeof data.url !== "string" || !data.url.startsWith("https://")) {
    throw normalizeRemoteFailure({ status: 502 }, { operation: "checkout" });
  }

  return { url: data.url };
}
