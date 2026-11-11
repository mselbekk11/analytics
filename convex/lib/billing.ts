import { v, type Infer } from "convex/values";

// Platform billing (launch v1 Phase 4): our customers paying us. Separate from the
// per-site revenue code in lib/stripe.ts, which records our customers' own payments.
// Pure, so it is unit-tested without Stripe. Fields are read defensively, because the
// payload's shape depends on the API version (period ends moved onto the items in 2025).

/** The events to select when adding the billing webhook endpoint in Stripe. */
export const BILLING_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed", // Phase 5: past due shows at once, not on the next subscription update
] as const;

/** Statuses that keep the dashboard open (lib/access.ts). */
export const LIVE_STATUSES: ReadonlySet<string> = new Set(["active", "trialing", "past_due"]);

export const subscriptionRecordValidator = v.object({
  subscriptionId: v.string(),
  customerId: v.string(),
  ownerId: v.optional(v.string()), // metadata.ownerId, set by the checkout action
  status: v.string(),
  events: v.optional(v.number()),
  interval: v.optional(v.union(v.literal("month"), v.literal("year"))),
  currentPeriodEnd: v.optional(v.number()), // ms
  cancelAtPeriodEnd: v.boolean(),
  // When a cancelled subscription ends (ms): cancel_at, else the period end
  cancelAt: v.optional(v.number()),
});

export type SubscriptionRecord = Infer<typeof subscriptionRecordValidator>;

type Obj = Record<string, unknown>;

const obj = (x: unknown): Obj | null => (typeof x === "object" && x !== null ? (x as Obj) : null);
const str = (x: unknown): string | undefined => (typeof x === "string" && x !== "" ? x : undefined);
/** An id field that may be expanded into its object. */
const idOf = (x: unknown): string | undefined => str(x) ?? str(obj(x)?.id);

/**
 * The subscription a billing event is about, to be re-read from Stripe, or null for
 * events this app doesn't act on (one-off Checkouts, other types).
 */
export function billingSubscriptionId(event: { type: string; data: { object: unknown } }): string | null {
  const o = obj(event.data.object);
  if (o === null) return null;
  if (event.type === "checkout.session.completed") {
    return o.mode === "subscription" ? (idOf(o.subscription) ?? null) : null;
  }
  if (event.type.startsWith("customer.subscription.")) return str(o.id) ?? null;
  if (event.type.startsWith("invoice.")) {
    // On the invoice's parent since API 2025-03-31, on the invoice before
    const parent = obj(obj(o.parent)?.subscription_details);
    return idOf(parent?.subscription) ?? idOf(o.subscription) ?? null;
  }
  return null;
}

/** What the account stores from a subscription read back from Stripe; null if it isn't one. */
export function subscriptionRecord(sub: unknown): SubscriptionRecord | null {
  const s = obj(sub);
  const subscriptionId = str(s?.id);
  const customerId = idOf(s?.customer);
  const status = str(s?.status);
  if (s === null || subscriptionId === undefined || customerId === undefined || status === undefined) return null;

  const item = obj((obj(s.items)?.data as unknown[] | undefined)?.[0]);
  const price = obj(item?.price);
  const events = Number(str(obj(price?.metadata)?.events));
  const interval = obj(price?.recurring)?.interval;
  // On the item since API 2025-03-31, on the subscription before
  const periodEnd = typeof item?.current_period_end === "number" ? item.current_period_end : s.current_period_end;
  const currentPeriodEnd = typeof periodEnd === "number" ? periodEnd * 1000 : undefined;
  // The portal's "cancel at period end" may set cancel_at instead of the flag
  const cancelAtPeriodEnd = s.cancel_at_period_end === true || typeof s.cancel_at === "number";

  return {
    subscriptionId,
    customerId,
    ownerId: str(obj(s.metadata)?.ownerId),
    status,
    events: Number.isInteger(events) && events > 0 ? events : undefined,
    interval: interval === "month" || interval === "year" ? interval : undefined,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    cancelAt: typeof s.cancel_at === "number" ? s.cancel_at * 1000 : cancelAtPeriodEnd ? currentPeriodEnd : undefined,
  };
}

/**
 * Whether a subscription read back from Stripe should be written over the account's.
 * Yes for the account's own subscription or its first, and for any live one. No when
 * a different, dead subscription (an abandoned or older one) would replace a live one.
 */
export function shouldApply(
  account: { stripeSubscriptionId?: string; status?: string },
  record: Pick<SubscriptionRecord, "subscriptionId" | "status">,
): boolean {
  if (account.stripeSubscriptionId === undefined || account.stripeSubscriptionId === record.subscriptionId) return true;
  if (LIVE_STATUSES.has(record.status)) return true;
  return !LIVE_STATUSES.has(account.status ?? "");
}
