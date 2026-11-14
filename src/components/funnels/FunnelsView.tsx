"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { ArrowDownIcon, ArrowUpIcon, CornerDownRightIcon, PlusIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { api } from "../../../convex/_generated/api";
import {
  DEFAULT_WINDOW_HOURS,
  funnelStats,
  MAX_FUNNEL_NAME,
  MAX_FUNNELS,
  MAX_STEPS,
  MAX_WINDOW_HOURS,
  MIN_STEPS,
  stepError,
  stepLabel,
  windowLabel,
  type FunnelStep,
} from "../../../convex/lib/funnels";
import { formatNumber, formatRate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SiteHeader from "@/components/dashboard/SiteHeader";
import SiteShell from "@/components/dashboard/SiteShell";
import { useSiteRange } from "@/components/dashboard/useSiteRange";
import { sitePath } from "@/components/TopBar";

type Funnel = FunctionReturnType<typeof api.funnels.list>[number];
type Results = FunctionReturnType<typeof api.funnels.results>;

export default function FunnelsView() {
  return (
    <SiteShell section="funnels">
      {(site) => (
        <Funnels
          domain={site.domain}
          timezone={site.timezone}
          tracking={site.trackingStartedAt !== null}
          cookieless={site.cookieless}
        />
      )}
    </SiteShell>
  );
}

function Funnels({
  domain,
  timezone,
  tracking,
  cookieless,
}: {
  domain: string;
  timezone: string;
  tracking: boolean;
  cookieless: boolean;
}) {
  // Funnels don't take filters yet; ?f= is kept in the URL for the other tabs
  const { today, range, preset, hourly, hourNow, setRange } = useSiteRange(timezone, tracking);
  const funnels = useQuery(api.funnels.list, { domain });
  const result = useQuery(api.funnels.results, {
    domain,
    range: hourly !== null ? { period: hourly, now: hourNow } : range,
  });
  // Keep the last numbers on screen while the next range loads
  const [last, setLast] = useState(result);
  if (result !== undefined && result !== last) setLast(result);
  const shown = result ?? last;
  const [creating, setCreating] = useState(false);

  const full = funnels !== undefined && funnels.length >= MAX_FUNNELS;
  const blocked = cookieless || shown?.status === "cookieless";
  return (
    <div className="flex flex-col gap-10">
      <SiteHeader
        title="Funnels"
        range={range}
        preset={preset}
        today={today}
        onRange={setRange}
        filters={[]}
        onFilters={() => {}}
        actions={
          !blocked && (
            <Button
              onClick={() => setCreating(true)}
              disabled={creating || full || funnels === undefined}
              title={full ? `A site can have at most ${MAX_FUNNELS} funnels` : undefined}
            >
              <PlusIcon />
              New funnel
            </Button>
          )
        }
      />
      {blocked ? (
        <CookielessNotice settings={`${sitePath(domain, "settings")}?section=identity`} />
      ) : (
        <>
          {creating && <FunnelForm domain={domain} onDone={() => setCreating(false)} />}
          {shown?.status === "tooMany" && (
            <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              There are too many visits in this range to work out funnels. Pick a shorter range.
            </p>
          )}
          {funnels === undefined ? (
            <div className="h-64 animate-pulse rounded-lg border border-border bg-muted/30" />
          ) : funnels.length === 0 ? (
            !creating && <EmptyState onCreate={() => setCreating(true)} />
          ) : (
            <div className="flex flex-col gap-6">
              {funnels.map((f) => (
                <FunnelCard key={f.id} funnel={f} result={shown} loading={result === undefined} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CookielessNotice({ settings }: { settings: string }) {
  return (
    <section className="flex flex-col items-start gap-2 rounded-lg border border-border px-5 py-8 sm:px-8">
      <h2 className="font-medium">Funnels need visitor ids</h2>
      <p className="max-w-2xl text-sm text-muted-foreground">
        A funnel follows each visitor from one step to the next, and that takes the visitor id cookie. This site is
        cookieless, so its pageviews and events can&apos;t be joined into journeys. Switch it to cookies in{" "}
        <Link href={settings} className="underline hover:text-foreground">
          Settings → Visitor identity
        </Link>{" "}
        and funnels count visits from then on.
      </p>
    </section>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="flex flex-col items-start gap-4 rounded-lg border border-border px-5 py-8 sm:px-8">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium">No funnels yet</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Line up {MIN_STEPS} to {MAX_STEPS} steps, pages or events, such as / → /pricing → /signup → signup, and see
          how many visitors reach each one within a time window, and where they leave.
        </p>
      </div>
      <Button variant="outline" onClick={onCreate}>
        <PlusIcon />
        New funnel
      </Button>
    </section>
  );
}

/**
 * One funnel: each step's visitors as a bar the length of its share of those who entered,
 * with the share, and between steps how many dropped off and the share that continued;
 * beside it the conversion, entered and completed.
 */
function FunnelCard({ funnel, result, loading }: { funnel: Funnel; result: Results | undefined; loading: boolean }) {
  const counts = result?.status === "ok" ? result.funnels.find((r) => r.id === funnel.id)?.counts : undefined;
  const stats = counts && counts.length === funnel.steps.length ? funnelStats(counts) : undefined;
  const value = (s: string | undefined) => s ?? "–";
  return (
    <section
      aria-label={funnel.name}
      className={cn("overflow-hidden rounded-lg border border-border", loading && stats && "opacity-60")}
    >
      <div className="flex flex-col gap-0.5 border-b border-border px-4 py-3.5 sm:px-5">
        <h2 className="text-sm font-medium">{funnel.name}</h2>
        <p className="text-xs text-muted-foreground">
          {funnel.steps.length} steps · completed within {windowLabel(funnel.windowHours)}
        </p>
      </div>
      <div className="flex flex-col sm:flex-row">
        <ol className="flex min-w-0 flex-1 flex-col px-4 py-4 sm:px-5">
          {funnel.steps.map((step, i) => {
            const s = stats?.steps[i];
            return (
              <li key={i} className="flex flex-col">
                {i > 0 && (
                  <span className="flex items-center gap-1.5 py-2 pl-1 text-xs text-muted-foreground tabular-nums">
                    <CornerDownRightIcon className="size-3.5" />
                    {s ? `${formatNumber(s.dropped)} dropped off · ${formatRate(s.ofPrevious)} continued` : "–"}
                  </span>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px] text-muted-foreground tabular-nums">
                    {i + 1}
                  </span>
                  <span className="min-w-0 truncate font-mono text-[13px]" title={stepLabel(step)}>
                    {stepLabel(step)}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {step.kind === "page" ? "Page" : "Event"}
                  </span>
                  <span className="ml-auto shrink-0 pl-2 font-medium tabular-nums">{value(s && formatNumber(s.count))}</span>
                  <span className="w-14 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                    {value(s && formatRate(s.ofEntered))}
                  </span>
                </div>
                <div className="mt-2 ml-7 h-2 overflow-hidden rounded-full bg-bar">
                  <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{
                      width: `${s && s.count > 0 ? Math.max(s.ofEntered * 100, 1) : 0}%`,
                      background: "var(--series-visitors)",
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
        <dl className="grid shrink-0 grid-cols-3 gap-4 border-t border-border px-4 py-4 sm:flex sm:w-36 sm:flex-col sm:border-t-0 sm:border-l">
          <Stat label="Conversion" value={value(stats && formatRate(stats.conversion))} big />
          <Stat label="Entered" value={value(stats && formatNumber(stats.entered))} />
          <Stat label="Completed" value={value(stats && formatNumber(stats.completed))} />
        </dl>
      </div>
    </section>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={
          big ? "text-[1.625rem] leading-8 font-semibold tracking-tight tabular-nums" : "text-sm font-medium tabular-nums"
        }
      >
        {value}
      </dd>
    </div>
  );
}

type DraftStep = { id: number; kind: FunnelStep["kind"]; value: string };
let nextStepId = 0;
const draftStep = (kind: FunnelStep["kind"], value = ""): DraftStep => ({ id: ++nextStepId, kind, value });
const toStep = (d: DraftStep): FunnelStep =>
  d.kind === "page" ? { kind: "page", pattern: d.value } : { kind: "event", name: d.value };

/**
 * The New funnel form: a name, 2 to 8 ordered steps (a page pattern or an event name,
 * with the site's goals and recorded events offered) and the completion window.
 */
function FunnelForm({ domain, onDone }: { domain: string; onDone: () => void }) {
  const create = useMutation(api.funnels.create);
  const eventNames = useQuery(api.sites.goalNames, { domain });
  const goals = useQuery(api.goals.list, { domain });
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<DraftStep[]>(() => [draftStep("page", "/"), draftStep("page")]);
  const [windowValue, setWindowValue] = useState(String(DEFAULT_WINDOW_HOURS));
  const [unit, setUnit] = useState<"hours" | "days">("hours");
  const [errors, setErrors] = useState<Map<number, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const pagePaths = goals?.filter((g) => g.kind === "page").map((g) => g.key) ?? [];
  const events = [...new Set([...(goals?.filter((g) => g.kind === "event").map((g) => g.key) ?? []), ...(eventNames ?? [])])];
  const windowHours = Number(windowValue) * (unit === "days" ? 24 : 1);

  function update(id: number, patch: Partial<DraftStep>) {
    setSteps((all) => all.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setErrors((all) => {
      const next = new Map(all);
      next.delete(id);
      return next;
    });
    setError(null);
  }
  function move(index: number, by: -1 | 1) {
    setSteps((all) => {
      const next = [...all];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = new Map<number, string>();
    for (const s of steps) {
      const message = stepError(toStep(s));
      if (message !== null) found.set(s.id, message);
    }
    setErrors(found);
    if (!name.trim()) return setError("Give the funnel a name");
    if (!Number.isInteger(windowHours) || windowHours < 1 || windowHours > MAX_WINDOW_HOURS) {
      return setError(`The window is 1 hour to ${MAX_WINDOW_HOURS / 24} days, in whole hours`);
    }
    if (found.size > 0) return;
    setPending(true);
    setError(null);
    try {
      await create({ domain, name, steps: steps.map(toStep), windowHours });
      onDone();
    } catch (err) {
      setError(err instanceof ConvexError ? String(err.data) : "Could not create the funnel");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} aria-label="New funnel" className="flex flex-col gap-5 rounded-lg border border-border px-4 py-5 sm:px-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-medium">New funnel</h2>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onDone} aria-label="Close">
          <XIcon />
        </Button>
      </div>
      <label className="flex max-w-md flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Name</span>
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          placeholder="Signup"
          maxLength={MAX_FUNNEL_NAME}
          autoComplete="off"
          autoFocus
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-xs text-muted-foreground">
          Steps, in order. Pages take * wildcards: /blog/* is every page under /blog.
        </legend>
        <ol className="flex flex-col gap-2">
          {steps.map((s, i) => (
            <li key={s.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px] text-muted-foreground tabular-nums">
                  {i + 1}
                </span>
                <select
                  value={s.kind}
                  onChange={(e) => update(s.id, { kind: e.target.value as FunnelStep["kind"] })}
                  aria-label={`Step ${i + 1} type`}
                  className="h-8 shrink-0 rounded-lg border border-input bg-background px-2 text-sm dark:bg-input/30"
                >
                  <option value="page">Page</option>
                  <option value="event">Event</option>
                </select>
                <Input
                  value={s.value}
                  onChange={(e) => update(s.id, { value: e.target.value })}
                  aria-label={`Step ${i + 1} ${s.kind === "page" ? "path" : "event name"}`}
                  aria-invalid={errors.has(s.id) || undefined}
                  list={s.kind === "page" ? "funnel-pages" : "funnel-events"}
                  placeholder={s.kind === "page" ? "/pricing" : "signup"}
                  autoComplete="off"
                  spellCheck={false}
                  className="min-w-0 flex-1 font-mono"
                />
                <div className="flex shrink-0 items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move step ${i + 1} up`}
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => move(i, 1)}
                    disabled={i === steps.length - 1}
                    aria-label={`Move step ${i + 1} down`}
                  >
                    <ArrowDownIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setSteps((all) => all.filter((x) => x.id !== s.id))}
                    disabled={steps.length <= MIN_STEPS}
                    aria-label={`Remove step ${i + 1}`}
                  >
                    <XIcon />
                  </Button>
                </div>
              </div>
              {errors.has(s.id) && <p className="pl-7 text-xs text-down">{errors.get(s.id)}</p>}
            </li>
          ))}
        </ol>
        <datalist id="funnel-pages">
          {pagePaths.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <datalist id="funnel-events">
          {events.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        {steps.length < MAX_STEPS && (
          <div className="pl-7">
            <Button type="button" variant="outline" size="sm" onClick={() => setSteps((all) => [...all, draftStep("page")])}>
              <PlusIcon />
              Add step
            </Button>
          </div>
        )}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <span id="funnel-window" className="text-xs text-muted-foreground">
          Completed within, from the first step
        </span>
        <div className="flex items-center gap-2" role="group" aria-labelledby="funnel-window">
          <Input
            type="number"
            min={1}
            step={1}
            value={windowValue}
            onChange={(e) => {
              setWindowValue(e.target.value);
              setError(null);
            }}
            aria-label="Window length"
            className="w-24 tabular-nums"
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as "hours" | "days")}
            aria-label="Window unit"
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm dark:bg-input/30"
          >
            <option value="hours">hours</option>
            <option value="days">days</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create funnel"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        {error && <p className="text-sm text-down">{error}</p>}
      </div>
    </form>
  );
}
