"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Authenticated, AuthLoading, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../../convex/_generated/api";
import { Snippet } from "@/components/AddWebsiteForm";
import CopyButton from "@/components/CopyButton";
import TimezoneSelect from "@/components/TimezoneSelect";
import { embedSnippet } from "@/lib/snippet";
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
      <GoalsSection domain={site.domain} keyGoal={site.keyGoal} />
      <TimezoneSection domain={site.domain} timezone={site.timezone} />
      <DeleteSection domain={site.domain} onDeleted={() => setRemoved(true)} />
    </div>
  );
}

function Section({
  id,
  title,
  description,
  tone = "normal",
  children,
}: {
  id?: string;
  title: string;
  description: React.ReactNode;
  tone?: "normal" | "danger";
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
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

// Defines window.analytics until the script loads, so calls made before then are queued
const STUB =
  "<script>window.analytics=window.analytics||function(){(window.analytics.q=window.analytics.q||[]).push(arguments)}</script>";

const GOALS_SNIPPET = `<!-- Once, right after the analytics snippet -->
${STUB}

<!-- A goal when this element is clicked -->
<button data-goal="signup">Sign up</button>

<script>
  // A goal from your own code, with up to 10 optional properties
  analytics("goal", "signup", { plan: "pro" });

  // Link the signed-in user to this visitor (id, email and name are all optional)
  analytics("identify", { id: "user_123", email: "jo@example.com", name: "Jo" });
</script>`;

/** A prompt to paste into Claude Code (or another coding agent) in the site's own codebase. */
function goalsPrompt(domain: string, keyGoal: string | null): string {
  return `Add goal tracking for my self-hosted analytics to this codebase (the site ${domain}).

The analytics script is already on every page:
${embedSnippet(domain)}

1. Right after that script tag, add this stub once, so calls made before the script loads are queued:
${STUB}
   In a framework (Next.js, React, ...) put both in the root layout. In TypeScript, declare \`window.analytics\` as \`(...args: unknown[]) => void\`.
2. Find the actions that matter to this business: sign-ups, bookings, contact or quote forms, newsletter sign-ups, demo requests, purchases. When each one succeeds (not when the button is clicked), call:
   window.analytics("goal", "<name>", { optional: "properties" })
   Use short lowercase names such as signup, booking, contact, newsletter. Properties are optional (at most 10, string values). Never put personal data such as emails in a goal or its properties.
3. For a plain button or link that is the goal itself, add data-goal="<name>" to the element instead of code.
4. Wherever a user signs up or signs in, call:
   window.analytics("identify", { id: user.id, email: user.email, name: user.name })
   Leave out any field the site does not have.
5. Clicks on links to other websites are tracked automatically; add nothing for them.
${keyGoal ? `
The key goal for this site is "${keyGoal}". Make sure it fires on the action it stands for.
` : ""}
When you are done, list every goal name you added and where it fires.`;
}

function GoalsSection({ domain, keyGoal }: { domain: string; keyGoal: string | null }) {
  const names = useQuery(api.sites.goalNames, { domain });
  const setKeyGoal = useMutation(api.sites.setKeyGoal);
  const [value, setValue] = useState(keyGoal ?? "");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    try {
      await setKeyGoal({ domain, keyGoal: value.trim() || null });
      setStatus({ ok: true, text: "Saved" });
    } catch (err) {
      setStatus({
        ok: false,
        text: err instanceof ConvexError ? String(err.data) : "Could not save the key goal",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Section
      id="goals"
      title="Goals"
      description={
        <>
          Count sign-ups, bookings and other actions. Add{" "}
          <code className="font-mono">data-goal</code> to an element, or call{" "}
          <code className="font-mono">analytics(&quot;goal&quot;, name)</code> from your code.{" "}
          <code className="font-mono">identify</code> stores the user&apos;s id, email and name on
          their visitor. Clicks on links to other sites are counted automatically. With{" "}
          <code className="font-mono">data-cookieless</code>, goals and links still count but
          identify is ignored.
        </>
      }
    >
      <div className="flex flex-col gap-2 rounded-md border border-line bg-panel p-3">
        <div className="flex justify-end gap-2">
          <CopyButton text={goalsPrompt(domain, keyGoal)} label="Copy AI prompt" />
          <CopyButton text={GOALS_SNIPPET} />
        </div>
        <pre className="overflow-x-auto font-mono text-xs leading-5">{GOALS_SNIPPET}</pre>
      </div>
      <form onSubmit={save} className="flex flex-col gap-2 text-sm">
        <label htmlFor="key-goal" className="text-muted">
          Key goal: what counts as a conversion on this site, until it has revenue. Pick a
          recorded goal or type a name; leave empty for none.
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            id="key-goal"
            list="goal-names"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setStatus(null);
            }}
            placeholder="signup"
            autoComplete="off"
            spellCheck={false}
            className="rounded-md border border-line bg-panel px-3 py-2"
          />
          <datalist id="goal-names">
            {names?.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <button
            type="submit"
            disabled={pending || value.trim() === (keyGoal ?? "")}
            className="rounded-md bg-strong px-4 py-2 font-medium text-zinc-900 disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          {status && <span className={status.ok ? "text-up" : "text-down"}>{status.text}</span>}
        </div>
        {names !== undefined && names.length === 0 && (
          <p className="text-muted">No goals recorded yet; they appear here after their first completion.</p>
        )}
      </form>
    </Section>
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
