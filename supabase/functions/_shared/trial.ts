import { ApiError } from "./api.ts";

export const STRIPE_TRIAL_OFFER = "aprendify_complete_trial_3d";
export const STRIPE_TRIAL_SECONDS = 72 * 60 * 60;

type Metadata = Record<string, string | undefined> | null | undefined;

type TrialCheckoutSession = {
  id: string;
  mode: string | null;
  status: string | null;
  customer: string | { id: string } | null;
  subscription: string | { id: string } | null;
  metadata?: Metadata;
};

type TrialSubscription = {
  id: string;
  status: string;
  customer: string | { id: string };
  metadata?: Metadata;
  trial_start: number | null;
  trial_end: number | null;
  items: { data: Array<{ quantity: number | null; price: { id: string } }> };
};

type TrialCustomer = { id: string; metadata?: Metadata };

export function validateTrialCheckoutSnapshot(input: {
  session: TrialCheckoutSession;
  subscription: TrialSubscription;
  customer: TrialCustomer;
  userId: string;
  expectedPriceId: string;
}): { customerId: string; subscriptionId: string; startedAt: string; endsAt: string } {
  const { session, subscription, customer, userId, expectedPriceId } = input;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const sessionSubscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  const subscriptionCustomerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  const validMetadata = (metadata: Metadata) => metadata?.user_id === userId && metadata?.trial_offer === STRIPE_TRIAL_OFFER;

  if (
    session.mode !== "subscription" || session.status !== "complete" ||
    !validMetadata(session.metadata) || !validMetadata(subscription.metadata) ||
    customer.metadata?.user_id !== userId || customer.metadata?.aprendify_trial_only !== "true" ||
    !customerId || customer.id !== customerId || subscriptionCustomerId !== customerId ||
    !sessionSubscriptionId || subscription.id !== sessionSubscriptionId ||
    subscription.status !== "trialing" || subscription.items.data.length !== 1 ||
    subscription.items.data[0]?.quantity !== 1 || subscription.items.data[0]?.price?.id !== expectedPriceId ||
    !Number.isSafeInteger(subscription.trial_start) || !Number.isSafeInteger(subscription.trial_end) ||
    subscription.trial_end! - subscription.trial_start! !== STRIPE_TRIAL_SECONDS
  ) {
    throw new ApiError(409, "TRIAL_CONFIRMATION_FAILED", "Não foi possível confirmar o período de teste");
  }

  return {
    customerId,
    subscriptionId: subscription.id,
    startedAt: new Date(subscription.trial_start! * 1000).toISOString(),
    endsAt: new Date(subscription.trial_end! * 1000).toISOString(),
  };
}
