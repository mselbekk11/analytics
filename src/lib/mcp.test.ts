// @vitest-environment node
import { describe, expect, test } from "vitest";
import { newKey, sha256Hex, MCP_KEY_PREFIX } from "../../convex/lib/keys";
import { hashKey, mcpBearerKey } from "./mcp";
import { claudeCodeCommand, cursorConfig } from "./mcpSetup";

const KEY = `vamcp_${"ab".repeat(24)}`;

describe("mcpBearerKey", () => {
  test("reads an MCP key from the header", () => {
    expect(mcpBearerKey(`Bearer ${KEY}`)).toBe(KEY);
    expect(mcpBearerKey(`Bearer   ${KEY}  `)).toBe(KEY);
  });

  test("refuses missing, malformed and payments keys", () => {
    for (const header of [null, "", KEY, `Basic ${KEY}`, "Bearer vamcp_123", `Bearer va_${"ab".repeat(24)}`, `Bearer ${KEY}x`]) {
      expect(mcpBearerKey(header)).toBeNull();
    }
  });
});

describe("hashKey", () => {
  test("matches the hash Convex stores, so the route finds the key", async () => {
    const key = newKey(MCP_KEY_PREFIX);
    expect(mcpBearerKey(`Bearer ${key}`)).toBe(key);
    expect(hashKey(key)).toBe(await sha256Hex(key));
    expect(hashKey(key)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashKey(key)).not.toBe(hashKey(newKey(MCP_KEY_PREFIX)));
  });
});

describe("setup snippets", () => {
  test("point at /api/mcp with the key in the Authorization header", () => {
    expect(claudeCodeCommand("https://a.example", KEY)).toBe(
      `claude mcp add --transport http analytics https://a.example/api/mcp --header "Authorization: Bearer ${KEY}"`,
    );
    expect(JSON.parse(cursorConfig("https://a.example", KEY))).toEqual({
      mcpServers: { analytics: { url: "https://a.example/api/mcp", headers: { Authorization: `Bearer ${KEY}` } } },
    });
  });
});
