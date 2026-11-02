import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { requireOwnerId } from "./lib/auth";
import { MCP_KEY_PREFIX, newKey, sha256Hex, SHOWN_PREFIX_LENGTH } from "./lib/keys";

// The MCP server's API keys (design v4), managed in account Settings. A key belongs to
// the signed-in account, not to one site: it reads every site the account owns.

// Active keys per account; revoked ones don't count
export const MAX_KEYS = 20;
export const MAX_KEY_NAME = 60;

const keyRow = v.object({
  id: v.id("apiKeys"),
  name: v.string(),
  prefix: v.string(),
  createdAt: v.number(),
  lastUsedAt: v.union(v.null(), v.number()),
});

/** The signed-in account's active keys, newest first. Never the hash. */
export const list = query({
  args: {},
  returns: v.array(keyRow),
  handler: async (ctx) => {
    const ownerId = await requireOwnerId(ctx);
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .take(200);
    return keys
      .filter((k) => k.revokedAt === undefined)
      .map((k) => ({
        id: k._id,
        name: k.name,
        prefix: k.prefix,
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt ?? null,
      }));
  },
});

/**
 * Creates a named key and returns it, once; only its SHA-256 is kept. An action,
 * because mutations have no real randomness (as sites.createApiKey).
 */
export const create = action({
  args: { name: v.string() },
  returns: v.object({ key: v.string(), prefix: v.string() }),
  handler: async (ctx, args) => {
    const key = newKey(MCP_KEY_PREFIX);
    const prefix = key.slice(0, SHOWN_PREFIX_LENGTH);
    await ctx.runMutation(internal.apiKeys.store, { name: args.name, hash: await sha256Hex(key), prefix });
    return { key, prefix };
  },
});

export const store = internalMutation({
  args: { name: v.string(), hash: v.string(), prefix: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    // The action's caller is the signed-in user, so the key is theirs
    const ownerId = await requireOwnerId(ctx);
    const name = args.name.trim().replace(/\s+/g, " ");
    if (name === "") throw new ConvexError("Give the key a name");
    if (name.length > MAX_KEY_NAME) throw new ConvexError(`Names are at most ${MAX_KEY_NAME} characters`);
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .take(500);
    if (keys.filter((k) => k.revokedAt === undefined).length >= MAX_KEYS) {
      throw new ConvexError(`At most ${MAX_KEYS} keys; revoke one first`);
    }
    await ctx.db.insert("apiKeys", { ownerId, name, hash: args.hash, prefix: args.prefix, createdAt: Date.now() });
    return null;
  },
});

/** Revokes one of the signed-in account's keys. The MCP server refuses it from the next request. */
export const revoke = mutation({
  args: { id: v.id("apiKeys") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const key = await ctx.db.get("apiKeys", args.id);
    if (key === null || key.ownerId !== ownerId) throw new ConvexError("Key not found");
    if (key.revokedAt === undefined) await ctx.db.patch("apiKeys", key._id, { revokedAt: Date.now() });
    return null;
  },
});
