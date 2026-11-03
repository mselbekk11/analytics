import { ArrowDownIcon } from "lucide-react";
import { cn } from "cn";
import { formatNumber, formatRate } from "@/lib/format";
import { goalsMock as data, type MockGoalRow } from "./fixtures";
import MockViewport from "./MockViewport";
import { MOCK_COLOR, MockPageTiles, MockPanelHeader, MockSourceIcon } from "./parts";

// The same size as FunnelMock, which shares its row; the frame cuts the table off partway
// down its last row, as if the list goes on.
const WIDTH = 560;
const HEIGHT = 470;

// The table's type filter, each with its count; All is pressed
const FILTERS: { label: string; count: number }[] = [
  { label: "All", count: data.rows.length },
  { label: "Events", count: data.rows.filter((r) => r.kind === "Event").length },
  { label: "Pages", count: data.rows.filter((r) => r.kind === "Page").length },
];

const COLUMNS: { label: string; numeric: boolean }[] = [
  { label: "Goal", numeric: false },
  { label: "Type", numeric: false },
  { label: "Conversions", numeric: true },
  { label: "Rate", numeric: true },
  { label: "Top source", numeric: false },
];
// Sorted by conversions, largest first
const SORTED_BY = "Conversions";

/**
 * Fig. 5: a site's goals over 30 days (pageview goals and this view aren't built yet),
 * drawn in the dashboard's style: the header, three joined tiles, then the goals table
 * with the key goal marked, each goal's type, conversions, conversion rate with a small
 * bar, and the source that brought the most conversions.
 */
export default function GoalsMock() {
  const topRate = Math.max(...data.rows.map((r) => r.conversions)) / data.visitors;
  return (
    <MockViewport width={WIDTH} height={HEIGHT}>
      <div className="flex flex-col gap-5 px-6 pt-6">
        <MockPanelHeader title={data.title} note={data.note} range={data.range} action={data.action} />
        <MockPageTiles tiles={data.tiles} />
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="flex items-baseline gap-2 text-sm font-medium">
              Goals
              <span className="text-xs font-normal text-muted-foreground tabular-nums">{data.rows.length}</span>
            </span>
            <span className="flex rounded-lg border border-border p-0.5">
              {FILTERS.map((f, i) => (
                <span
                  key={f.label}
                  className={cn(
                    "flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium",
                    i === 0 ? "bg-muted text-foreground" : "text-muted-foreground",
                  )}
                >
                  {f.label}
                  <span className="font-normal text-muted-foreground tabular-nums">{f.count}</span>
                </span>
              ))}
            </span>
          </div>
          <table className="w-full border-t border-border text-[13px]">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                {COLUMNS.map((c) => (
                  <th
                    key={c.label}
                    className={cn("px-2 py-2.5 font-normal first:pl-4 last:pr-4", c.numeric ? "text-right" : "text-left")}
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
                <Row key={row.name} row={row} topRate={topRate} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MockViewport>
  );
}

/** One goal: name (with the Key goal badge), type, conversions, rate and bar, top source. */
function Row({ row, topRate }: { row: MockGoalRow; topRate: number }) {
  const rate = row.conversions / data.visitors;
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="max-w-[170px] px-2 py-2.5 pl-4">
        <span className="flex items-center gap-2">
          <span className="min-w-0 truncate font-medium">{row.name}</span>
          {row.key && (
            <span className="inline-flex h-5 shrink-0 items-center rounded-4xl border border-border bg-background px-2 text-[11px] font-medium">
              Key goal
            </span>
          )}
        </span>
      </td>
      <td className="px-2 py-2.5 text-muted-foreground">{row.kind}</td>
      <td className="px-2 py-2.5 text-right tabular-nums">{formatNumber(row.conversions)}</td>
      <td className="px-2 py-2.5">
        <span className="flex items-center justify-end gap-2 tabular-nums">
          {formatRate(rate)}
          <span className="h-1.5 w-10 overflow-hidden rounded-full bg-bar">
            <span
              className="block h-full rounded-full"
              style={{ width: `${Math.max((rate / topRate) * 100, 4)}%`, background: MOCK_COLOR.goal }}
            />
          </span>
        </span>
      </td>
      <td className="px-2 py-2.5 pr-4">
        <span className="flex items-center gap-1.5 whitespace-nowrap text-muted-foreground">
          <MockSourceIcon source={row.topSource} className="size-3.5 shrink-0" />
          {row.topSource}
        </span>
      </td>
    </tr>
  );
}
