// Pure helpers for POST /api/payments. Kept free of Next.js and Convex so Vitest can cover them.

export type ApiPayment = {
  id: string;
  amountMinor: number;
  currency: string;
  email?: string;
  customerId?: string;
  visitorId?: string;
  sessionId?: string;
  ts?: number;
  refund?: boolean;
};

export const MAX_PAYMENT_BODY_BYTES = 4096;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Seconds and milliseconds are both accepted for `ts`; below this it must be seconds
const MS_THRESHOLD = 1e11;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The key from `Authorization: Bearer va_...`, or null. */
export function bearerKey(header: string | null): string | null {
  const m = header?.match(/^Bearer\s+(va_[0-9a-f]{48})\s*$/);
  return m ? m[1] : null;
}

/**
 * Validates the body `{ id, amount, currency, email?, customerId?, visitorId?,
 * sessionId?, ts?, refund? }`. `amount` is a positive integer in the currency's
 * smallest unit (cents); `ts` is Unix time in seconds or milliseconds, at most a day
 * ahead of `now`. Returns the payment or a message for the 400 response.
 */
export function parsePaymentBody(body: unknown, now: number): { payment: ApiPayment } | { error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { error: "Body must be a JSON object" };
  const b = body as Record<string, unknown>;

  if (typeof b.id !== "string" && typeof b.id !== "number") return { error: "id is required" };
  const id = String(b.id).trim();
  if (!id || id.length > 200) return { error: "id must be 1 to 200 characters" };
  if (typeof b.amount !== "number" || !Number.isSafeInteger(b.amount) || b.amount <= 0) {
    return { error: "amount must be a positive integer in the smallest currency unit (cents)" };
  }
  if (typeof b.currency !== "string" || !/^[A-Za-z]{3}$/.test(b.currency)) {
    return { error: "currency must be a three-letter code such as USD" };
  }
  const payment: ApiPayment = { id, amountMinor: b.amount, currency: b.currency.toUpperCase() };

  if (b.email !== undefined && b.email !== null) {
    const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+$/.test(email) || email.length > 254) return { error: "email is not an email address" };
    payment.email = email;
  }
  if (b.customerId !== undefined && b.customerId !== null) {
    if (typeof b.customerId !== "string" || !b.customerId.trim() || b.customerId.length > 200) {
      return { error: "customerId must be a string of at most 200 characters" };
    }
    payment.customerId = b.customerId.trim();
  }
  for (const field of ["visitorId", "sessionId"] as const) {
    const value = b[field];
    if (value === undefined || value === null || value === "") continue;
    if (typeof value !== "string" || !UUID.test(value)) {
      return { error: `${field} must be the UUID from analytics("attribution")` };
    }
    payment[field] = value.toLowerCase();
  }
  if (b.ts !== undefined && b.ts !== null) {
    if (typeof b.ts !== "number" || !Number.isFinite(b.ts) || b.ts <= 0) return { error: "ts must be a Unix time" };
    const ts = Math.round(b.ts < MS_THRESHOLD ? b.ts * 1000 : b.ts);
    if (ts > now + DAY_MS) return { error: "ts is in the future" };
    payment.ts = ts;
  }
  if (b.refund !== undefined && b.refund !== null) {
    if (typeof b.refund !== "boolean") return { error: "refund must be true or false" };
    if (b.refund) payment.refund = true;
  }
  return { payment };
}
