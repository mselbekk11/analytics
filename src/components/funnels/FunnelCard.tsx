"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { CornerDownRightIcon } from "lucide-react";
import { cn } from "cn";
import { api } from "../../../convex/_generated/api";
import { funnelStats, stepLabel, stepTarget, windowLabel } from "../../../convex/lib/funnels";
import { formatElapsed, formatNumber, formatRate } from "@/lib/format";
import { sitePath } from "@/components/TopBar";

// The funnel card's parts, shared by the Funnels tab and the Analytics tab's Funnels card.

export type Funnel = FunctionReturnType<typeof api.funnels.list>[number];
export type FunnelResults = FunctionReturnType<typeof api.funnels.results>;
export type FunnelRange = FunctionArgs<typeof api.funnels.results>["range"];

const dash = (s: string | undefined) => s ?? "—";

/** One funnel's numbers from the results, or undefined while loading or out of date. */
export function funnelNumbers(funnel: Funnel, result: FunnelResults | undefined) {
  const r = result?.status === "ok" ? result.funnels.find((f) => f.id === funnel.id) : undefined;
  if (r === undefined || r.counts.length !== funnel.steps.length) return undefined;
  return { ...funnelStats(r.counts), medianMs: r.medianMs };
}
export type FunnelNumbers = NonNullable<ReturnType<typeof funnelNumbers>>;

/**
 * One funnel on the Funnels tab: the name and window (and Edit / Delete) over the steps,
 * with Conversion, Entered, Completed and Median time beside them.
 */
export function FunnelCard({
  funnel,
  numbers,
  loading,
  actions,
}: {
  funnel: Funnel;
  numbers: FunnelNumbers | undefined;
  loading: boolean;
  actions?: ReactNode;
}) {
  return (
    <section
      aria-label={funnel.name}
      className={cn("overflow-hidden rounded-lg border border-border", loading && numbers && "opacity-60")}
    >
      <div className="flex items-center gap-4 border-b border-border px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="truncate text-sm font-medium">{funnel.name}</h2>
          <p className="text-xs text-muted-foreground">
            {funnel.steps.length} steps · completed within {windowLabel(funnel.windowHours)}
          </p>
        </div>
        {actions}
      </div>
      <div className="flex flex-col sm:flex-row">
        <FunnelSteps funnel={funnel} numbers={numbers} className="px-4 py-4 sm:px-5" />
        <dl className="grid shrink-0 grid-cols-2 gap-4 border-t border-border px-4 py-4 min-[420px]:grid-cols-4 sm:flex sm:w-36 sm:flex-col sm:border-t-0 sm:border-l">
          <FunnelStatList numbers={numbers} />
        </dl>
      </div>
    </section>
  );
}

/** Conversion (big), Entered, Completed and Median time, as <dt>/<dd> pairs. */
export function FunnelStatList({ numbers }: { numbers: FunnelNumbers | undefined }) {
  return (
    <>
      <Stat label="Conversion" value={dash(numbers && formatRate(numbers.conversion))} big />
      <Stat label="Entered" value={dash(numbers && formatNumber(numbers.entered))} />
      <Stat label="Completed" value={dash(numbers && formatNumber(numbers.completed))} />
      <Stat
        label="Median time"
        value={dash(numbers?.medianMs != null ? formatElapsed(numbers.medianMs) : undefined)}
        title="From the first step to the last, for visitors who completed"
      />
    </>
  );
}

function Stat({ label, value, big, title }: { label: string; value: string; big?: boolean; title?: string }) {
  return (
    <div className="flex flex-col gap-1" title={title}>
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

/**
 * The steps: each one's name (or its pattern or event when it has none), visitors and
 * share of those who entered, a bar that long, the pattern or event under a named step,
 * and between steps how many dropped off and the share that continued.
 */
export function FunnelSteps({
  funnel,
  numbers,
  className,
}: {
  funnel: Funnel;
  numbers: FunnelNumbers | undefined;
  className?: string;
}) {
  return (
    <ol className={cn("flex min-w-0 flex-1 flex-col", className)}>
      {funnel.steps.map((step, i) => {
        const s = numbers?.steps[i];
        const kind = step.kind === "page" ? "Page" : "Event";
        const named = step.label !== undefined;
        return (
          <li key={i} className="flex flex-col">
            {i > 0 && (
              <span className="flex items-center gap-1.5 py-2 pl-1 text-xs text-muted-foreground tabular-nums">
                <CornerDownRightIcon className="size-3.5" />
                {s ? `${formatNumber(s.dropped)} dropped off · ${formatRate(s.ofPrevious)} continued` : "—"}
              </span>
            )}
            <div className="flex items-center gap-2 text-sm">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px] text-muted-foreground tabular-nums">
                {i + 1}
              </span>
              <span
                className={cn("min-w-0 truncate", named ? "font-medium" : "font-mono text-[13px]")}
                title={stepLabel(step)}
              >
                {stepLabel(step)}
              </span>
              {!named && <span className="shrink-0 text-xs text-muted-foreground">{kind}</span>}
              <span className="ml-auto shrink-0 pl-2 font-medium tabular-nums">{dash(s && formatNumber(s.count))}</span>
              <span className="w-14 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                {dash(s && formatRate(s.ofEntered))}
              </span>
            </div>
            {named && (
              <p className="ml-7 truncate text-xs text-muted-foreground" title={stepTarget(step)}>
                {kind} · <span className="font-mono">{stepTarget(step)}</span>
              </p>
            )}
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
  );
}

/** Why a cookieless site has no funnels, and where to switch it to cookies. */
export function CookielessExplanation({ domain }: { domain: string }) {
  return (
    <>
      A funnel follows each visitor from one step to the next, and that takes the visitor id cookie. This site is
      cookieless, so its pageviews and events can&apos;t be joined into journeys. Switch it to cookies in{" "}
      <Link href={`${sitePath(domain, "settings")}?section=identity`} className="underline hover:text-foreground">
        Settings → Visitor identity
      </Link>{" "}
      and funnels count visits from then on.
    </>
  );
}
