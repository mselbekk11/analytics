"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Authenticated, AuthLoading, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../../convex/_generated/api";
import { Snippet } from "@/components/AddWebsiteForm";
import TimezoneSelect from "@/components/TimezoneSelect";
import SiteHeader from "@/components/dashboard/SiteHeader";

export default function SiteSettings() {
  const params = useParams<{ domain: string }>();
  const domain = decodeURIComponent(params.domain);
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader domain={domain} section="settings" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <AuthLoading>
          <p className="text-sm text-muted">Connecting…</p>
        </AuthLoading>
        <Authenticated>
          <Settings domain={domain} />
        </Authenticated>
      </main>
    </div>
  );
}

function Settings({ domain }: { domain: string }) {
  const site = useQuery(api.sites.get, { domain });
  // Set once the site is deleted, so the page does not flash "not found" while leaving
  const [removed, setRemoved] = useState(false);

  if (removed) return <p className="text-sm text-muted">Deleted. Going back to your sites…</p>;
  if (site === undefined) return <p className="text-sm text-muted">Loading…</p>;
  if (site === null) {
    return (
      <p className="text-sm text-muted">
        No site called <span className="font-mono">{domain}</span> in your account.{" "}
        <Link href="/websites" className="underline">
          Back to your sites
        </Link>
      </p>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Section
        title="Embed snippet"
        description={
          <>
            Paste this into the HTML of every page on {site.domain}, for example just before{" "}
            <code className="font-mono">&lt;/head&gt;</code>. It sets two first-party cookies,{" "}
            <code className="font-mono">_va_vid</code> and{" "}
            <code className="font-mono">_va_sid</code>, to recognise returning visitors and
            group pageviews into sessions. Add{" "}
            <code className="font-mono">data-cookieless</code> to the tag to set no cookies
            and count visits the old way.
          </>
        }
      >
        <Snippet domain={site.domain} />
      </Section>
      <TimezoneSection domain={site.domain} timezone={site.timezone} />
      <DeleteSection domain={site.domain} onDeleted={() => setRemoved(true)} />
    </div>
  );
}

function Section({
  title,
  description,
  tone = "normal",
  children,
}: {
  title: string;
  description: React.ReactNode;
  tone?: "normal" | "danger";
  children: React.ReactNode;
}) {
  return (
    <section
      className={`flex flex-col gap-4 rounded-lg border p-5 ${
        tone === "danger" ? "border-down/40" : "border-line bg-panel/40"
      }`}
    >
      <div className="flex flex-col gap-1">
        <h2 className={tone === "danger" ? "text-down" : "text-strong"}>{title}</h2>
        <p className="text-sm text-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

function TimezoneSection({ domain, timezone }: { domain: string; timezone: string }) {
  const update = useMutation(api.sites.update);
  const [value, setValue] = useState(timezone);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    try {
      await update({ domain, timezone: value });
      setStatus({ ok: true, text: "Saved" });
    } catch (err) {
      setStatus({
        ok: false,
        text: err instanceof ConvexError ? String(err.data) : "Could not save the timezone",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Section
      title="Timezone"
      description="Sets where each day starts and ends. A change only applies to new pageviews; days already counted keep their dates."
    >
      <form onSubmit={save} className="flex flex-wrap items-center gap-3 text-sm">
        <TimezoneSelect
          value={value}
          onChange={(tz) => {
            setValue(tz);
            setStatus(null);
          }}
        />
        <button
          type="submit"
          disabled={pending || value === timezone}
          className="rounded-md bg-strong px-4 py-2 font-medium text-zinc-900 disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {status && <span className={status.ok ? "text-up" : "text-down"}>{status.text}</span>}
      </form>
    </Section>
  );
}

function DeleteSection({ domain, onDeleted }: { domain: string; onDeleted: () => void }) {
  const remove = useMutation(api.sites.remove);
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await remove({ domain });
      onDeleted();
      router.replace("/websites");
    } catch (err) {
      setError(err instanceof ConvexError ? String(err.data) : "Could not delete the site");
      setPending(false);
    }
  }

  return (
    <Section
      tone="danger"
      title="Delete website"
      description={`Deletes ${domain} and all of its stats. This cannot be undone. Remove the snippet from the site as well, or its hits will simply be ignored.`}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3 text-sm sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-muted">
            Type <span className="font-mono text-strong">{domain}</span> to confirm
          </span>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="rounded-md border border-line bg-panel px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={pending || confirm.trim().toLowerCase() !== domain}
          className="rounded-md bg-down px-4 py-2 font-medium text-zinc-950 disabled:opacity-40"
        >
          {pending ? "Deleting…" : "Delete website"}
        </button>
      </form>
      {error && <p className="text-sm text-down">{error}</p>}
    </Section>
  );
}
