import { query } from "./_generated/server";
import { v } from "convex/values";

// Phase 0 check: proves Convex receives and validates the Clerk token.
export const whoami = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({ subject: v.string(), tokenIdentifier: v.string() }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) return null;
    return {
      subject: identity.subject,
      tokenIdentifier: identity.tokenIdentifier,
    };
  },
});
