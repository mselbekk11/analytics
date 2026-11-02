import { createHash } from "node:crypto";

// Pure helpers for /api/mcp, kept free of Next.js and Convex so Vitest can cover them.

/** The MCP key from `Authorization: Bearer vamcp_...`, or null (missing or malformed). */
export function mcpBearerKey(header: string | null): string | null {
  const m = header?.match(/^Bearer\s+(vamcp_[0-9a-f]{48})\s*$/);
  return m ? m[1] : null;
}

/** What Convex stores for a key: its SHA-256, hex (as convex/lib/keys.ts sha256Hex). */
export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
