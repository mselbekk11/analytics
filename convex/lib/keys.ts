// Secret keys: the payments API key (5e) and the MCP keys (design v4). A key is shown
// once and only its SHA-256 is stored; the Next.js routes hash the Bearer key the same
// way (node:crypto) before asking Convex about it.

/** `<prefix>` and 48 random hex characters (24 bytes). */
export function newKey(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `${prefix}${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** SHA-256 of the text, as lowercase hex. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// MCP keys start with this, so they can't be mistaken for (or used as) a payments key
export const MCP_KEY_PREFIX = "vamcp_";
// How much of a key Settings shows: the prefix and 6 hex characters
export const SHOWN_PREFIX_LENGTH = MCP_KEY_PREFIX.length + 6;
