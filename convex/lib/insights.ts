import { v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { localDate } from "./dates";
import { addDays, type DateRange } from "./ranges";

// Insight emails (launch v1 Phase 15): who gets which cadence, the days each one covers
// and the signed unsubscribe token. Pure, so the tests can run it directly.

export const cadenceValidator = v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"));
export type Cadence = Infer<typeof cadenceValidator>;
export const CADENCES: Cadence[] = ["daily", "weekly", "monthly"];

/** The `accounts` field holding each cadence's switch. */
export const CADENCE_FIELD = {
  daily: "emailDaily",
  weekly: "emailWeekly",
  monthly: "emailMonthly",
} as const satisfies Record<Cadence, keyof Doc<"accounts">>;

/** A missing field means this: daily off, weekly and monthly on. */
export const CADENCE_DEFAULT: Record<Cadence, boolean> = { daily: false, weekly: true, monthly: true };

export function wantsCadence(account: Doc<"accounts">, cadence: Cadence): boolean {
  return account[CADENCE_FIELD[cadence]] ?? CADENCE_DEFAULT[cadence];
}

/**
 * The site-local days a send at `now` covers, in the site's timezone: the latest whole
 * day, Monday-to-Sunday week or calendar month that has ended there by `now`. The crons
 * run at 07:00 (daily) and 09:00 UTC (weekly, monthly), so for most timezones that is
 * yesterday, the week that ended on Sunday and last month. West of the send hour (e.g.
 * Los Angeles at 07:00 UTC, still 23:00 the day before) the period just ending hasn't
 * finished yet, so the one before it is sent: the numbers are final and match the
 * dashboard for those days.
 */
export function insightPeriod(cadence: Cadence, now: number, tz: string): DateRange {
  const today = localDate(now, tz);
  switch (cadence) {
    case "daily": {
      const day = addDays(today, -1);
      return { from: day, to: day };
    }
    case "weekly": {
      const weekday = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 is Sunday
      const monday = addDays(today, -((weekday + 6) % 7));
      return { from: addDays(monday, -7), to: addDays(monday, -1) };
    }
    case "monthly": {
      const last = addDays(`${today.slice(0, 7)}-01`, -1);
      return { from: `${last.slice(0, 7)}-01`, to: last };
    }
  }
}

// --- Unsubscribe token: "<account id>.<cadence>.<HMAC-SHA256, base64url>" ---

function base64url(bytes: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

/** The env secret the tokens are signed with; sending refuses without it. */
export function unsubscribeSecret(): string {
  const secret = process.env.INSIGHT_UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error("INSIGHT_UNSUBSCRIBE_SECRET is not set");
  return secret;
}

export async function signUnsubscribe(secret: string, accountId: string, cadence: Cadence): Promise<string> {
  return `${accountId}.${cadence}.${await hmac(secret, `${accountId}.${cadence}`)}`;
}

/** The account id and cadence a token was signed for, or null for a tampered or malformed one. */
export async function verifyUnsubscribe(
  secret: string,
  token: string,
): Promise<{ accountId: string; cadence: Cadence } | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [accountId, cadence, signature] = parts;
  if (!(CADENCES as string[]).includes(cadence) || accountId === "") return null;
  const expected = await hmac(secret, `${accountId}.${cadence}`);
  // Constant-time compare
  if (expected.length !== signature.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0 ? { accountId, cadence: cadence as Cadence } : null;
}

/** The owner's Clerk user id: the part of `tokenIdentifier` ("<issuer>|<user id>") after the bar. */
export function clerkUserId(tokenIdentifier: string): string | null {
  const bar = tokenIdentifier.lastIndexOf("|");
  const id = bar === -1 ? "" : tokenIdentifier.slice(bar + 1);
  return id === "" ? null : id;
}

/** INSIGHT_EMAILS_ONLY_TO (comma-separated) limits who may be emailed, e.g. to the owner on dev. */
export function recipientAllowed(email: string, onlyTo: string | undefined): boolean {
  if (onlyTo === undefined || onlyTo.trim() === "") return true;
  const allowed = onlyTo.split(",").map((s) => s.trim().toLowerCase());
  return allowed.includes(email.trim().toLowerCase());
}
