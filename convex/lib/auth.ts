import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { normalizeDomain } from "./domain";

/** The signed-in user's stable id, used as `sites.ownerId`. Throws when signed out. */
export async function requireOwnerId(ctx: QueryCtx | MutationCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new ConvexError("Not signed in");
  }
  return identity.tokenIdentifier;
}

/**
 * The site with this domain, if the signed-in user owns it. Throws when signed out,
 * and gives the same "Site not found" for a missing site and someone else's, so the
 * error does not reveal which domains exist. Every sites.* and stats.* read starts here.
 */
export async function requireSite(
  ctx: QueryCtx | MutationCtx,
  domain: string,
): Promise<Doc<"sites">> {
  const site = await findOwnedSite(ctx, domain);
  if (site === null) {
    throw new ConvexError("Site not found");
  }
  return site;
}

/** Like requireSite, but returns null instead of throwing for a missing or foreign site. */
export async function findOwnedSite(
  ctx: QueryCtx | MutationCtx,
  domain: string,
): Promise<Doc<"sites"> | null> {
  const ownerId = await requireOwnerId(ctx);
  const normalized = normalizeDomain(domain);
  if (normalized === null) return null;
  const site = await ctx.db
    .query("sites")
    .withIndex("by_domain", (q) => q.eq("domain", normalized))
    .unique();
  if (site === null || site.ownerId !== ownerId) return null;
  return site;
}
