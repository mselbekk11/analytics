import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireAccess } from "./access";
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

/**
 * requireSite for the stats reads (stats.*, pages.*, visitors.*): the owner's account
 * must allow reading first (lib/access.ts), so a locked account gets "subscription
 * required" for any domain, its own or not.
 */
export async function requireReadableSite(
  ctx: QueryCtx | MutationCtx,
  domain: string,
): Promise<Doc<"sites">> {
  const ownerId = await requireOwnerId(ctx);
  await requireAccess(ctx, ownerId);
  const site = await ownedSite(ctx, ownerId, domain);
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
  return await ownedSite(ctx, await requireOwnerId(ctx), domain);
}

/**
 * The site with this domain if `ownerId` owns it, else null. The owner comes from the
 * Clerk session (findOwnedSite) or from an MCP API key (mcp.ts); the stats helpers then
 * take the site, so both paths share them.
 */
export async function ownedSite(
  ctx: QueryCtx | MutationCtx,
  ownerId: string,
  domain: string,
): Promise<Doc<"sites"> | null> {
  const normalized = normalizeDomain(domain);
  if (normalized === null) return null;
  const site = await ctx.db
    .query("sites")
    .withIndex("by_domain", (q) => q.eq("domain", normalized))
    .unique();
  if (site === null || site.ownerId !== ownerId) return null;
  return site;
}
