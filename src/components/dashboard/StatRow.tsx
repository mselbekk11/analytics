import type { ConversionsResult, GoalsResult, Summary, Totals } from "../../../convex/lib/statsShapes";
import { percentChange } from "../../../convex/lib/ranges";
import { formatDuration, formatMoney, formatNumber, formatRate, goalLabel } from "@/lib/format";
import { SERIES_COLOR, type SeriesKey } from "./series";
import StatTile from "./StatTile";

type Props = {
  /** undefined while loading */
  summary: Summary | undefined;
  conversions: ConversionsResult | undefined;
  goals: GoalsResult | undefined;
  /** The site's currency when it takes payments; null hides Revenue */
  currency: string | null;
  keyGoal: string | null;
  /** Visitor ids: bounce rate, session time and the session-based changes */
  tracking: boolean;
  /** Series on the chart */
  on: SeriesKey[];
  onToggle: (series: SeriesKey) => void;
};

/**
 * The joined stat tiles on top of the chart: Visitors, Pageviews, Revenue, Conv. rate,
 * the key goal, Bounce rate and Visit duration, each hidden where it doesn't apply.
 * Each one switches its series on the chart.
 */
export default function StatRow({ summary, conversions, goals, currency, keyGoal, tracking, on, onToggle }: Props) {
  const cur = summary?.current;
  const prev = summary?.previous;
  // Session-based numbers changed definition when visitor tracking started
  const incomparable = summary?.comparable === false;
  const change = (pick: (t: Totals) => number | null) => {
    if (!cur || !prev) return null;
    const a = pick(cur);
    const b = pick(prev);
    return a === null || b === null ? null : percentChange(a, b);
  };

  const rate = (converted: number | null | undefined, t: Totals | undefined) =>
    converted == null || !t || t.visitors === 0 ? null : Math.min(1, converted / t.visitors);
  const curRate = rate(conversions?.current, cur);
  const prevRate = rate(conversions?.previous, prev);

  const goalNow = keyGoal === null ? null : (goals?.rows.find((r) => r.name === keyGoal)?.completions ?? 0);
  const goalBefore = goals?.keyGoalPrevious ?? null;

  const count =
    3 + Number(currency !== null) + Number(currency !== null || keyGoal !== null) + Number(keyGoal !== null) + Number(tracking);
  const tile = (series: SeriesKey) => ({
    on: on.includes(series),
    color: SERIES_COLOR[series],
    onToggle: () => onToggle(series),
    dense: count >= 6,
  });

  return (
    <div className="grid grid-cols-2 gap-px bg-border sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
      <StatTile
        {...tile("visitors")}
        label="Visitors"
        value={cur && (summary.visitorsApprox ? "≈" : "") + formatNumber(cur.visitors)}
        change={change((t) => t.visitors)}
        incomparable={incomparable}
        tooltip={
          summary?.visitorsApprox
            ? "Too many sessions to count distinct visitors: this is the sum of daily visitors"
            : undefined
        }
      />
      <StatTile
        {...tile("pageviews")}
        label="Pageviews"
        value={cur && formatNumber(cur.pageviews)}
        change={change((t) => t.pageviews)}
      />
      {currency !== null && (
        <StatTile
          {...tile("revenue")}
          label="Revenue"
          value={cur && formatMoney(cur.revenueMinor, currency, true)}
          change={change((t) => t.revenueMinor)}
          tooltip={
            cur && (
              <Lines
                lines={[
                  formatMoney(cur.revenueMinor, currency),
                  cur.refundsMinor > 0 ? `Net of ${formatMoney(cur.refundsMinor, currency)} in refunds` : null,
                  `${formatNumber(cur.payments)} ${cur.payments === 1 ? "payment" : "payments"}`,
                  cur.visitors === 0
                    ? null
                    : `${formatMoney(Math.round(cur.revenueMinor / cur.visitors), currency)} per visitor`,
                ]}
              />
            )
          }
        />
      )}
      {(currency !== null || keyGoal !== null) && (
        <StatTile
          {...tile("conversionRate")}
          label="Conv. rate"
          value={conversions && cur && (curRate === null ? "–" : formatRate(curRate))}
          change={curRate === null || prevRate === null ? null : percentChange(curRate, prevRate)}
          incomparable={incomparable}
          tooltip={
            conversions?.kind === "revenue"
              ? "Visitors who paid ÷ visitors"
              : `Visitors who completed the key goal "${keyGoal}" ÷ visitors`
          }
        />
      )}
      {keyGoal !== null && (
        <StatTile
          {...tile("goal")}
          label={goalLabel(keyGoal)}
          value={goals && formatNumber(goalNow ?? 0)}
          change={goalNow === null || goalBefore === null ? null : percentChange(goalNow, goalBefore)}
          tooltip={`Completions of the key goal "${keyGoal}"`}
        />
      )}
      {tracking && (
        <StatTile
          {...tile("bounceRate")}
          label="Bounce rate"
          value={cur && (cur.bounceRate === null ? "–" : formatRate(cur.bounceRate))}
          change={change((t) => t.bounceRate)}
          incomparable={incomparable}
          lowerIsBetter
          tooltip="Sessions with one pageview and no goal"
        />
      )}
      {tracking ? (
        <StatTile
          {...tile("visitDuration")}
          label="Visit duration"
          value={cur && (cur.sessionTimeMs === null ? "–" : formatDuration(cur.sessionTimeMs))}
          change={change((t) => t.sessionTimeMs)}
          incomparable={incomparable}
          tooltip={
            cur && (
              <Lines
                lines={[
                  "Average visible-tab time per session",
                  `${formatNumber(cur.sessions)} ${cur.sessions === 1 ? "session" : "sessions"}`,
                  cur.timeOnPageMs === null ? null : `${formatDuration(cur.timeOnPageMs)} time on page`,
                ]}
              />
            )
          }
        />
      ) : (
        <StatTile
          {...tile("visitDuration")}
          label="Visit duration"
          value={cur && (cur.timeOnPageMs === null ? "–" : formatDuration(cur.timeOnPageMs))}
          change={change((t) => t.timeOnPageMs)}
          tooltip="Average time on page"
        />
      )}
    </div>
  );
}

function Lines({ lines }: { lines: (string | null)[] }) {
  return (
    <div className="flex flex-col gap-0.5">
      {lines.filter((l) => l !== null).map((l) => (
        <span key={l}>{l}</span>
      ))}
    </div>
  );
}
