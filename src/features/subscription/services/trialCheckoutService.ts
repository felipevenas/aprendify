import { supabase } from "@/integrations/supabase/client";
import { normalizeRemoteFailure } from "@/features/auth/services/remoteErrors";

export interface ConfirmedTrial {
  confirmed: true;
  trial_ends_at: string;
}

export async function createTrialCheckoutSession(): Promise<{ url: string }> {
  const { data, error } = await supabase.functions.invoke("create-trial-checkout");
  if (error) throw normalizeRemoteFailure(error, { operation: "checkout" });

  if (!data || typeof data.url !== "string" || !data.url.startsWith("https://")) {
    throw normalizeRemoteFailure({ status: 502 }, { operation: "checkout" });
  }

  return { url: data.url };
}

export async function confirmTrialCheckout(sessionId: string): Promise<ConfirmedTrial> {
  const { data, error } = await supabase.functions.invoke("confirm-trial-checkout", {
    body: { session_id: sessionId },
  });
  if (error) throw normalizeRemoteFailure(error, { operation: "checkout" });

  if (
    !data || data.confirmed !== true || typeof data.trial_ends_at !== "string"
    || !Number.isFinite(Date.parse(data.trial_ends_at))
  ) {
    throw normalizeRemoteFailure({ status: 502 }, { operation: "checkout" });
  }

  return { confirmed: true, trial_ends_at: data.trial_ends_at };
}
