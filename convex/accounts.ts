import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { accessState, accessValidator, ownerAccount } from "./lib/access";
import { requireOwnerId } from "./lib/auth";

// Accounts, the trial and comping (launch v1 Phase 3). Stripe fills in the subscription
// fields from Phase 4.

export const TRIAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The owner's account, created with a 7-day trial if missing. Also marks a trial whose
 * end has passed (the scheduled job normally does, but a trial end edited by hand isn't
 * scheduled). Idempotent.
 */
export async function ensureAccount(ctx: MutationCtx, ownerId: string): Promise<void> {
  const now = Date.now();
  const account = await ownerAccount(ctx, ownerId);
  if (account === null) {
    const trialEndsAt = now + TRIAL_MS;
    await ctx.db.insert("accounts", { ownerId, trialEndsAt });
    await ctx.scheduler.runAt(trialEndsAt, internal.accounts.endTrial, { ownerId });
  } else if (account.trialEnded !== true && account.trialEndsAt <= now) {
    await ctx.db.patch("accounts", account._id, { trialEnded: true });
  }
}

/** Runs on every signed-in page load (ConvexClientProvider). */
export const ensure = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ensureAccount(ctx, await requireOwnerId(ctx));
    return null;
  },
});

/**
 * The signed-in user's access state and trial end, or null before `ensure` has made the
 * account. The trial pill counts the days in the browser, because queries can't read the clock.
 */
export const me = query({
  args: {},
  returns: v.union(v.null(), v.object({ access: accessValidator, trialEndsAt: v.number() })),
  handler: async (ctx) => {
    const account = await ownerAccount(ctx, await requireOwnerId(ctx));
    if (account === null) return null;
    return { access: accessState(account), trialEndsAt: account.trialEndsAt };
  },
});

/** Scheduled at trialEndsAt: locks the trial if it really has ended (it may have been moved). */
export const endTrial = internalMutation({
  args: { ownerId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const account = await ownerAccount(ctx, args.ownerId);
    if (account !== null && account.trialEnded !== true && account.trialEndsAt <= Date.now()) {
      await ctx.db.patch("accounts", account._id, { trialEnded: true });
    }
    return null;
  },
});

/**
 * Sets or clears `comped` (free forever), creating the account if the owner hasn't signed
 * in yet. Run from the dashboard or CLI: `npx convex run accounts:setComped '{"ownerId":
 * "<tokenIdentifier>", "comped": true}'`.
 */
export const setComped = internalMutation({
  args: { ownerId: v.string(), comped: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ensureAccount(ctx, args.ownerId);
    const account = (await ownerAccount(ctx, args.ownerId))!;
    await ctx.db.patch("accounts", account._id, { comped: args.comped ? true : undefined });
    return null;
  },
});

/**
 * Moves the trial's end, e.g. to the past to try the paywall on dev, or later to extend a
 * trial. An end in the past locks at once; a later one unlocks and is scheduled.
 */
export const setTrialEnd = internalMutation({
  args: { ownerId: v.string(), trialEndsAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ensureAccount(ctx, args.ownerId);
    const account = (await ownerAccount(ctx, args.ownerId))!;
    const ended = args.trialEndsAt <= Date.now();
    await ctx.db.patch("accounts", account._id, { trialEndsAt: args.trialEndsAt, trialEnded: ended ? true : undefined });
    if (!ended) await ctx.scheduler.runAt(args.trialEndsAt, internal.accounts.endTrial, { ownerId: args.ownerId });
    return null;
  },
});
