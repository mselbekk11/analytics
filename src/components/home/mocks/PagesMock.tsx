import { ArrowDownIcon, SearchIcon } from "lucide-react";
import { cn } from "cn";
import { formatDuration, formatMoney, formatNumber, formatShare } from "@/lib/format";
import { pagesMock as data, type MockPageRow } from "./fixtures";
import MockViewport from "./MockViewport";
import { MockChange, MockHeader, MockPageTiles, MockSparkline } from "./parts";

// Drawn at about the width of the dashboard's column, so the table has its desktop
// columns; the frame cuts it off partway down the sixth row, as if the list goes on.
const WIDTH = 1040;
const HEIGHT = 750;

const COLUMNS: { label: string; numeric: boolean }[] = [
  { label: "Page", numeric: false },
  { label: "Trend", numeric: false },
  { label: "Views", numeric: true },
  { label: "Sessions", numeric: true },
  { label: "Bounce", numeric: true },
  { label: "Duration", numeric: true },
  { label: "Revenue", numeric: true },
];
// The table is sorted by views, largest first, as the Pages tab opens
const SORTED_BY = "Views";

/**
 * Fig. 2: the Pages tab of a made-up site, as the dashboard draws it: the header with the
 * range controls, the five joined tiles, and the All pages table with titles over paths,
 * trend sparklines, views with their share, sessions with their change, bounce, duration
 * and revenue.
 */
export default function PagesMock() {
  return (
    <MockViewport width={WIDTH} height={HEIGHT}>
      <div className="flex flex-col gap-10 px-8 pt-8">
        <MockHeader header={data.header} />
        <MockPageTiles tiles={data.tiles} />
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <span className="flex items-baseline gap-2 font-medium">
              All pages
              <span className="text-xs font-normal text-muted-foreground tabular-nums">{formatNumber(data.pages)}</span>
            </span>
            <span className="flex h-8 w-64 items-center gap-2 rounded-lg border border-input px-2 text-sm text-muted-foreground dark:bg-input/30">
              <SearchIcon className="size-4" />
              Search pages…
            </span>
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
              {data.rows.map((row) => (
                <Row key={row.path} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MockViewport>
  );
}

/** One row of the Pages table, cell for cell as PagesView's Row. */
function Row({ row }: { row: MockPageRow }) {
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="max-w-[320px] px-4 py-3 pl-5">
        {row.title === null ? (
          <span className="block truncate">{row.path}</span>
        ) : (
          <>
            <span className="block truncate">{row.title}</span>
            <span className="block truncate text-xs text-muted-foreground">{row.path}</span>
          </>
        )}
      </td>
      <td className="px-4 py-3">
        <MockSparkline values={row.trend} />
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
        {formatNumber(row.views)}
        <span className="ml-2 inline-block w-10 text-xs text-muted-foreground">
          {formatShare(row.views / data.totalPageviews)}
        </span>
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
        {formatNumber(row.sessions)}
        <span className="ml-2 inline-block w-14 text-left">
          {row.sessionsChange !== null && <MockChange change={row.sessionsChange} />}
        </span>
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {row.bounceRate === null ? <Dash /> : formatShare(row.bounceRate)}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
        {row.durationMs === null ? <Dash /> : formatDuration(row.durationMs)}
      </td>
      <td className="px-4 py-3 pr-5 text-right tabular-nums">
        {row.revenueMinor === 0 ? <Dash /> : formatMoney(row.revenueMinor, data.currency, true)}
      </td>
    </tr>
  );
}

function Dash() {
  return <span className="text-muted-foreground">–</span>;
}
