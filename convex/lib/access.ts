import { ConvexError, v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

// Who may read their stats (launch v1 Phase 3). One account per owner; every dashboard
// read and MCP tool goes through requireAccess, and ingest never does.

export const accessValidator = v.union(
  v.literal("comped"),
  v.literal("trialing"),
  v.literal("active"),
  v.literal("past_due"),
  v.literal("locked"),
);
export type Access = Infer<typeof accessValidator>;

/** The ConvexError data a locked account gets; the UI shows the paywall, MCP the message. */
export const SUBSCRIPTION_REQUIRED = {
  code: "subscription_required",
  message: "Subscription required: pick a plan at https://www.simplestats.ai/billing",
} as const;

export function isSubscriptionRequired(data: unknown): boolean {
  return typeof data === "object" && data !== null && (data as { code?: unknown }).code === SUBSCRIPTION_REQUIRED.code;
}

/** A ConvexError's text: most carry a string, the subscription lock an object with a message. */
export function errorText(data: unknown): string {
  return isSubscriptionRequired(data) ? SUBSCRIPTION_REQUIRED.message : String(data);
}

/**
 * The account's access state. A Stripe subscription that is active (or in Stripe's own
 * trial) unlocks, past_due keeps access through Stripe's retries, and otherwise the
 * free trial counts until it has ended. No account at all is locked.
 */
export function accessState(account: Doc<"accounts"> | null): Access {
  if (account === null) return "locked";
  if (account.comped === true) return "comped";
  if (account.status === "active" || account.status === "trialing") return "active";
  if (account.status === "past_due") return "past_due";
  if (account.trialEnded !== true) return "trialing";
  return "locked";
}

export async function ownerAccount(ctx: QueryCtx | MutationCtx, ownerId: string): Promise<Doc<"accounts"> | null> {
  return await ctx.db
    .query("accounts")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .unique();
}

/** Throws the typed "subscription required" error unless `ownerId` may read stats. */
export async function requireAccess(ctx: QueryCtx | MutationCtx, ownerId: string): Promise<Access> {
  const access = accessState(await ownerAccount(ctx, ownerId));
  if (access === "locked") throw new ConvexError(SUBSCRIPTION_REQUIRED);
  return access;
}
