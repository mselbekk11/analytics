import { describe, expect, test } from "vitest";
import { metadataVisitor, parseStripeEvent } from "./stripe";

const VID = "0b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f70";
const CREATED = 1_790_000_000;

const event = (type: string, object: Record<string, unknown>) => ({ type, created: CREATED, data: { object } });

describe("metadataVisitor", () => {
  test("takes va_vid, then client_reference_id, when they are UUIDs", () => {
    expect(metadataVisitor({ va_vid: VID.toUpperCase() })).toBe(VID);
    expect(metadataVisitor({}, VID)).toBe(VID);
    expect(metadataVisitor({ va_vid: "user_42" }, "order_7")).toBeUndefined();
    expect(metadataVisitor(null)).toBeUndefined();
  });
});

describe("parseStripeEvent", () => {
  const checkout = {
    id: "cs_test_1",
    mode: "payment",
    payment_status: "paid",
    amount_total: 4900,
    currency: "usd",
    customer: "cus_1",
    customer_details: { email: "Jo@Example.com" },
    metadata: { va_vid: VID, va_sid: VID },
    payment_intent: "pi_1",
  };

  test("a paid one-off Checkout is a payment with its metadata visitor", () => {
    expect(parseStripeEvent(event("checkout.session.completed", checkout))).toEqual({
      type: "payment",
      providerId: "cs_test_1",
      ts: CREATED * 1000,
      amountMinor: 4900,
      currency: "USD",
      renewal: false,
      customerId: "cus_1",
      email: "jo@example.com",
      visitorId: VID,
      checkoutSessionId: "cs_test_1",
      paymentIntentId: "pi_1",
    });
  });

  test("an unpaid Checkout waits for async_payment_succeeded", () => {
    const pending = { ...checkout, payment_status: "unpaid" };
    expect(parseStripeEvent(event("checkout.session.completed", pending))).toBeNull();
    expect(parseStripeEvent(event("checkout.session.async_payment_succeeded", checkout))).toMatchObject({
      type: "payment",
      providerId: "cs_test_1",
    });
  });

  test("a subscription Checkout is only a link to its subscription", () => {
    const sub = { ...checkout, mode: "subscription", subscription: { id: "sub_1" }, metadata: {}, client_reference_id: VID };
    expect(parseStripeEvent(event("checkout.session.completed", sub))).toEqual({
      type: "checkout",
      checkoutSessionId: "cs_test_1",
      ts: CREATED * 1000,
      customerId: "cus_1",
      subscriptionId: "sub_1",
      visitorId: VID,
    });
  });

  test("invoice.paid in the current API shape (subscription under parent)", () => {
    const invoice = {
      id: "in_1",
      amount_paid: 1500,
      currency: "eur",
      customer: "cus_1",
      customer_email: "jo@example.com",
      billing_reason: "subscription_cycle",
      parent: { subscription_details: { subscription: "sub_1", metadata: { va_vid: VID } } },
      payments: { data: [{ payment: { payment_intent: "pi_2" } }] },
    };
    expect(parseStripeEvent(event("invoice.paid", invoice))).toEqual({
      type: "payment",
      providerId: "in_1",
      ts: CREATED * 1000,
      amountMinor: 1500,
      currency: "EUR",
      renewal: true,
      customerId: "cus_1",
      email: "jo@example.com",
      visitorId: VID,
      subscriptionId: "sub_1",
      paymentIntentId: "pi_2",
      invoiceId: "in_1",
    });
  });

  test("invoice.paid in the older shape, and a free trial's empty invoice", () => {
    const invoice = {
      id: "in_2",
      amount_paid: 900,
      currency: "usd",
      billing_reason: "subscription_create",
      subscription: "sub_2",
      payment_intent: "pi_3",
    };
    expect(parseStripeEvent(event("invoice.paid", invoice))).toMatchObject({
      renewal: false,
      subscriptionId: "sub_2",
      paymentIntentId: "pi_3",
    });
    expect(parseStripeEvent(event("invoice.paid", { ...invoice, amount_paid: 0 }))).toBeNull();
  });

  test("charge.refunded carries the total refunded so far", () => {
    const charge = {
      id: "ch_1",
      amount_refunded: 1000,
      currency: "usd",
      payment_intent: "pi_1",
      billing_details: { email: "jo@example.com" },
    };
    expect(parseStripeEvent(event("charge.refunded", charge))).toEqual({
      type: "refund",
      chargeId: "ch_1",
      ts: CREATED * 1000,
      refundedMinor: 1000,
      currency: "USD",
      email: "jo@example.com",
      paymentIntentId: "pi_1",
    });
  });

  test("other events are ignored", () => {
    expect(parseStripeEvent(event("customer.created", { id: "cus_1" }))).toBeNull();
  });
});
