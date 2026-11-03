import { ArrowDownIcon, SearchIcon } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { cn } from "cn";
import { formatNumber, formatRate } from "@/lib/format";
import BarLineChart from "./BarLineChart";
import { searchMock as data, type MockKeywordRow } from "./fixtures";
import MockViewport from "./MockViewport";
import { MockHeader, MockLegend, MockPageTiles } from "./parts";

// Drawn at the same width as Figs. 2 and 3; the frame cuts the keywords table off partway
// down its third row, as if the list goes on.
const WIDTH = 1040;
const HEIGHT = 864;
// The chart's width inside the block: 1040 − 2 × 32 padding − 2 × 1 border − 2 × 24 padding
const CHART_WIDTH = 926;

// Which engine the table shows; All is pressed
const ENGINES = ["All", "Google", "Bing"];

const COLUMNS: { label: string; numeric: boolean }[] = [
  { label: "Keyword", numeric: false },
  { label: "Clicks", numeric: true },
  { label: "Impressions", numeric: true },
  { label: "CTR", numeric: true },
  { label: "Position", numeric: true },
  { label: "Page", numeric: false },
];
// Sorted by clicks, largest first
const SORTED_BY = "Clicks";

/**
 * Fig. 6: a site's Google and Bing search traffic over 28 days (Search isn't built yet),
 * drawn in the dashboard's style: the header with its synced note, Performance | Indexing
 * and the range menu, four joined tiles (Clicks, Impressions, Click-through rate, Avg.
 * position) over a legend and the bar-and-line chart (clicks as bars, impressions and
 * position as lines, position upside down), then the top of the keywords table with its
 * engine toggle, search box and filter chips.
 */
export default function SearchMock() {
  const { keywords } = data;
  return (
    <MockViewport width={WIDTH} height={HEIGHT}>
      <div className="flex flex-col gap-6 px-8 pt-8">
        <MockHeader header={data.header} />
        <div className="overflow-hidden rounded-lg border border-border">
          <MockPageTiles tiles={data.tiles} bare />
          <div className="flex flex-col gap-4 border-t border-border px-6 pt-6 pb-4">
            <MockLegend chart={data.chart} />
            <BarLineChart id="mock-search" chart={data.chart} width={CHART_WIDTH} height={220} />
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-baseline gap-2 font-medium">
                Keywords
                <span className="text-xs font-normal text-muted-foreground tabular-nums">
                  {formatNumber(keywords.total)}
                </span>
              </span>
              <span className="truncate text-xs text-muted-foreground">
                The searches that brought visitors from Google and Bing
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="flex rounded-lg border border-border p-0.5">
                {ENGINES.map((e, i) => (
                  <span
                    key={e}
                    className={cn(
                      "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium",
                      i === 0 ? "bg-muted text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {e === "Google" && <SiGoogle className="size-3" />}
                    {e}
                  </span>
                ))}
              </span>
              <span className="flex h-8 w-56 items-center gap-2 rounded-lg border border-input px-2 text-sm text-muted-foreground dark:bg-input/30">
                <SearchIcon className="size-4" />
                Search keywords…
              </span>
            </div>
          </div>
          <div className="flex gap-1.5 border-t border-border px-5 py-3">
            {keywords.filters.map((f, i) => (
              <span
                key={f.label}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium whitespace-nowrap",
                  i === 0 ? "border-transparent bg-muted text-foreground" : "border-border text-muted-foreground",
                )}
              >
                {f.label}
                <span className="font-normal text-muted-foreground tabular-nums">{f.count}</span>
              </span>
            ))}
          </div>
          <table className="w-full border-t border-border text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                {COLUMNS.map((c) => (
                  <th
                    key={c.label}
                    className={cn("px-4 py-3 font-normal first:pl-5 last:pr-5", c.numeric ? "text-right" : "text-left")}
                  >
                    <span className={cn("inline-flex items-center gap-1", c.label === SORTED_BY && "text-foreground")}>
                      {c.label}
                      {c.label === SORTED_BY && <ArrowDownIcon className="size-3" />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keywords.rows.map((row) => (
                <Row key={row.keyword} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MockViewport>
  );
}

/** One keyword: the query, clicks, impressions, the rate between them, position and page. */
function Row({ row }: { row: MockKeywordRow }) {
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="max-w-[340px] truncate px-4 py-3 pl-5">{row.keyword}</td>
      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.clicks)}</td>
      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.impressions)}</td>
      <td className="px-4 py-3 text-right tabular-nums">{formatRate(row.clicks / row.impressions)}</td>
      <td className="px-4 py-3 text-right tabular-nums">{row.position.toFixed(1)}</td>
      <td className="max-w-[200px] truncate px-4 py-3 pr-5 text-muted-foreground">{row.page}</td>
    </tr>
  );
}
