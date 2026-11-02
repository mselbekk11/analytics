"use client";

import { useState } from "react";
import CopyButton from "@/components/CopyButton";
import { appOrigin } from "@/lib/snippet";
import { claudeCodeCommand, claudeDesktopConfig, cursorConfig, KEY_PLACEHOLDER } from "@/lib/mcpSetup";

const CLIENTS = [
  { id: "claude-code", label: "Claude Code" },
  { id: "claude-desktop", label: "Claude Desktop" },
  { id: "cursor", label: "Cursor" },
] as const;

type ClientId = (typeof CLIENTS)[number]["id"];

/**
 * Ready-to-paste setup for the MCP server in Claude Code, Claude Desktop and Cursor
 * (account Settings and site Settings → MCP server). `apiKey` fills in a key that was
 * just created; otherwise the snippets carry a placeholder. With `domain`, an example
 * question about that site follows.
 */
export default function McpSetup({ apiKey, domain }: { apiKey?: string; domain?: string }) {
  const [client, setClient] = useState<ClientId>("claude-code");
  // Client-only (reads window.location locally), like the tracking snippet
  const origin = appOrigin();
  const key = apiKey ?? KEY_PLACEHOLDER;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div role="tablist" aria-label="MCP client" className="flex flex-wrap gap-1 border-b border-line">
        {CLIENTS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={c.id === client}
            onClick={() => setClient(c.id)}
            className={`-mb-px border-b-2 px-2.5 py-1.5 ${
              c.id === client
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      {client === "claude-code" && (
        <>
          <p className="text-muted-foreground">Run this in a terminal, then start Claude Code and ask away.</p>
          <Code text={claudeCodeCommand(origin, key)} />
          <p className="text-muted-foreground">
            Add <code className="font-mono">--scope user</code> to use it in every project.
          </p>
        </>
      )}
      {client === "claude-desktop" && (
        <>
          <p className="text-muted-foreground">
            In Claude Desktop, open Settings → Developer → Edit Config and add this to{" "}
            <code className="font-mono">claude_desktop_config.json</code>, then restart it. It needs Node.js;{" "}
            <code className="font-mono">mcp-remote</code> connects Desktop to the server.
          </p>
          <Code text={claudeDesktopConfig(origin, key)} />
        </>
      )}
      {client === "cursor" && (
        <>
          <p className="text-muted-foreground">
            Add this to <code className="font-mono">~/.cursor/mcp.json</code> (or a project&apos;s{" "}
            <code className="font-mono">.cursor/mcp.json</code>).
          </p>
          <Code text={cursorConfig(origin, key)} />
        </>
      )}
      {apiKey === undefined && (
        <p className="text-muted-foreground">
          Replace <code className="font-mono">{KEY_PLACEHOLDER}</code> with a key from account Settings.
        </p>
      )}
      {domain !== undefined && (
        <p className="text-muted-foreground">
          Then ask, for example: &ldquo;How many visitors did {domain} get in the last 30 days, and where did they come
          from?&rdquo;
        </p>
      )}
    </div>
  );
}

function Code({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-panel p-3">
      <div className="flex justify-end">
        <CopyButton text={text} />
      </div>
      <pre className="overflow-x-auto font-mono text-xs leading-5">{text}</pre>
    </div>
  );
}
