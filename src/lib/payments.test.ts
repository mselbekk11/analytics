import { describe, expect, test } from "vitest";
import { bearerKey, parsePaymentBody } from "./payments";

const NOW = Date.parse("2026-10-27T12:00:00Z");
const VID = "0b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f70";
const KEY = `va_${"ab".repeat(24)}`;

describe("bearerKey", () => {
  test("reads a va_ key from the Authorization header", () => {
    expect(bearerKey(`Bearer ${KEY}`)).toBe(KEY);
    expect(bearerKey(null)).toBeNull();
    expect(bearerKey(KEY)).toBeNull();
    expect(bearerKey("Bearer sk_live_123")).toBeNull();
  });
});

describe("parsePaymentBody", () => {
  test("accepts the minimal body and upper-cases the currency", () => {
    expect(parsePaymentBody({ id: "order_1", amount: 4900, currency: "usd" }, NOW)).toEqual({
      payment: { id: "order_1", amountMinor: 4900, currency: "USD" },
    });
  });

  test("keeps the optional fields, lower-casing email and ids", () => {
    const result = parsePaymentBody(
      {
        id: 1001,
        amount: 100,
        currency: "EUR",
        email: " Jo@Example.com ",
        customerId: "cus_1",
        visitorId: VID.toUpperCase(),
        sessionId: VID,
        ts: 1_790_000_000,
        refund: true,
      },
      NOW,
    );
    expect(result).toEqual({
      payment: {
        id: "1001",
        amountMinor: 100,
        currency: "EUR",
        email: "jo@example.com",
        customerId: "cus_1",
        visitorId: VID,
        sessionId: VID,
        ts: 1_790_000_000_000,
        refund: true,
      },
    });
  });

  test("ts in milliseconds stays as is; refund false is left out", () => {
    expect(parsePaymentBody({ id: "a", amount: 1, currency: "USD", ts: NOW, refund: false }, NOW)).toEqual({
      payment: { id: "a", amountMinor: 1, currency: "USD", ts: NOW },
    });
  });

  test.each([
    [null, "Body must be a JSON object"],
    [{ amount: 1, currency: "USD" }, "id is required"],
    [{ id: "a", amount: 0, currency: "USD" }, "amount must be"],
    [{ id: "a", amount: 9.99, currency: "USD" }, "amount must be"],
    [{ id: "a", amount: 1, currency: "dollars" }, "currency must be"],
    [{ id: "a", amount: 1, currency: "USD", email: "nope" }, "email is not"],
    [{ id: "a", amount: 1, currency: "USD", visitorId: "abc" }, "visitorId must be"],
    [{ id: "a", amount: 1, currency: "USD", ts: NOW + 2 * 86_400_000 }, "ts is in the future"],
    [{ id: "a", amount: 1, currency: "USD", refund: "yes" }, "refund must be"],
  ])("rejects %j", (body, message) => {
    const result = parsePaymentBody(body, NOW);
    expect("error" in result && result.error).toContain(message);
  });
});
