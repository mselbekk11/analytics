import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/** The signed-in user's stable id, used as `sites.ownerId`. Throws when signed out. */
export async function requireOwnerId(ctx: QueryCtx | MutationCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new ConvexError("Not signed in");
  }
  return identity.tokenIdentifier;
}
