"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Authenticated, AuthLoading, useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { PlusIcon, XIcon } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import {
  DEFAULT_PLACEHOLDER,
  MAX_EXCLUDED_PATHS,
  MAX_NAMED_PATTERNS,
  groupPath,
  parseExcludedPath,
  parseNamedPattern,
  parsePlaceholder,
  type PathGrouping,
} from "../../../convex/lib/paths";
import Snippet from "@/components/Snippet";
import CopyButton from "@/components/CopyButton";
import McpSetup from "@/components/McpSetup";
import TimezoneSelect from "@/components/TimezoneSelect";
import { normalizePath } from "@/lib/collect";
import { appOrigin, embedSnippet, ignoreUrl } from "@/lib/snippet";
import PageHeader from "@/components/PageHeader";
import TopBar, { sitePath } from "@/components/TopBar";

export default function SiteSettings() {
  const params = useParams<{ domain: string }>();
  const domain = decodeURIComponent(params.domain);
  return (
    <div className="flex flex-1 flex-col">
      <TopBar site={{ domain, section: "settings" }} />
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 pt-10 pb-20 sm:px-6 lg:px-8">
        <AuthLoading>
          <p className="text-sm text-muted-foreground">Connecting…</p>
        </AuthLoading>
        <Authenticated>
          <Settings domain={domain} />
        </Authenticated>
      </main>
    </div>
  );
}

type SectionId =
  | "tracking"
  | "timezone"
  | "goals"
  | "revenue"
  | "identity"
  | "mcp"
  | "ignore"
  | "paths"
  | "excluded"
  | "danger";

// The sidebar, in order. A hidden group is left out of the sidebar but its sections still open by URL
const GROUPS: { label: string; hidden?: boolean; sections: { id: SectionId; label: string }[] }[] = [
  {
    label: "Install",
    sections: [
      { id: "tracking", label: "Tracking code" },
      { id: "timezone", label: "Timezone" },
    ],
  },
  {
    label: "Attribution",
    hidden: true,
    sections: [
      { id: "goals", label: "Goals & conversions" },
      { id: "revenue", label: "Revenue attribution" },
    ],
  },
  { label: "Privacy", sections: [{ id: "identity", label: "Visitor identity" }] },
  { label: "Integrations", sections: [{ id: "mcp", label: "MCP server" }] },
  {
    label: "Filtering",
    sections: [
      { id: "ignore", label: "Ignore my visits" },
      { id: "paths", label: "Page paths" },
      { id: "excluded", label: "Excluded paths" },
    ],
  },
  { label: "Danger zone", sections: [{ id: "danger", label: "Danger zone" }] },
];
const SECTION_IDS = new Set<string>(GROUPS.flatMap((g) => g.sections.map((s) => s.id)));
const SHOWN_GROUPS = GROUPS.filter((g) => !g.hidden);

function Settings({ domain }: { domain: string }) {
  const site = useQuery(api.sites.get, { domain });
  const searchParams = useSearchParams();
  const router = useRouter();
  // Set once the site is deleted, so the page does not flash "not found" while leaving
  const [removed, setRemoved] = useState(false);

  if (removed) return <p className="text-sm text-muted-foreground">Deleted. Going back to your sites…</p>;
  if (site === undefined) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (site === null) {
    return (
      <p className="text-sm text-muted-foreground">
        No site called <span className="font-mono">{domain}</span> in your account.{" "}
        <Link href="/websites" className="underline">
          Back to your sites
        </Link>
      </p>
    );
  }

  const asked = searchParams.get("section") ?? "";
  const section = (SECTION_IDS.has(asked) ? asked : "tracking") as SectionId;
  const href = (id: SectionId) => `${sitePath(site.domain, "settings")}?section=${id}`;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Settings" description={site.domain} />
      <div className="grid gap-8 md:grid-cols-[200px_minmax(0,1fr)] lg:gap-12">
        <nav aria-label="Settings sections" className="hidden flex-col gap-6 md:flex">
          {SHOWN_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col gap-1">
              <h2 className="px-2.5 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {group.label}
              </h2>
              {group.sections.map((s) => (
                <Link
                  key={s.id}
                  href={href(s.id)}
                  scroll={false}
                  aria-current={s.id === section ? "page" : undefined}
                  className={`rounded-md px-2.5 py-1.5 text-sm ${
                    s.id === "danger"
                      ? "text-down hover:bg-muted"
                      : s.id === section
                        ? "text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  } ${s.id === section ? "bg-muted font-medium" : ""}`}
                >
                  {s.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        {/* On phones the sidebar is a select */}
        <select
          aria-label="Settings section"
          value={section}
          onChange={(e) => router.push(href(e.target.value as SectionId), { scroll: false })}
          className="rounded-md border border-line bg-panel px-3 py-2 text-sm md:hidden"
        >
          {SHOWN_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <div className="min-w-0">
          {section === "tracking" && (
            <Section
              title="Tracking code"
              description={
                <>
                  Paste this into the HTML of every page on {site.domain}, for example just before{" "}
                  <code className="font-mono">&lt;/head&gt;</code>. It sets two first-party cookies,{" "}
                  <code className="font-mono">_va_vid</code> and{" "}
                  <code className="font-mono">_va_sid</code>, to recognise returning visitors and
                  group pageviews into sessions. To run without them, pick Cookieless under{" "}
                  <Link href={href("identity")} scroll={false} className="underline hover:text-foreground">
                    Visitor identity
                  </Link>
                  , or add <code className="font-mono">data-cookieless</code> to the tag.
                </>
              }
            >
              <Snippet domain={site.domain} />
            </Section>
          )}
          {section === "timezone" && <TimezoneSection domain={site.domain} timezone={site.timezone} />}
          {section === "goals" && <GoalsSection domain={site.domain} keyGoal={site.keyGoal} />}
          {section === "revenue" && <RevenueSection domain={site.domain} />}
          {section === "identity" && <IdentitySection domain={site.domain} cookieless={site.cookieless} />}
          {section === "mcp" && <McpSection domain={site.domain} />}
          {section === "ignore" && <IgnoreSection domain={site.domain} />}
          {section === "paths" && <PathsSection domain={site.domain} />}
          {section === "excluded" && <ExcludedSection domain={site.domain} />}
          {section === "danger" && <DeleteSection domain={site.domain} onDeleted={() => setRemoved(true)} />}
        </div>
      </div>
    </div>
  );
}

/** One settings section: its title and description, then its settings in a bordered card. */
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
    <section aria-labelledby="settings-section" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2
          id="settings-section"
          className={`text-lg font-semibold ${tone === "danger" ? "text-down" : "text-foreground"}`}
        >
          {title}
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
      </div>
      <div
        className={`flex flex-col gap-4 rounded-lg border p-4 sm:p-5 ${
          tone === "danger" ? "border-down/40" : "border-line"
        }`}
      >
        {children}
      </div>
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
      title="Goals & conversions"
      description={
        <>
          Count sign-ups, bookings and other actions. Add{" "}
          <code className="font-mono">data-goal</code> to an element, or call{" "}
          <code className="font-mono">analytics(&quot;goal&quot;, name)</code> from your code.{" "}
          <code className="font-mono">identify</code> stores the user&apos;s id, email and name on
          their visitor. Clicks on links to other sites are counted automatically. On a
          cookieless site, goals and links still count but identify is ignored.
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
        <label htmlFor="key-goal" className="text-muted-foreground">
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
            className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          {status && <span className={status.ok ? "text-up" : "text-down"}>{status.text}</span>}
        </div>
        {names !== undefined && names.length === 0 && (
          <p className="text-muted-foreground">No goals recorded yet; they appear here after their first completion.</p>
        )}
      </form>
    </Section>
  );
}

const IDENTITY_MODES = [
  {
    cookieless: false,
    label: "Cookies (visitor and session ids)",
    text: (
      <>
        Sets two first-party cookies on your domain, <code className="font-mono">_va_vid</code> (400 days)
        and <code className="font-mono">_va_sid</code> (30 minutes). Returning visitors are recognised, so
        you get visitors, sessions, bounce rate, journeys, the Users tab and Live, and a payment weeks later
        is credited to the source that first brought the visitor.
      </>
    ),
  },
  {
    cookieless: true,
    label: "Cookieless",
    text: (
      <>
        No ids at all. Pageviews, pages, sources, goals and time on page still count, and a visitor is a
        unique visit (one arriving from another site or typed in), so one person on two days counts twice.
        You lose sessions, bounce rate, journeys, the Users tab, Live and revenue attribution. Ids are
        stripped from every hit on our side, even from an old snippet, and the script deletes its cookies
        after its next pageview.
      </>
    ),
  },
] as const;

function IdentitySection({ domain, cookieless }: { domain: string; cookieless: boolean }) {
  const setCookieless = useMutation(api.sites.setCookieless);
  const [value, setValue] = useState(cookieless);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    try {
      await setCookieless({ domain, cookieless: value });
      setStatus({ ok: true, text: "Saved" });
    } catch (err) {
      setStatus({ ok: false, text: err instanceof ConvexError ? String(err.data) : "Could not save" });
    } finally {
      setPending(false);
    }
  }

  return (
    <Section
      title="Visitor identity"
      description={
        <>
          How the script recognises a returning visitor. The change applies to new hits; what is stored
          stays as it is. Switching back to cookies resumes ids from each visitor&apos;s next visit.
        </>
      }
    >
      <form onSubmit={save} className="flex flex-col gap-3 text-sm">
        <div role="radiogroup" aria-label="Visitor identity" className="flex flex-col gap-2">
          {IDENTITY_MODES.map((mode) => (
            <label
              key={mode.label}
              className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 sm:p-4 ${
                value === mode.cookieless ? "border-link" : "border-line hover:bg-muted/50"
              }`}
            >
              <input
                type="radio"
                name="visitor-identity"
                checked={value === mode.cookieless}
                onChange={() => {
                  setValue(mode.cookieless);
                  setStatus(null);
                }}
                className="mt-0.5 accent-link"
              />
              <span className="flex flex-col gap-1">
                <span className="font-medium text-strong">{mode.label}</span>
                <span className="text-muted-foreground">{mode.text}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="text-muted-foreground">
          In Cookieless mode the script keeps one flag in the browser&apos;s localStorage,{" "}
          <code className="font-mono">_va_nc</code>, so later page loads set no cookies; it holds no id. For no
          storage at all, from the first hit, also add <code className="font-mono">data-cookieless</code> to the
          snippet. A snippet with <code className="font-mono">data-cookieless</code> stays cookieless whatever is
          picked here.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending || value === cookieless}
            className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          {status && <span className={status.ok ? "text-up" : "text-down"}>{status.text}</span>}
        </div>
      </form>
    </Section>
  );
}

/** The MCP setup for this site; keys are account-wide, so they live in account Settings. */
function McpSection({ domain }: { domain: string }) {
  return (
    <Section
      title="MCP server"
      description={
        <>
          Ask Claude, Cursor or another AI assistant about {domain}&apos;s stats. The server is read-only and uses
          an API key from your account, which reads every site you own.
        </>
      }
    >
      <p className="text-sm text-muted-foreground">
        <Link href="/settings#mcp" className="underline hover:text-foreground">
          Create or revoke keys in account Settings
        </Link>
        , then connect a client:
      </p>
      <McpSetup domain={domain} />
    </Section>
  );
}

function IgnoreSection({ domain }: { domain: string }) {
  const links = [
    { url: ignoreUrl(domain, true), label: "Ignore this browser", text: "Open once on each browser you use." },
    { url: ignoreUrl(domain, false), label: "Undo", text: "Tracks this browser again from that page load." },
  ];
  return (
    <Section
      title="Ignore my visits"
      description={
        <>
          Keep your own testing out of the stats. Open the first link in a browser and the script on{" "}
          {domain} stops sending anything from it: no pageviews, goals or outbound clicks. The second link
          undoes it. Past visits stay as they are.
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        {links.map((link) => (
          <div key={link.label} className="flex flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-strong">{link.label}</span>
              <span className="text-muted-foreground">{link.text}</span>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-line bg-panel py-2 pr-2 pl-3">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate font-mono text-xs hover:underline"
              >
                {link.url}
              </a>
              <CopyButton text={link.url} />
            </div>
          </div>
        ))}
        <p className="text-muted-foreground">
          It works per browser and per site: the script keeps a{" "}
          <code className="font-mono">_va_ignore</code> flag in that browser&apos;s localStorage for {domain},
          so repeat it on your phone and in each other browser, and on every subdomain you track. Private
          windows and clearing the site&apos;s data forget it. Any page of the site with the snippet works;
          add <code className="font-mono">?_va_ignore=1</code> to its URL.
        </p>
      </div>
    </Section>
  );
}

const CHECKOUT_SNIPPET = `// In the browser, when the visitor starts checkout: send the ids to your server
const attribution = window.analytics?.("attribution") ?? {}; // { va_vid, va_sid }

// On your server, where you create the Stripe Checkout Session
const session = await stripe.checkout.sessions.create({
  // ...your line_items and mode
  success_url: "https://example.com/thanks?session_id={CHECKOUT_SESSION_ID}",
  metadata: attribution,
  // Subscriptions only: the invoices read the subscription's metadata
  subscription_data: { metadata: attribution },
});`;

function apiSnippet(origin: string): string {
  return `curl ${origin}/api/payments \\
  -H "Authorization: Bearer $ANALYTICS_PAYMENTS_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"id":"order_1001","amount":4900,"currency":"USD","email":"jo@example.com","visitorId":"<va_vid>"}'

# amount is in cents; add "refund": true (with the refund's own id) for a refund.
# Optional: customerId, sessionId, ts (Unix time).`;
}

/** A prompt for a coding agent in the site's own codebase: pass the visitor ids into checkout. */
function revenuePrompt(domain: string, source: "stripe" | "api", origin: string): string {
  const common = `My self-hosted analytics script is on every page of this site (${domain}):
${embedSnippet(domain)}

It defines window.analytics("attribution"), which returns { va_vid, va_sid }: the visitor and session ids from its first-party cookies (an empty object if the script has not loaded or cookies are off). In TypeScript, declare \`window.analytics\` as \`(...args: unknown[]) => any\`.`;
  if (source === "stripe") {
    return `Link Stripe payments on this site to my analytics, so I can see which sources bring revenue.

${common}

1. Find every place this codebase creates a Stripe Checkout Session (stripe.checkout.sessions.create, or a Payment Link / pricing-table flow).
2. In the browser, when the visitor starts checkout, read window.analytics?.("attribution") ?? {} and send it to the server along with the checkout request.
3. On the server, add it to the Checkout Session as metadata: { va_vid, va_sid } (strings, only the two keys, ignore anything else the client sent). For subscriptions (mode: "subscription"), also set subscription_data.metadata to the same object, so renewals are linked too.
4. Make sure success_url includes ?session_id={CHECKOUT_SESSION_ID} and that the success page loads the analytics script; it sends the id back as a fallback.
5. If customers sign in, make sure window.analytics("identify", { id, email, name }) runs after sign-in, so payments can also be matched by email.

Do not change prices, products or the payment flow otherwise. When you are done, list each file you changed.`;
  }
  return `Report payments on this site to my analytics, so I can see which sources bring revenue.

${common}

The analytics app has a payments API: POST ${origin}/api/payments with the header Authorization: Bearer <key>, where the key is in the environment variable ANALYTICS_PAYMENTS_KEY (server-side only, never sent to the browser). The JSON body is:
{ "id": string (unique per payment), "amount": integer in the smallest currency unit (cents), "currency": "USD", "email"?: string, "customerId"?: string, "visitorId"?: va_vid, "sessionId"?: va_sid, "ts"?: Unix time, "refund"?: true }
It answers 200 (also for a repeated id, which is not counted twice), 400 with { error } for a bad body, and 401 for a wrong key.

1. Find where this codebase learns that a payment succeeded (a payment provider's webhook handler, an order-paid hook, ...).
2. When the visitor starts checkout, read window.analytics?.("attribution") ?? {} in the browser and store va_vid and va_sid with the order (or pass them through the provider's metadata), so the payment handler has them.
3. In the payment handler, POST the payment to the API with those ids, the customer's email and the provider's payment id. Send refunds the same way with "refund": true and the refund's own id. Never let a failure of this call break the payment handler: log it and move on.

Add ANALYTICS_PAYMENTS_KEY to the environment example file without a value. When you are done, list each file you changed.`;
}

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "NZD", "CHF", "SEK", "NOK", "DKK", "JPY", "INR", "BRL", "MXN", "SGD"];

function RevenueSection({ domain }: { domain: string }) {
  const settings = useQuery(api.sites.revenueSettings, { domain });
  if (settings === undefined) {
    return (
      <Section title="Revenue attribution" description="Loading…">
        <div className="h-10 animate-pulse rounded bg-line/50" />
      </Section>
    );
  }
  return <RevenueForm key={`${settings.revenueSource}${settings.currency}`} domain={domain} settings={settings} />;
}

type RevenueSettings = FunctionReturnType<typeof api.sites.revenueSettings>;

function RevenueForm({ domain, settings }: { domain: string; settings: RevenueSettings }) {
  const setRevenue = useMutation(api.sites.setRevenue);
  const [source, setSource] = useState(settings.revenueSource);
  const [currency, setCurrency] = useState(settings.currency);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const changed = source !== settings.revenueSource || currency !== settings.currency;
  const currencies = CURRENCIES.includes(settings.currency) ? CURRENCIES : [settings.currency, ...CURRENCIES];

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    try {
      await setRevenue({ domain, revenueSource: source, currency });
      setStatus({ ok: true, text: "Saved" });
    } catch (err) {
      setStatus({ ok: false, text: err instanceof ConvexError ? String(err.data) : "Could not save" });
    } finally {
      setPending(false);
    }
  }

  return (
    <Section
      title="Revenue attribution"
      description={
        <>
          Link payments to the visitors and sources that brought them. With None, the dashboard
          has no revenue and uses the key goal as its conversion. Payments in another currency
          are stored but left out of the totals.
        </>
      }
    >
      <form onSubmit={save} className="flex flex-col gap-3 text-sm">
        <div role="radiogroup" aria-label="Revenue source" className="flex flex-wrap gap-2">
          {(
            [
              ["none", "None"],
              ["stripe", "Stripe"],
              ["api", "Payments API"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`cursor-pointer rounded-md border px-3 py-1.5 ${
                source === value ? "border-link text-strong" : "border-line text-muted-foreground hover:text-strong"
              }`}
            >
              <input
                type="radio"
                name="revenue-source"
                value={value}
                checked={source === value}
                onChange={() => {
                  setSource(value);
                  setStatus(null);
                }}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="currency" className="text-muted-foreground">
            Currency
          </label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => {
              setCurrency(e.target.value);
              setStatus(null);
            }}
            className="rounded-md border border-line bg-panel px-3 py-2"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending || !changed}
            className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          {status && <span className={status.ok ? "text-up" : "text-down"}>{status.text}</span>}
        </div>
      </form>
      {settings.revenueSource === "stripe" && <StripeSetup domain={domain} settings={settings} />}
      {settings.revenueSource === "api" && <ApiSetup domain={domain} settings={settings} />}
    </Section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <h3 className="text-strong">
        {n}. {title}
      </h3>
      {children}
    </div>
  );
}

function CodeBox({ text, extra }: { text: string; extra?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-panel p-3">
      <div className="flex justify-end gap-2">
        {extra}
        <CopyButton text={text} />
      </div>
      <pre className="overflow-x-auto font-mono text-xs leading-5">{text}</pre>
    </div>
  );
}

function StripeSetup({ domain, settings }: { domain: string; settings: RevenueSettings }) {
  const setSecret = useMutation(api.sites.setStripeSecret);
  const [secret, setSecretValue] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    try {
      await setSecret({ domain, secret });
      setSecretValue("");
      setStatus({ ok: true, text: "Saved" });
    } catch (err) {
      setStatus({ ok: false, text: err instanceof ConvexError ? String(err.data) : "Could not save the secret" });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 border-t border-line pt-4">
      <Step n={1} title="Add a webhook endpoint in Stripe">
        <p className="text-muted-foreground">
          In Stripe, open Developers → Webhooks → Add destination, choose your account&apos;s events,
          paste this URL and select the events below. Do it in test mode first to try it.
        </p>
        <div className="flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2">
          <code className="min-w-0 flex-1 truncate font-mono text-xs">{settings.webhookUrl}</code>
          <CopyButton text={settings.webhookUrl} />
        </div>
        <ul className="flex flex-wrap gap-2">
          {settings.webhookEvents.map((e) => (
            <li key={e} className="rounded bg-panel px-2 py-0.5 font-mono text-xs">
              {e}
            </li>
          ))}
        </ul>
      </Step>
      <Step n={2} title="Paste its signing secret">
        <form onSubmit={save} className="flex flex-wrap items-center gap-3">
          <input
            type="password"
            value={secret}
            onChange={(e) => {
              setSecretValue(e.target.value);
              setStatus(null);
            }}
            placeholder={settings.hasWebhookSecret ? "whsec_… (saved; paste to replace)" : "whsec_…"}
            autoComplete="off"
            spellCheck={false}
            aria-label="Stripe webhook signing secret"
            className="min-w-64 flex-1 rounded-md border border-line bg-panel px-3 py-2 font-mono"
          />
          <button
            type="submit"
            disabled={pending || !secret.trim()}
            className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          {status ? (
            <span className={status.ok ? "text-up" : "text-down"}>{status.text}</span>
          ) : (
            <span className={settings.hasWebhookSecret ? "text-up" : "text-muted-foreground"}>
              {settings.hasWebhookSecret ? "Secret saved" : "Not set: payments are not recorded yet"}
            </span>
          )}
        </form>
      </Step>
      <Step n={3} title="Pass the visitor into checkout">
        <p className="text-muted-foreground">
          Put the ids from <code className="font-mono">analytics(&quot;attribution&quot;)</code> into the
          Checkout Session&apos;s metadata. Without them, payments are still linked from the success page (
          <code className="font-mono">?session_id=&#123;CHECKOUT_SESSION_ID&#125;</code>), an earlier payment of
          the same customer, or an email from <code className="font-mono">identify</code>.
        </p>
        <CodeBox
          text={CHECKOUT_SNIPPET}
          extra={<CopyButton text={revenuePrompt(domain, "stripe", appOrigin())} label="Copy AI prompt" />}
        />
      </Step>
    </div>
  );
}

function ApiSetup({ domain, settings }: { domain: string; settings: RevenueSettings }) {
  const createKey = useAction(api.sites.createApiKey);
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const origin = appOrigin();

  async function create() {
    setPending(true);
    setError(null);
    try {
      setKey(await createKey({ domain }));
    } catch (err) {
      setError(err instanceof ConvexError ? String(err.data) : "Could not create a key");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 border-t border-line pt-4">
      <Step n={1} title="Create an API key">
        <p className="text-muted-foreground">
          The key is shown once; only its hash is stored. A new key replaces the old one at once.
          Keep it on your server.
        </p>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button
            type="button"
            onClick={create}
            disabled={pending}
            className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-40"
          >
            {pending ? "Creating…" : settings.hasApiKey || key ? "Replace key" : "Create key"}
          </button>
          {!key && settings.hasApiKey && <span className="text-up">A key is set</span>}
          {error && <span className="text-down">{error}</span>}
        </div>
        {key && (
          <div className="flex items-center gap-2 rounded-md border border-up/40 bg-panel px-3 py-2">
            <code className="min-w-0 flex-1 truncate font-mono text-xs">{key}</code>
            <CopyButton text={key} />
          </div>
        )}
      </Step>
      <Step n={2} title="Send each payment from your server">
        <CodeBox
          text={apiSnippet(origin)}
          extra={<CopyButton text={revenuePrompt(domain, "api", origin)} label="Copy AI prompt" />}
        />
      </Step>
    </div>
  );
}

const PATHS_DESCRIPTION =
  "Collapse id-like URL segments (UUIDs, long numbers, long hashes) into a placeholder in the Pages, Entry and Exit lists, so per-record pages group into one row and raw ids stay out of your analytics.";

const CODE = "rounded border border-line px-1 font-mono text-xs";

function PathsSection({ domain }: { domain: string }) {
  const saved = useQuery(api.sites.pathGrouping, { domain });
  if (saved === undefined) {
    return (
      <Section title="Page paths" description={PATHS_DESCRIPTION}>
        <div className="h-10 animate-pulse rounded bg-line/50" />
      </Section>
    );
  }
  // Not keyed on `saved`: a save must not remount the form and lose its "Saved"
  return <PathsForm domain={domain} saved={saved} />;
}

function PathsForm({ domain, saved }: { domain: string; saved: PathGrouping }) {
  const setPathGrouping = useMutation(api.sites.setPathGrouping);
  const [enabled, setEnabled] = useState(saved.enabled);
  const [placeholder, setPlaceholder] = useState(saved.placeholder);
  const [patterns, setPatterns] = useState(saved.patterns);
  const [draft, setDraft] = useState("");
  const [example, setExample] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const parsedPlaceholder = parsePlaceholder(placeholder);
  const placeholderError = "error" in parsedPlaceholder ? parsedPlaceholder.error : null;
  const changed =
    enabled !== saved.enabled ||
    placeholder.trim() !== saved.placeholder ||
    patterns.join("\n") !== saved.patterns.join("\n");
  const full = patterns.length >= MAX_NAMED_PATTERNS;

  // The preview runs what ingest runs, on the path /api/collect would store
  const examplePath = normalizePath(example.trim() || "/orders/123456");
  const grouping: PathGrouping = {
    enabled,
    placeholder: "placeholder" in parsedPlaceholder ? parsedPlaceholder.placeholder : DEFAULT_PLACEHOLDER,
    patterns,
  };
  const grouped = groupPath(examplePath, grouping);

  function edited() {
    setStatus(null);
  }

  function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseNamedPattern(draft);
    if ("error" in parsed) {
      setStatus({ ok: false, text: parsed.error });
      return;
    }
    if (!patterns.includes(parsed.pattern)) setPatterns([...patterns, parsed.pattern]);
    setDraft("");
    setStatus(null);
  }

  async function save() {
    setPending(true);
    setStatus(null);
    try {
      await setPathGrouping({ domain, enabled, placeholder, patterns });
      if ("placeholder" in parsedPlaceholder) setPlaceholder(parsedPlaceholder.placeholder);
      setStatus({ ok: true, text: "Saved" });
    } catch (err) {
      setStatus({ ok: false, text: err instanceof ConvexError ? String(err.data) : "Could not save" });
    } finally {
      setPending(false);
    }
  }

  return (
    <Section title="Page paths" description={PATHS_DESCRIPTION}>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          role="switch"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            edited();
          }}
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
        <span className="flex flex-col gap-1">
          <span className="font-medium text-foreground">Group dynamic path IDs</span>
          <span className="text-muted-foreground">
            UUIDs, segments of 6 or more digits and hashes of 16 or more characters become the
            placeholder. Plain slugs like <code className={CODE}>/pricing</code> are left alone. Applies
            to new hits only; pages already counted keep their paths.
          </span>
        </span>
      </label>

      <div className="flex flex-col gap-1.5 text-sm">
        <label htmlFor="path-placeholder" className="font-medium text-foreground">
          Placeholder name
        </label>
        <input
          id="path-placeholder"
          value={placeholder}
          onChange={(e) => {
            setPlaceholder(e.target.value);
            edited();
          }}
          placeholder={DEFAULT_PLACEHOLDER}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={placeholderError !== null}
          aria-describedby="path-placeholder-hint"
          className="w-full max-w-60 rounded-md border border-line bg-panel px-3 py-2 font-mono"
        />
        <p id="path-placeholder-hint" className={placeholderError ? "text-down" : "text-muted-foreground"}>
          {placeholderError ?? (
            <>
              Auto-detected ids show as <code className={CODE}>{grouping.placeholder}</code> (default{" "}
              <code className={CODE}>{DEFAULT_PLACEHOLDER}</code>).
            </>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <h3 className="font-medium text-foreground">Named path patterns (optional)</h3>
        <p className="text-muted-foreground">
          Give dynamic routes real names. Use <code className={CODE}>:name</code> for the dynamic part, so{" "}
          <code className={CODE}>/dashboard/:site_id/sites</code> turns{" "}
          <code className={CODE}>/dashboard/abc123/sites</code> into that pattern. Matched top to bottom; the
          first match wins, then auto-detection handles the rest.
        </p>
        {patterns.length > 0 && (
          <ol className="flex flex-col divide-y divide-line rounded-md border border-line">
            {patterns.map((p) => (
              <li key={p} className="flex items-center gap-2 py-1.5 pr-1.5 pl-3">
                <code className="min-w-0 flex-1 truncate font-mono">{p}</code>
                <button
                  type="button"
                  onClick={() => {
                    setPatterns(patterns.filter((x) => x !== p));
                    edited();
                  }}
                  aria-label={`Remove ${p}`}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <XIcon className="size-4" />
                </button>
              </li>
            ))}
          </ol>
        )}
        <form onSubmit={add} className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              edited();
            }}
            placeholder="/dashboard/:site_id/sites"
            aria-label="Named path pattern"
            autoComplete="off"
            spellCheck={false}
            disabled={full}
            className="min-w-0 flex-1 rounded-md border border-line bg-panel px-3 py-2 font-mono disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={full || !draft.trim()}
            className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-2 text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <PlusIcon className="size-4" />
            Add
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-1.5 text-sm">
        <label htmlFor="path-example" className="font-medium text-foreground">
          Preview
        </label>
        <input
          id="path-example"
          value={example}
          onChange={(e) => setExample(e.target.value)}
          placeholder="/orders/123456"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 rounded-md border border-line bg-panel px-3 py-2 font-mono"
        />
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-muted-foreground" aria-live="polite">
          <span>Stored as</span>
          <code className="min-w-0 font-mono break-all text-foreground">{grouped}</code>
          {!enabled && <span>(grouping is off)</span>}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={save}
          disabled={pending || !changed || placeholderError !== null}
          className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {status ? (
          <span className={status.ok ? "text-up" : "text-down"}>{status.text}</span>
        ) : (
          full && <span className="text-muted-foreground">At most {MAX_NAMED_PATTERNS} patterns</span>
        )}
      </div>
    </Section>
  );
}

const EXCLUDED_DESCRIPTION =
  "Drop hits whose path matches any of these patterns, such as /admin, internal previews or load-test pages. Pageviews, goals and outbound clicks on them are not counted.";

function ExcludedSection({ domain }: { domain: string }) {
  const saved = useQuery(api.sites.excludedPaths, { domain });
  if (saved === undefined) {
    return (
      <Section title="Excluded paths" description={EXCLUDED_DESCRIPTION}>
        <div className="h-10 animate-pulse rounded bg-line/50" />
      </Section>
    );
  }
  // Not keyed on `saved`: a save must not remount the form and lose its "Saved"
  return <ExcludedForm domain={domain} saved={saved} />;
}

function ExcludedForm({ domain, saved }: { domain: string; saved: string[] }) {
  const setExcludedPaths = useMutation(api.sites.setExcludedPaths);
  const [patterns, setPatterns] = useState(saved);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const changed = patterns.join("\n") !== saved.join("\n");
  const full = patterns.length >= MAX_EXCLUDED_PATHS;

  function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseExcludedPath(draft);
    if ("error" in parsed) {
      setStatus({ ok: false, text: parsed.error });
      return;
    }
    if (!patterns.includes(parsed.pattern)) setPatterns([...patterns, parsed.pattern]);
    setDraft("");
    setStatus(null);
  }

  async function save() {
    setPending(true);
    setStatus(null);
    try {
      await setExcludedPaths({ domain, patterns });
      setStatus({ ok: true, text: "Saved" });
    } catch (err) {
      setStatus({ ok: false, text: err instanceof ConvexError ? String(err.data) : "Could not save" });
    } finally {
      setPending(false);
    }
  }

  return (
    <Section title="Excluded paths" description={EXCLUDED_DESCRIPTION}>
      <p className="text-sm text-muted-foreground">
        Use <code className="rounded border border-line px-1 font-mono text-xs">*</code> as a wildcard:{" "}
        <code className="font-mono">/admin/*</code> covers /admin and every page under it, and a pattern
        without one matches that path only. Applies to new hits only; stats already counted stay.
      </p>
      {patterns.length === 0 ? (
        <p className="text-sm text-muted-foreground">No patterns yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {patterns.map((p) => (
            <li key={p} className="flex items-center gap-2 py-1.5 pr-1.5 pl-3 text-sm">
              <code className="min-w-0 flex-1 truncate font-mono">{p}</code>
              <button
                type="button"
                onClick={() => {
                  setPatterns(patterns.filter((x) => x !== p));
                  setStatus(null);
                }}
                aria-label={`Remove ${p}`}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <XIcon className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex gap-2 text-sm">
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setStatus(null);
          }}
          placeholder="e.g. /admin/* or /preview"
          aria-label="Path pattern"
          autoComplete="off"
          spellCheck={false}
          disabled={full}
          className="min-w-0 flex-1 rounded-md border border-line bg-panel px-3 py-2 font-mono disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={full || !draft.trim()}
          className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-2 text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <PlusIcon className="size-4" />
          Add
        </button>
      </form>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={save}
          disabled={pending || !changed}
          className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {status ? (
          <span className={status.ok ? "text-up" : "text-down"}>{status.text}</span>
        ) : (
          full && <span className="text-muted-foreground">At most {MAX_EXCLUDED_PATHS} patterns</span>
        )}
      </div>
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
          className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-40"
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
      title="Danger zone"
      description="Removes this site from your account. Think twice: what happens here can't be undone."
    >
      <div className="flex flex-col gap-1 text-sm">
        <h3 className="font-medium text-foreground">Delete this site</h3>
        <p className="text-muted-foreground">
          Deletes {domain} and all of its stats. This cannot be undone. Remove the snippet from the site as well, or
          its hits will simply be ignored.
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 text-sm sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-muted-foreground">
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
          className="rounded-md bg-down px-4 py-2 font-medium text-background disabled:opacity-40"
        >
          {pending ? "Deleting…" : "Delete website"}
        </button>
      </form>
      {error && <p className="text-sm text-down">{error}</p>}
    </Section>
  );
}
