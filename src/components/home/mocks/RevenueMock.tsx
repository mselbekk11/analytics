import type { ComponentType, ReactNode } from "react";
import { ArrowUpDownIcon, ChevronDownIcon, CircleSlashIcon, GlobeIcon } from "lucide-react";
import { SiClaude, SiGithub, SiGoogle, SiX, SiYcombinator } from "react-icons/si";
import { cn } from "cn";
import { countryFlag, countryName, formatMoney } from "@/lib/format";
import { moneyTick } from "@/lib/mockCharts";
import BarLineChart from "./BarLineChart";
import { revenueMock as data, type MockRevenueRow } from "./fixtures";
import MockViewport from "./MockViewport";
import { MockHeader, MockPageTiles } from "./parts";

// Drawn at the same width as Fig. 2; the frame cuts the cards off partway down their
// fifth row, as if the lists go on.
const WIDTH = 1040;
const HEIGHT = 760;
// The chart's width inside the block: 1040 − 2 × 32 padding − 2 × 1 border − 2 × 24 padding
const CHART_WIDTH = 926;

// Source "favicons" drawn from brand marks, so the figure loads no images (the dashboard
// fetches each source's own favicon.ico)
const SOURCE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  Direct: CircleSlashIcon,
  Google: SiGoogle,
  "Hacker News": SiYcombinator,
  Claude: SiClaude,
  X: SiX,
  GitHub: SiGithub,
};

/**
 * Fig. 3: a site's revenue over 30 days: the header with the range controls, four joined
 * tiles (Revenue, Conversions, Avg. order value, Avg. time to convert) over a daily revenue
 * bar chart, then the Sources and Countries cards ranked by revenue, as the dashboard's
 * cards draw them on "Revenue ⇅", with drawn marks and emoji flags in place of favicons.
 */
export default function RevenueMock() {
  return (
    <MockViewport width={WIDTH} height={HEIGHT}>
      <div className="flex flex-col gap-6 px-8 pt-8">
        <MockHeader header={data.header} />
        <div className="overflow-hidden rounded-lg border border-border">
          <MockPageTiles tiles={data.tiles} bare />
          <div className="border-t border-border px-6 pt-6 pb-4">
            <BarLineChart
              id="mock-revenue"
              chart={data.chart}
              width={CHART_WIDTH}
              height={220}
              formatTick={moneyTick}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
          <Card
            tabs={["Sources", "Channels", "Referrers", "AI"]}
            rows={data.sources}
            icon={(key) => {
              const Icon = SOURCE_ICONS[key] ?? GlobeIcon;
              return <Icon className="size-3.5" />;
            }}
            label={(key) => key}
          />
          <Card
            tabs={["Countries", "Cities", "Map"]}
            rows={data.countries}
            icon={(key) => <span className="text-base leading-none">{countryFlag(key) || "🌐"}</span>}
            label={countryName}
          />
        </div>
      </div>
    </MockViewport>
  );
}

/**
 * StatsCard on "Revenue ⇅": text tabs (the first one active) and More ▾, then bar rows,
 * each bar as wide as its row's revenue against the top row's.
 */
function Card({
  tabs,
  rows,
  icon,
  label,
}: {
  tabs: string[];
  rows: MockRevenueRow[];
  icon: (key: string) => ReactNode;
  label: (key: string) => string;
}) {
  const top = Math.max(1, ...rows.map((r) => r.revenueMinor));
  return (
    <section className="flex min-w-0 flex-col bg-background p-6">
      <header className="flex h-6 items-center justify-between gap-4 text-[13px]">
        <div className="flex min-w-0 items-center gap-4">
          {tabs.map((t, i) => (
            <span key={t} className={cn("shrink-0", i === 0 ? "text-foreground" : "text-muted-foreground")}>
              {t}
            </span>
          ))}
          <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
            More
            <ChevronDownIcon className="size-3.5" />
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
          Revenue
          <ArrowUpDownIcon className="size-3.5" />
        </span>
      </header>
      <ul className="mt-4 flex flex-col gap-0.5">
        {rows.map((row) => (
          <li key={row.key} className="relative isolate flex h-9 items-center gap-2 rounded-md px-2.5 text-sm">
            <div
              className="absolute inset-y-0 left-0 -z-10 rounded-md bg-bar"
              style={{ width: `${Math.max((row.revenueMinor / top) * 100, 1)}%` }}
            />
            <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
              {icon(row.key)}
            </span>
            <span className="min-w-0 truncate">{label(row.key)}</span>
            <span className="ml-auto shrink-0 pl-3 tabular-nums">
              {formatMoney(row.revenueMinor, data.currency, true)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
