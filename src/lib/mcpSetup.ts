// Ready-to-paste MCP client setup for Settings (design v4). Client-safe: no Node imports.

/** Shown in the setup until a key has just been created (keys are shown only once). */
export const KEY_PLACEHOLDER = "<your-key>";

/** The `claude mcp add` command for this app's endpoint. */
export function claudeCodeCommand(origin: string, key: string): string {
  return `claude mcp add --transport http analytics ${origin}/api/mcp --header "Authorization: Bearer ${key}"`;
}

/**
 * Claude Desktop's `claude_desktop_config.json` entry. Desktop reads local servers from
 * that file, so `mcp-remote` bridges to the HTTP endpoint; the header goes through an
 * env var because some platforms split arguments on spaces.
 */
export function claudeDesktopConfig(origin: string, key: string): string {
  const config = {
    mcpServers: {
      analytics: {
        command: "npx",
        args: ["-y", "mcp-remote", `${origin}/api/mcp`, "--header", "Authorization:${AUTH_HEADER}"],
        env: { AUTH_HEADER: `Bearer ${key}` },
      },
    },
  };
  return JSON.stringify(config, null, 2);
}

/** Cursor's `~/.cursor/mcp.json` (or the project's `.cursor/mcp.json`) entry. */
export function cursorConfig(origin: string, key: string): string {
  const config = { mcpServers: { analytics: { url: `${origin}/api/mcp`, headers: { Authorization: `Bearer ${key}` } } } };
  return JSON.stringify(config, null, 2);
}
