"use client";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import CopyButton from "@/components/CopyButton";
import McpSetup from "@/components/McpSetup";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatElapsed } from "@/lib/format";
import { useNow } from "@/components/dashboard/useNow";

const MAX_NAME = 60;

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

/**
 * Account Settings → MCP server: create a named key (shown once, with Copy), the active
 * keys with their prefix, created and last used, Revoke, and the client setup. Keys are
 * account-wide: each reads every site you own.
 */
export default function McpKeys() {
  const keys = useQuery(api.apiKeys.list, {});
  const createKey = useAction(api.apiKeys.create);
  const revokeKey = useMutation(api.apiKeys.revoke);
  const [name, setName] = useState("");
  // The key just created, until the page is left; only its hash is stored
  const [created, setCreated] = useState<{ key: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState<Id<"apiKeys"> | null>(null);
  const now = useNow(60 * 1000);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const { key } = await createKey({ name });
      setCreated({ key, name: name.trim() });
      setName("");
    } catch (err) {
      setError(err instanceof ConvexError ? String(err.data) : "Could not create a key");
    } finally {
      setPending(false);
    }
  }

  async function revoke(id: Id<"apiKeys">) {
    setError(null);
    try {
      await revokeKey({ id });
      setConfirming(null);
    } catch (err) {
      setError(err instanceof ConvexError ? String(err.data) : "Could not revoke the key");
    }
  }

  return (
    <Card id="mcp" className="scroll-mt-28">
      <CardHeader>
        <CardTitle>MCP server</CardTitle>
        <CardDescription>
          Ask Claude, Cursor or another AI assistant about your stats. The server is read-only: it lists your sites
          and reads their summary, chart, lists, pages, visitors and live count. A key reads every site in this
          account.
        </CardDescription>
      </CardHeader>
      <div className="flex flex-col gap-5 px-(--card-spacing)">
        <form onSubmit={create} className="flex flex-col gap-2 text-sm">
          <label htmlFor="mcp-key-name" className="font-medium text-strong">
            Create a key
          </label>
          <div className="flex gap-2">
            <input
              id="mcp-key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Laptop, Claude Desktop"
              maxLength={MAX_NAME}
              autoComplete="off"
              className="min-w-0 flex-1 rounded-md border border-line bg-panel px-3 py-2"
            />
            <button
              type="submit"
              disabled={pending || !name.trim()}
              className="shrink-0 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-40"
            >
              {pending ? "Creating…" : "Create key"}
            </button>
          </div>
          {error && <span className="text-down">{error}</span>}
        </form>

        {created && (
          <div className="flex flex-col gap-2 text-sm">
            <p className="text-muted-foreground">
              <span className="text-strong">{created.name}</span>: copy it now. It is shown once; only its hash is
              stored. The setup below has it filled in.
            </p>
            <div className="flex items-center gap-2 rounded-md border border-up/40 bg-panel px-3 py-2">
              <code className="min-w-0 flex-1 truncate font-mono text-xs">{created.key}</code>
              <CopyButton text={created.key} />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 text-sm">
          <h3 className="font-medium text-strong">Keys</h3>
          {keys === undefined ? (
            <div className="h-10 animate-pulse rounded bg-line/50" />
          ) : keys.length === 0 ? (
            <p className="text-muted-foreground">No keys yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
              {keys.map((k) => (
                <li key={k.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 pr-2 pl-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-strong">{k.name}</span>
                    <span className="text-xs text-muted-foreground">
                      <code className="font-mono">{k.prefix}…</code> · Created {dateFormat.format(k.createdAt)} ·{" "}
                      {k.lastUsedAt === null ? "Never used" : `Last used ${formatElapsed(now - k.lastUsedAt)} ago`}
                    </span>
                  </div>
                  {confirming === k.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => revoke(k.id)}
                        className="rounded-md bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 dark:bg-destructive/20"
                      >
                        Revoke
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(null)}
                        className="rounded-md border border-line px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirming(k.id)}
                      aria-label={`Revoke ${k.name}`}
                      className="rounded-md border border-line px-3 py-1.5 text-xs text-down hover:bg-muted"
                    >
                      Revoke…
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="text-muted-foreground">Revoking a key stops it at once; anything using it gets a 401.</p>
        </div>

        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <h3 className="text-sm font-medium text-strong">Connect a client</h3>
          <McpSetup apiKey={created?.key} />
        </div>
      </div>
    </Card>
  );
}
