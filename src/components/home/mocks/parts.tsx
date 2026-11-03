import type { ComponentType } from "react";
import { ChevronDownIcon, ChevronsUpDownIcon, CircleSlashIcon, GlobeIcon, MoonIcon, SunIcon } from "lucide-react";
import { SiClaude, SiGithub, SiGoogle, SiX, SiYcombinator } from "react-icons/si";
import { cn } from "cn";
import LogoMark from "@/components/LogoMark";
import { ChartLineIcon, GearIcon, PageIcon, RadioIcon, UsersIcon } from "@/components/NavIcons";
import { formatChange } from "@/lib/format";
import { sparkline } from "@/lib/mockCharts";
import type { MockChart, MockColor, MockHeader as MockHeaderData, MockPageTile, MockTile } from "./fixtures";

// Static copies of the dashboard's pieces for the homepage mockups: same tokens, sizes and
// spacing as the real components, with no state, links or hover. Drawn at desktop size
// inside a MockViewport, which scales them to fit.

/** The series tokens, as the dashboard's SERIES_COLOR maps them. */
export const MOCK_COLOR: Record<MockColor, string> = {
  visitors: "var(--series-visitors)",
  pageviews: "var(--series-pageviews)",
  revenue: "var(--series-revenue)",
  goal: "var(--series-goal)",
  muted: "var(--muted-foreground)",
};

/** The dashboard's column inside a mockup (TopBar's and SiteShell's max-w-[1200px] with lg padding). */
export const MOCK_COLUMN = "mx-auto w-full max-w-[1200px] px-8";

type Tab = "Analytics" | "Pages" | "Users" | "Live" | "Settings";

const TABS: { label: Tab; icon: ComponentType<{ className?: string }> }[] = [
  { label: "Analytics", icon: ChartLineIcon },
  { label: "Pages", icon: PageIcon },
  { label: "Users", icon: UsersIcon },
  { label: "Live", icon: RadioIcon },
  { label: "Settings", icon: GearIcon },
];

/** TopBar in site mode: logo, site switcher, "N online", theme icon, initials, then the tabs. */
export function MockTopBar({
  site,
  online,
  initials,
  active,
}: {
  site: string;
  online: number;
  initials: string;
  active: Tab;
}) {
  return (
    <div className="border-b border-border">
      <div className={MOCK_COLUMN}>
        <div className="flex h-14 items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <LogoMark />
            <span className="px-1 text-muted-foreground/50">/</span>
            <span className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium">
              <span className="flex size-5 items-center justify-center rounded bg-white text-[11px] font-medium text-zinc-700 ring-1 ring-line">
                {site[0]}
              </span>
              {site}
              <ChevronsUpDownIcon className="size-3.5 text-muted-foreground" />
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="flex items-center gap-1.5 px-2 py-1.5 text-sm">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span className="font-medium tabular-nums">{online}</span>
              <span className="text-muted-foreground">online</span>
            </span>
            <span className="flex size-8 items-center justify-center text-muted-foreground">
              <SunIcon className="hidden size-4 dark:block" />
              <MoonIcon className="size-4 dark:hidden" />
            </span>
            <span className="m-0.5 flex size-8 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
              {initials}
            </span>
          </div>
        </div>
        <div className="-mb-px flex gap-6 text-sm">
          {TABS.map((t) => (
            <span
              key={t.label}
              className={cn(
                "flex items-center gap-1.5 border-b-2 pt-1 pb-3",
                t.label === active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground",
              )}
            >
              <t.icon className="size-4" />
              {t.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const SEGMENTS = ["Today", "24h", "7d", "30d"];

/**
 * SiteHeader: the title and the range in words, then Today | 24h | 7d | 30d and the range
 * menu. A header with a `note` shows it under the title instead, and `segments` replace
 * the range ones (Search's Performance | Indexing).
 */
export function MockHeader({ header }: { header: MockHeaderData }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex flex-col gap-1">
        <span className="text-3xl font-semibold tracking-tight">{header.title}</span>
        <span className="text-sm text-muted-foreground">{header.note ?? header.rangeLabel}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="flex rounded-lg border border-border p-0.5">
          {(header.segments ?? SEGMENTS).map((s) => (
            <span
              key={s}
              className={cn(
                "flex h-7 items-center rounded-md px-3 text-sm font-medium",
                s === header.segment ? "bg-muted text-foreground" : "text-muted-foreground",
              )}
            >
              {s}
            </span>
          ))}
        </span>
        <span className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-[0.8rem] font-medium dark:bg-input/30">
          {header.rangeLabel}
          <ChevronDownIcon className="size-3.5 text-muted-foreground" />
        </span>
      </div>
    </div>
  );
}

/** StatRow: tiles joined by 1px rules, each a dot and label over the number and its change. */
export function MockTiles({ tiles }: { tiles: MockTile[] }) {
  const dense = tiles.length >= 6;
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-px bg-border">
      {tiles.map((t) => (
        <div key={t.label} className={cn("flex min-w-0 flex-col gap-2 bg-background py-6", dense ? "px-4" : "px-6")}>
          <span className={cn("flex items-center gap-2 text-sm", t.on ? "text-foreground" : "text-muted-foreground")}>
            <span
              className={cn("size-1.5 shrink-0 rounded-full", !t.on && "bg-muted-foreground/40")}
              style={t.on && t.color ? { background: MOCK_COLOR[t.color] } : undefined}
            />
            <span className="truncate">{t.label}</span>
          </span>
          <span className="truncate text-[1.625rem] leading-8 font-semibold tracking-tight tabular-nums">{t.value}</span>
          <MockChange change={t.change} lowerIsBetter={t.lowerIsBetter} />
        </div>
      ))}
    </div>
  );
}

/** StatTile's Change: green when good, red when bad, "–" with nothing to compare. */
export function MockChange({ change, lowerIsBetter }: { change: number | null; lowerIsBetter?: boolean }) {
  if (change === null) return <span className="text-xs leading-4 font-medium text-muted-foreground">–</span>;
  const good = (lowerIsBetter ? -1 : 1) * Math.round(change * 1000);
  return (
    <span
      className={cn(
        "text-xs leading-4 font-medium tabular-nums",
        good > 0 ? "text-up" : good < 0 ? "text-down" : "text-muted-foreground",
      )}
    >
      {formatChange(change)}
    </span>
  );
}

/** The chart's key: a short stroke for each line (dashed if the line is), a square for each bar series. */
export function MockLegend({ chart }: { chart: MockChart }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {chart.lines.map((s) => (
        <span key={s.label} className="flex items-center gap-1.5">
          {s.dash ? (
            <span className="w-3 border-t-[1.5px] border-dashed" style={{ borderColor: MOCK_COLOR[s.color] }} />
          ) : (
            <span className="h-0.5 w-3 rounded-full" style={{ background: MOCK_COLOR[s.color] }} />
          )}
          {s.label}
        </span>
      ))}
      {chart.bars.map((s) => (
        <span key={s.label} className="flex items-center gap-1.5">
          <span className="size-2 rounded-[2px]" style={{ background: MOCK_COLOR[s.color] }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

/** PageTiles: joined tiles, each a muted label over the number and a note line. */
export function MockPageTiles({ tiles, bare }: { tiles: MockPageTile[]; bare?: boolean }) {
  return (
    <div
      className={cn(
        "grid auto-cols-fr grid-flow-col gap-px bg-border",
        // Bare tiles sit in a block that draws the outer border (with the chart under them)
        !bare && "overflow-hidden rounded-lg border border-border",
      )}
    >
      {tiles.map((t) => (
        <div key={t.label} className="flex min-w-0 flex-col gap-2 bg-background px-6 py-6">
          <span className="truncate text-sm text-muted-foreground">{t.label}</span>
          <span className="truncate text-[1.625rem] leading-8 font-semibold tracking-tight tabular-nums">{t.value}</span>
          <span className="min-h-4 truncate text-xs leading-4 text-muted-foreground tabular-nums">
            {t.change !== undefined && (
              <>
                <MockChange change={t.change} lowerIsBetter={t.lowerIsBetter} />{" "}
              </>
            )}
            {t.note}
          </span>
        </div>
      ))}
    </div>
  );
}

const SPARK_W = 96;
const SPARK_H = 24;

/** The Pages table's trend: a small muted line with a dot on the last point. */
export function MockSparkline({ values }: { values: number[] }) {
  const { path, end } = sparkline(values, { width: SPARK_W, height: SPARK_H });
  if (end === null) return <span className="text-muted-foreground">–</span>;
  return (
    <svg width={SPARK_W} height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} className="block">
      <path
        d={path}
        fill="none"
        strokeWidth={1.25}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="stroke-muted-foreground"
      />
      <circle cx={end[0]} cy={end[1]} r={2} className="fill-foreground" />
    </svg>
  );
}

/**
 * A compact view header for the half-width figures, where the range segments don't fit:
 * the title over a muted note, then the range menu and a primary button.
 */
export function MockPanelHeader({
  title,
  note,
  range,
  action,
}: {
  title: string;
  note: string;
  range: string;
  action: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-2xl font-semibold tracking-tight">{title}</span>
        <span className="truncate text-sm text-muted-foreground">{note}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-[0.8rem] font-medium dark:bg-input/30">
          {range}
          <ChevronDownIcon className="size-3.5 text-muted-foreground" />
        </span>
        <span className="flex h-8 items-center rounded-lg bg-primary px-3 text-[0.8rem] font-medium text-primary-foreground">
          {action}
        </span>
      </div>
    </div>
  );
}

// Source "favicons" drawn from brand marks, so a figure loads no images (the dashboard
// fetches each source's own favicon.ico)
const SOURCE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  Direct: CircleSlashIcon,
  Google: SiGoogle,
  "Hacker News": SiYcombinator,
  Claude: SiClaude,
  X: SiX,
  GitHub: SiGithub,
};

/** A source's mark by its dashboard name, a globe for any other. */
export function MockSourceIcon({ source, className }: { source: string; className?: string }) {
  const Icon = SOURCE_ICONS[source] ?? GlobeIcon;
  return <Icon className={className} />;
}
