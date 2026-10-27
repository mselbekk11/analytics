import { v, type Infer } from "convex/values";

// Turns a verified Stripe webhook event into what the payments code records. Pure, so
// it is unit-tested without Stripe. Fields are read defensively: the payload's shape
// depends on the API version chosen for the webhook endpoint (invoices moved their
// subscription under `parent` in 2025), so both shapes are accepted.

export const stripeRecordValidator = v.union(
  // A one-off Checkout payment or a paid invoice
  v.object({
    type: v.literal("payment"),
    providerId: v.string(),
    ts: v.number(),
    amountMinor: v.number(),
    currency: v.string(),
    renewal: v.boolean(),
    customerId: v.optional(v.string()),
    email: v.optional(v.string()),
    visitorId: v.optional(v.string()), // va_vid from metadata
    checkoutSessionId: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
    paymentIntentId: v.optional(v.string()),
    invoiceId: v.optional(v.string()),
  }),
  // A charge refunded in part or in full; `refundedMinor` is the total refunded so far
  v.object({
    type: v.literal("refund"),
    chargeId: v.string(),
    ts: v.number(),
    refundedMinor: v.number(),
    currency: v.string(),
    customerId: v.optional(v.string()),
    email: v.optional(v.string()),
    paymentIntentId: v.optional(v.string()),
    invoiceId: v.optional(v.string()),
  }),
  // A subscription Checkout: no money yet (its invoice.paid counts), only the link
  v.object({
    type: v.literal("checkout"),
    checkoutSessionId: v.string(),
    ts: v.number(),
    customerId: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
    visitorId: v.optional(v.string()),
  }),
);

export type StripeRecord = Infer<typeof stripeRecordValidator>;

/** The events to select when adding the webhook endpoint in Stripe. */
export const STRIPE_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "invoice.paid",
  "charge.refunded",
] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Obj = Record<string, unknown>;

function obj(value: unknown): Obj | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Obj) : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= 500 ? value : undefined;
}

/** An expandable field: the id string, or the expanded object's id. */
function idOf(value: unknown): string | undefined {
  return text(value) ?? text(obj(value)?.id);
}

function amount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function email(value: unknown): string | undefined {
  const e = text(value)?.trim().toLowerCase();
  return e && e.includes("@") ? e : undefined;
}

/** The visitor id the site passed from analytics("attribution"), if it is one. */
export function metadataVisitor(metadata: unknown, clientReferenceId?: unknown): string | undefined {
  for (const candidate of [obj(metadata)?.va_vid, clientReferenceId]) {
    if (typeof candidate === "string" && UUID.test(candidate)) return candidate.toLowerCase();
  }
  return undefined;
}

/** Drops undefined fields, so the record passes Convex's validator as optional fields. */
function compact<T extends Obj>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as T;
}

export function parseStripeEvent(event: { type: string; created: number; data: { object: unknown } }): StripeRecord | null {
  const o = obj(event.data.object);
  if (o === undefined) return null;
  const ts = event.created * 1000;
  const currency = text(o.currency)?.toUpperCase();
  const customerId = idOf(o.customer);

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const checkoutSessionId = text(o.id);
    if (checkoutSessionId === undefined) return null;
    const visitorId = metadataVisitor(o.metadata, o.client_reference_id);
    if (o.mode === "subscription") {
      return compact({
        type: "checkout" as const,
        checkoutSessionId,
        ts,
        customerId,
        subscriptionId: idOf(o.subscription),
        visitorId,
      });
    }
    const amountMinor = amount(o.amount_total);
    if (o.mode !== "payment" || o.payment_status !== "paid" || amountMinor === undefined || !currency) {
      return null;
    }
    return compact({
      type: "payment" as const,
      providerId: checkoutSessionId,
      ts,
      amountMinor,
      currency,
      renewal: false,
      customerId,
      email: email(obj(o.customer_details)?.email) ?? email(o.customer_email),
      visitorId,
      checkoutSessionId,
      paymentIntentId: idOf(o.payment_intent),
    });
  }

  if (event.type === "invoice.paid") {
    const invoiceId = text(o.id);
    const amountMinor = amount(o.amount_paid);
    // A free trial's first invoice is paid with nothing
    if (invoiceId === undefined || amountMinor === undefined || !currency) return null;
    const details = obj(obj(o.parent)?.subscription_details) ?? obj(o.subscription_details);
    // Newer API versions list the invoice's payments instead of a payment_intent field
    const invoicePayments = obj(o.payments)?.data;
    const firstPayment = Array.isArray(invoicePayments) ? obj(obj(invoicePayments[0])?.payment) : undefined;
    return compact({
      type: "payment" as const,
      providerId: invoiceId,
      ts,
      amountMinor,
      currency,
      renewal: o.billing_reason === "subscription_cycle",
      customerId,
      email: email(o.customer_email),
      visitorId: metadataVisitor(details?.metadata) ?? metadataVisitor(o.metadata),
      subscriptionId: idOf(details?.subscription) ?? idOf(o.subscription),
      paymentIntentId: idOf(o.payment_intent) ?? idOf(firstPayment?.payment_intent),
      invoiceId,
    });
  }

  if (event.type === "charge.refunded") {
    const chargeId = text(o.id);
    const refundedMinor = amount(o.amount_refunded);
    if (chargeId === undefined || refundedMinor === undefined || !currency) return null;
    return compact({
      type: "refund" as const,
      chargeId,
      ts,
      refundedMinor,
      currency,
      customerId,
      email: email(obj(o.billing_details)?.email) ?? email(o.receipt_email),
      paymentIntentId: idOf(o.payment_intent),
      invoiceId: idOf(o.invoice),
    });
  }

  return null;
}
