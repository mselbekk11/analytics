"use client";

import { useRef, useState } from "react";
import { useQuery } from "convex/react";
import { ArrowUpRight } from "lucide-react";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { api } from "../../../convex/_generated/api";
import { rankEntries, type Dim } from "../../../convex/lib/dims";
import { MAX_FILTER_DAYS, type Filter } from "../../../convex/lib/filters";
import type { DateRange } from "../../../convex/lib/ranges";
import type { BreakdownResult } from "../../../convex/lib/statsShapes";
import { formatDuration, formatNumber, formatPoint, formatShare } from "@/lib/format";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label, rowHref, rowIcon } from "@/components/dashboard/Breakdowns";
import StatsCard, { type StatsRow } from "@/components/dashboard/StatsCard";
import type { HourPeriod } from "@/components/dashboard/useSiteRange";

type Props = {
  domain: string;
  /** The open page (`?page=`); null when the drawer is closed */
  path: string | null;
  range: DateRange;
  hourly: HourPeriod | null;
  hourNow: number;
  filters: Filter[];
  /** Cookieless sites have no sources, so their first list is Referrers */
  tracking: boolean;
  onClose: () => void;
};

const chartConfig = {
  pageviews: { label: "Pageviews", color: "var(--series-pageviews)" },
} satisfies ChartConfig;

/**
 * The page drawer (design v4): one page of the Pages table over the same range and
 * filters, from the right (full width on phones). Its title and live URL, Visitors,
 * Pageviews, Bounce and Avg. time, a daily (hourly) pageviews chart, and the Sources,
 * Countries, Devices and Browsers of the sessions that viewed it (pages.detail). Escape,
 * the close button or a click outside close it, and focus goes back to the page's row.
 */
export default function PageDrawer({ domain, path, range, hourly, hourNow, filters, tracking, onClose }: Props) {
  // The last page stays in the drawer while it slides out
  const [shownPath, setShownPath] = useState(path);
  if (path !== null && path !== shownPath) setShownPath(path);
  const open = path !== null;
  // Focus starts on the drawer's body rather than ringing the URL link
  const body = useRef<HTMLDivElement>(null);

  const result = useQuery(
    api.pages.detail,
    path === null
      ? "skip"
      : { domain, range: hourly !== null ? { period: hourly, now: hourNow } : range, filters, path },
  );
  const page = result?.status === "ok" ? result : undefined;
  const url = shownPath === null ? "" : `${domain === "localhost" ? "http" : "https"}://${domain}${shownPath}`;

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="right"
        className="gap-0 overflow-y-auto bg-background data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
        initialFocus={body}
        // Back to the row the drawer is for, when it is on screen (not after a reload)
        finalFocus={() =>
          (shownPath !== null &&
            document.querySelector<HTMLElement>(`[data-page-row="${CSS.escape(shownPath)}"]`)) ||
          true
        }
      >
        <SheetHeader className="gap-1 px-5 pt-6 pr-12 sm:px-6">
          <SheetTitle className="truncate text-xl font-semibold tracking-tight">
            {page?.title ?? shownPath}
          </SheetTitle>
          <SheetDescription
            render={
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
              />
            }
          >
            <span className="truncate">
              {domain}
              {shownPath}
            </span>
            <ArrowUpRight aria-hidden className="size-3.5 shrink-0" />
            <span className="sr-only">(opens in a new tab)</span>
          </SheetDescription>
        </SheetHeader>
        <div ref={body} tabIndex={-1} className="flex flex-col gap-8 px-5 pt-4 pb-8 outline-none sm:px-6">
          {result !== undefined && result.status !== "ok" ? (
            <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              {result.status === "range"
                ? `Page details work on ranges of up to ${MAX_FILTER_DAYS} days. Pick a shorter range.`
                : "There are too many visits in this range to count for one page. Pick a shorter range."}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
                <Tile label="Visitors" value={page && formatNumber(page.visitors)} />
                <Tile label="Pageviews" value={page && formatNumber(page.pageviews)} />
                <Tile label="Bounce" value={page && (page.bounceRate === null ? "–" : formatShare(page.bounceRate))} />
                <Tile label="Avg. time" value={page && (page.durationMs === null ? "–" : formatDuration(page.durationMs))} />
              </div>
              <section aria-labelledby="page-drawer-chart" className="flex flex-col gap-3">
                <h3 id="page-drawer-chart" className="text-sm text-muted-foreground">
                  Pageviews
                </h3>
                {page === undefined ? (
                  <div className="h-44 animate-pulse rounded-md bg-muted/50" />
                ) : (
                  <PageviewsChart data={page.chart} />
                )}
              </section>
              <section aria-labelledby="page-drawer-lists" className="flex flex-col gap-3">
                {/* The card's tabs fill a phone's width, so what it counts goes above it */}
                <h3 id="page-drawer-lists" className="text-sm text-muted-foreground">
                  Visitors
                </h3>
                <div className="overflow-hidden rounded-lg border border-border">
                  <Lists breakdowns={page?.breakdowns} tracking={tracking} />
                </div>
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Tile({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 bg-background px-4 py-4">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      {value === undefined ? (
        <span className="h-7 w-14 animate-pulse rounded bg-muted" />
      ) : (
        <span className="truncate text-xl leading-7 font-semibold tracking-tight tabular-nums">{value}</span>
      )}
    </div>
  );
}

function PageviewsChart({ data }: { data: { date: string; pageviews: number }[] }) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-44 w-full">
      <BarChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: -8 }} barCategoryGap="20%">
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => formatPoint(d)}
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          minTickGap={32}
        />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tickMargin={8} width={40} />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          content={
            <ChartTooltipContent
              className="min-w-36 rounded-md border-border bg-popover px-3 py-2"
              labelClassName="font-normal text-muted-foreground"
              labelFormatter={(value) => formatPoint(String(value), true)}
              formatter={(value) => (
                <div className="flex w-full items-center gap-2">
                  <span className="size-2 shrink-0 rounded-[2px] bg-(--color-pageviews)" />
                  <span className="text-muted-foreground">Pageviews</span>
                  <span className="ml-auto pl-4 font-medium text-foreground tabular-nums">
                    {formatNumber(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar
          dataKey="pageviews"
          fill="var(--color-pageviews)"
          radius={[2, 2, 0, 0]}
          maxBarSize={12}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartContainer>
  );
}

/** Who read the page, by visitors: one card with Sources, Countries, Devices and Browsers tabs. */
function Lists({
  breakdowns,
  tracking,
}: {
  breakdowns: Record<string, BreakdownResult> | undefined;
  tracking: boolean;
}) {
  const tabs: { id: string; label: string; dim: Dim }[] = [
    tracking ? { id: "source", label: "Sources", dim: "source" } : { id: "referrer", label: "Referrers", dim: "referrer" },
    { id: "country", label: "Countries", dim: "country" },
    { id: "device", label: "Devices", dim: "device" },
    { id: "browser", label: "Browsers", dim: "browser" },
  ];
  const [tabId, setTabId] = useState(tabs[0].id);
  const { dim } = tabs.find((t) => t.id === tabId) ?? tabs[0];
  const data = breakdowns?.[dim];
  const ranked = data && rankEntries(dim, data.rows, "visitors");
  const top = ranked?.[0]?.visitors ?? 0;
  const rows: StatsRow[] | undefined = ranked?.map((r) => ({
    key: r.key,
    label: <Label dim={dim} value={r.key} />,
    href: rowHref(dim, r.key),
    icon: rowIcon(dim, r.key),
    value: formatNumber(r.visitors),
    share: top <= 0 ? 0 : r.visitors / top,
  }));
  return (
    <StatsCard
      title="Who read this page"
      tabs={tabs}
      tab={tabId}
      onTab={setTabId}
      rows={rows}
      empty="No visitors in this range"
    />
  );
}
