"use client";

import { useState } from "react";
import { Authenticated, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../convex/_generated/api";

// Only rendered inside <Authenticated>, i.e. on the client, so Intl reflects the browser.
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const timeZones = () => Intl.supportedValuesOf("timeZone");

// Snippets must point at the stable production address, never a deployment-specific
// URL (those sit behind Vercel's login). Vercel sets this at build time and switches it
// to the custom domain once one is attached; locally it is unset, so use this origin.
function appOrigin(): string {
  const host = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
  return host ? `https://${host}` : window.location.origin;
}

export default function AddWebsiteForm() {
  return (
    <Authenticated>
      <Form />
    </Authenticated>
  );
}

function Form() {
  const create = useMutation(api.sites.create);
  const [domain, setDomain] = useState("");
  const [timezone, setTimezone] = useState(browserTimeZone);
  const [zones] = useState(timeZones);
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

  const snippet = added
    ? `<script async src="${appOrigin()}/script.js" data-site="${added}"></script>`
    : null;

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="text-zinc-400">Domain</span>
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
            required
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-400">Timezone</span>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
          >
            {zones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add website"}
        </button>
      </form>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {snippet && (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-green-400">Added {added}. Paste this into the site&apos;s HTML:</p>
          <code className="block break-all rounded-md bg-zinc-900 p-3 font-mono text-xs">{snippet}</code>
        </div>
      )}
    </div>
  );
}
