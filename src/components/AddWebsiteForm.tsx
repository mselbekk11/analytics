"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../convex/_generated/api";
import { embedSnippet } from "@/lib/snippet";
import CopyButton from "./CopyButton";
import TimezoneSelect from "./TimezoneSelect";

// Rendered only inside <Authenticated>, i.e. on the client, so Intl reflects the browser.
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export default function AddWebsiteForm() {
  const create = useMutation(api.sites.create);
  const [domain, setDomain] = useState("");
  const [timezone, setTimezone] = useState(browserTimeZone);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setAdded(null);
    setPending(true);
    try {
      const result = await create({ domain, timezone });
      setAdded(result.domain);
      setDomain("");
    } catch (err) {
      setError(err instanceof ConvexError ? String(err.data) : "Could not add the website");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Domain</span>
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
            required
            className="rounded-md border border-line bg-panel px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Timezone</span>
          <TimezoneSelect value={timezone} onChange={setTimezone} />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add website"}
        </button>
      </form>
      {error && <p className="text-sm text-down">{error}</p>}
      {added && (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-up">
            Added {added}. Paste this into the site&apos;s HTML, or find it later under{" "}
            <Link href={`/sites/${encodeURIComponent(added)}/settings`} className="underline">
              Settings
            </Link>
            :
          </p>
          <Snippet domain={added} />
        </div>
      )}
    </div>
  );
}

export function Snippet({ domain }: { domain: string }) {
  const snippet = embedSnippet(domain);
  return (
    <div className="flex items-start gap-2 rounded-md border border-line bg-panel p-3">
      <code className="flex-1 break-all font-mono text-xs leading-5">{snippet}</code>
      <CopyButton text={snippet} />
    </div>
  );
}
