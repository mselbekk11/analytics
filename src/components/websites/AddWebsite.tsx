"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Authenticated, AuthLoading, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { ArrowRight, Check, Globe, Loader2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { normalizeDomain } from "../../../convex/lib/domain";
import SiteFavicon from "@/components/SiteFavicon";
import Snippet from "@/components/Snippet";
import TopBar, { sitePath } from "@/components/TopBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import HowItWorks from "./HowItWorks";

// The favicon is fetched from the typed domain, so wait for a pause in typing
const FAVICON_DELAY_MS = 400;

/**
 * The add-website flow at /websites/new. The step comes from the URL: no ?site= is step 1
 * (site details); ?site=<domain> is step 2 (install) for a site the user owns, and falls
 * back to step 1 for one that is missing or someone else's.
 */
export default function AddWebsite() {
  return (
    <div className="flex flex-1 flex-col">
      <TopBar account="websites" />
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 pt-10 pb-20 sm:px-6 lg:px-8">
        <AuthLoading>
          <p className="text-sm text-muted-foreground">Connecting…</p>
        </AuthLoading>
        <Authenticated>
          <AddFlow />
        </Authenticated>
      </main>
    </div>
  );
}

function AddFlow() {
  const param = useSearchParams().get("site");
  const site = useQuery(api.sites.get, param ? { domain: param } : "skip");
  const checking = param !== null && site === undefined;
  const created = param !== null && site != null ? site.domain : null;
  // Reactive: flips to true as soon as the first hit is stored, with no polling
  const received = useQuery(api.sites.hasPageview, created ? { domain: created } : "skip") === true;

  return (
    <div className="flex flex-col gap-6">
      <Stepper step={created ? (received ? 3 : 2) : 1} />
      <div className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
        {checking ? (
          <div className="h-72 animate-pulse rounded-xl bg-muted/40 ring-1 ring-foreground/10" />
        ) : created ? (
          <InstallTracker domain={created} received={received} />
        ) : (
          <SiteDetails />
        )}
        <HowItWorks stage={created ? "install" : "domain"} received={received} />
      </div>
    </div>
  );
}

/** "1 Site details · 2 Install tracker"; finished steps get a green tick (step 3: all done). */
function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const steps = ["Site details", "Install tracker"];
  return (
    <ol aria-label="Steps" className="flex w-fit items-center gap-1 rounded-lg bg-muted/60 p-1 text-sm">
      {steps.map((label, i) => {
        const n = i + 1;
        const current = n === step;
        const done = n < step;
        return (
          <li
            key={label}
            aria-current={current ? "step" : undefined}
            className={
              current
                ? "flex items-center gap-2 rounded-md bg-background px-2.5 py-1.5 font-medium text-foreground shadow-xs"
                : "flex items-center gap-2 px-2.5 py-1.5 text-muted-foreground"
            }
          >
            {done ? (
              <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check aria-label="Done" className="size-3" />
              </span>
            ) : (
              <span
                className={
                  current
                    ? "flex size-5 items-center justify-center rounded-md bg-foreground text-xs text-background"
                    : "flex size-5 items-center justify-center text-xs"
                }
              >
                {n}
              </span>
            )}
            {label}
          </li>
        );
      })}
    </ol>
  );
}

// Rendered only inside <Authenticated>, i.e. on the client, so Intl reflects the browser.
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Step 1: one Domain field, a preview of how it will be stored, and Create site. */
function SiteDetails() {
  const create = useMutation(api.sites.create);
  const router = useRouter();
  // With no sites this page is onboarding, so there is nothing to cancel back to
  const sites = useQuery(api.sites.list);
  const canCancel = sites !== undefined && sites.length > 0;
  const [input, setInput] = useState("");
  const [timezone] = useState(browserTimeZone);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // The same normaliser the server uses, so the preview matches what is stored
  const domain = input.trim() ? normalizeDomain(input) : null;
  const [faviconDomain, setFaviconDomain] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setFaviconDomain(domain), FAVICON_DELAY_MS);
    return () => clearTimeout(timer);
  }, [domain]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (domain === null || pending) return;
    setError(null);
    setPending(true);
    try {
      const result = await create({ domain: input, timezone });
      router.replace(`/websites/new?site=${encodeURIComponent(result.domain)}`);
    } catch (err) {
      setError(err instanceof ConvexError ? String(err.data) : "Could not add the website");
      setPending(false);
    }
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="contents">
        <CardHeader className="border-b">
          <CardTitle>Add your website</CardTitle>
          <CardDescription>Enter the domain you want to track.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <label htmlFor="domain" className="text-sm font-medium">
            Domain
          </label>
          <InputGroup className="h-10">
            <InputGroupAddon>
              {domain !== null && faviconDomain === domain ? (
                <SiteFavicon key={domain} domain={domain} />
              ) : (
                <Globe aria-hidden />
              )}
            </InputGroupAddon>
            <InputGroupInput
              id="domain"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError(null);
              }}
              placeholder="example.com"
              autoFocus
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="url"
              aria-invalid={error !== null || undefined}
              aria-describedby="domain-hint"
            />
            <InputGroupAddon align="inline-end">
              <Kbd aria-hidden>↵</Kbd>
            </InputGroupAddon>
          </InputGroup>
          <p id="domain-hint" className="text-xs text-muted-foreground">
            No https:// or paths, subdomains work too.
          </p>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : (
            domain !== null && (
              <p className="text-sm text-muted-foreground">
                We&apos;ll track <span className="font-medium text-foreground">{domain}</span>
              </p>
            )
          )}
          <p className="text-xs text-muted-foreground">
            Timezone: {timezone} · change it in the site&apos;s settings
          </p>
        </CardContent>
        <CardFooter className="justify-end gap-3">
          {canCancel && (
            <Button variant="ghost" render={<Link href="/websites" />} nativeButton={false} className="mr-auto">
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={domain === null || pending} className="gap-1.5 px-3">
            {pending ? (
              <>
                <Loader2 aria-hidden className="animate-spin" />
                Creating…
              </>
            ) : (
              <>
                Create site
                <ArrowRight aria-hidden />
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

/** Step 2: the snippet, and a live status that flips when the site's first pageview arrives. */
function InstallTracker({ domain, received }: { domain: string; received: boolean }) {
  const dashboard = sitePath(domain, "analytics");
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Install the tracker</CardTitle>
        <CardDescription>
          Add this line inside the <code className="font-mono">&lt;head&gt;</code> of your site.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <SiteFavicon domain={domain} />
          <span className="truncate font-medium">{domain}</span>
          <Badge variant="secondary" className="text-emerald-600 dark:text-emerald-400">
            <Check aria-hidden />
            Created
          </Badge>
        </div>
        <Snippet domain={domain} />
        <div role="status" className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm">
          {received ? (
            <>
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check aria-hidden className="size-3" />
              </span>
              <span className="font-medium">First pageview received</span>
            </>
          ) : (
            <>
              <span aria-hidden className="relative flex size-5 shrink-0 items-center justify-center">
                <span className="absolute size-2.5 animate-ping rounded-full bg-emerald-500/60" />
                <span className="relative size-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-muted-foreground">Waiting for your first event…</span>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">You can find the snippet later in the site&apos;s Settings.</p>
      </CardContent>
      <CardFooter className="justify-end">
        {received ? (
          <Button render={<Link href={dashboard} />} nativeButton={false} className="gap-1.5 px-3">
            Go to dashboard
            <ArrowRight aria-hidden />
          </Button>
        ) : (
          <Button variant="ghost" render={<Link href={dashboard} />} nativeButton={false}>
            Skip to dashboard
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
