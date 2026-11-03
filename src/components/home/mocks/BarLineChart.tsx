import { areaPath, groupedBars, linePath, niceScale, slotCenter, ticks, valueY } from "@/lib/mockCharts";
import type { MockChart } from "./fixtures";
import { MOCK_COLOR } from "./parts";

// TrafficChart's layout: a 44px count axis on the left, x labels 10px under the plot
const AXIS_W = 44;
const TOP = 8;
const BOTTOM = 28;
const RIGHT = 4;

/**
 * TrafficChart as inline SVG: bars side by side in each bucket, lines with an optional soft
 * fill over them, y labels for the count axis and every `labelEvery`th bucket label.
 * `id` keeps the fills' gradient ids unique on the page; `formatTick` writes the y labels
 * (plain numbers by default, `moneyTick` for a revenue axis).
 */
export default function BarLineChart({
  id,
  chart,
  width,
  height = 288,
  formatTick = String,
}: {
  id: string;
  chart: MockChart;
  width: number;
  height?: number;
  formatTick?: (value: number) => string;
}) {
  const all = [...chart.lines, ...chart.bars];
  const counted = all.filter((s) => s.axis === "count");
  const scale = niceScale(Math.max(0, ...counted.flatMap((s) => s.values)));
  const left = counted.length > 0 ? AXIS_W : RIGHT;
  const plot = { width: width - left - RIGHT, height: height - TOP - BOTTOM };
  const n = chart.labels.length;
  // Hidden scales as on the dashboard: bars stay in the lower part, lines use most of the height
  const maxOf = (values: number[], top: number) => Math.max(1, ...values) * top;

  const bars = groupedBars(
    chart.bars.map((s) => ({ values: s.values, max: s.axis === "count" ? scale.max : maxOf(s.values, 1.5) })),
    plot,
  );

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
      <defs>
        {chart.lines.map(
          (s, i) =>
            s.fill !== undefined && (
              <linearGradient key={s.label} id={`${id}-fill-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: MOCK_COLOR[s.color], stopOpacity: s.fill }} />
                <stop offset="100%" style={{ stopColor: MOCK_COLOR[s.color], stopOpacity: 0 }} />
              </linearGradient>
            ),
        )}
      </defs>
      <g className="fill-muted-foreground text-xs">
        {counted.length > 0 &&
          ticks(scale).map((t) => (
            <text key={t} x={left - 8} y={TOP + valueY(t, { ...plot, max: scale.max })} dy="0.32em" textAnchor="end">
              {formatTick(t)}
            </text>
          ))}
        {chart.labels.map(
          (label, i) =>
            i % chart.labelEvery === 0 && (
              <text key={label} x={left + slotCenter(i, n, plot.width)} y={TOP + plot.height + 10} dy="0.71em" textAnchor="middle">
                {label}
              </text>
            ),
        )}
      </g>
      <g transform={`translate(${left} ${TOP})`}>
        {bars.map((rects, s) =>
          rects.map(
            (b, i) =>
              b.height > 0 && (
                <rect key={`${s}-${i}`} {...b} rx={2} style={{ fill: MOCK_COLOR[chart.bars[s].color] }} />
              ),
          ),
        )}
        {/* The first line is drawn last, on top */}
        {chart.lines
          .map((s, i) => {
            const box = { ...plot, max: s.axis === "count" ? scale.max : maxOf(s.values, 1.1) };
            return (
              <g key={s.label}>
                {s.fill !== undefined && <path d={areaPath(s.values, box)} fill={`url(#${id}-fill-${i})`} />}
                <path
                  d={linePath(s.values, box)}
                  fill="none"
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray={s.dash}
                  style={{ stroke: MOCK_COLOR[s.color] }}
                />
              </g>
            );
          })
          .reverse()}
      </g>
    </svg>
  );
}
