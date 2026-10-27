import { createHash } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { MAX_PAYMENT_BODY_BYTES, bearerKey, parsePaymentBody } from "@/lib/payments";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Called from the site's own server (a payment provider's webhook handler, say), never
// from a browser, so there are no CORS headers and errors get real status codes.
const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Records a payment or refund for the site whose key is in `Authorization: Bearer`.
 * See parsePaymentBody for the body; a repeated id answers 200 with `duplicate: true`.
 */
export async function POST(request: Request) {
  const key = bearerKey(request.headers.get("authorization"));
  if (key === null) return json({ error: "Missing or malformed API key" }, 401);

  const secret = process.env.INGEST_SECRET;
  if (!secret) {
    console.error("[payments] INGEST_SECRET is not set");
    return json({ error: "Server misconfigured" }, 500);
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_PAYMENT_BODY_BYTES) return json({ error: "Body too large" }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "Body must be JSON" }, 400);
  }
  const parsed = parsePaymentBody(body, Date.now());
  if ("error" in parsed) return json({ error: parsed.error }, 400);

  try {
    const result = await convex.mutation(api.payments.recordApi, {
      secret,
      keyHash: createHash("sha256").update(key).digest("hex"),
      payment: parsed.payment,
    });
    if (result.status === "unauthorized") return json({ error: "Unknown API key" }, 401);
    return json({ ok: true, duplicate: result.status === "duplicate", matchedBy: result.matchedBy }, 200);
  } catch (error) {
    console.error("[payments]", error);
    return json({ error: "Could not record the payment" }, 500);
  }
}
