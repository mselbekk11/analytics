"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { currencyDigits, formatMoney, formatNumber, formatPoint } from "@/lib/format";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

type Count = "visitors" | "pageviews" | "clicks" | "revenue";

const LABELS: Record<Count, string> = {
  visitors: "Visitors",
  pageviews: "Pageviews",
  clicks: "Clicks",
  revenue: "Revenue",
};
// Outbound clicks have no series of their own; they take the bar colour of visitors
const COLORS: Record<Count, string> = {
  visitors: "var(--series-visitors)",
  pageviews: "var(--series-pageviews)",
  clicks: "var(--series-visitors)",
  revenue: "var(--series-revenue)",
};

/**
 * Bars of one count per day (or hour, for points like "2026-11-02T14"), in its series
 * colour, with a tooltip. The page drawer's pageviews, the Users tab's visitors, the
 * Outbound tab's clicks and the Revenue tab's revenue (in the smallest unit of `currency`).
 */
export default function CountChart({
  data,
  count,
  currency,
  className,
}: {
  data: ({ date: string } & Partial<Record<Count, number>>)[];
  count: Count;
  /** Revenue's currency: values are its smallest unit and show as money */
  currency?: string;
  /** Sets the height; h-44 by default */
  className?: string;
}) {
  const config = { [count]: { label: LABELS[count], color: COLORS[count] } };
  // Money is drawn in whole units of the currency, so the axis ticks land on round amounts
  const unit = currency === undefined ? 1 : 10 ** currencyDigits(currency);
  const points = unit === 1 ? data : data.map((p) => ({ ...p, [count]: (p[count] ?? 0) / unit }));
  const format = (n: number) => (currency === undefined ? formatNumber(n) : formatMoney(n * unit, currency, true));
  return (
    <ChartContainer config={config} className={className ?? "aspect-auto h-44 w-full"}>
      <BarChart data={points} margin={{ top: 4, right: 16, bottom: 0, left: -8 }} barCategoryGap="20%">
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => formatPoint(d)}
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          minTickGap={32}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={currency === undefined ? 40 : 56}
          tickFormatter={(n: number) => format(n)}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          content={
            <ChartTooltipContent
              className="min-w-36 rounded-md border-border bg-popover px-3 py-2"
              labelClassName="font-normal text-muted-foreground"
              labelFormatter={(value) => formatPoint(String(value), true)}
              formatter={(value) => (
                <div className="flex w-full items-center gap-2">
                  <span className="size-2 shrink-0 rounded-[2px]" style={{ background: `var(--color-${count})` }} />
                  <span className="text-muted-foreground">{LABELS[count]}</span>
                  <span className="ml-auto pl-4 font-medium text-foreground tabular-nums">
                    {currency === undefined ? formatNumber(Number(value)) : formatMoney(Math.round(Number(value) * unit), currency)}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar
          dataKey={count}
          fill={`var(--color-${count})`}
          radius={[2, 2, 0, 0]}
          maxBarSize={12}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartContainer>
  );
}
