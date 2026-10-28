"use client";

import Link from "next/link";
import { FiSettings } from "react-icons/fi";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, YAxis } from "recharts";
import { formatNumber, truncateMiddle } from "@/lib/format";
import { sitePath } from "@/components/TopBar";

type Day = { date: string; pageviews: number; visitors: number };

// Same colours as the site dashboard's chart
const SERIES = [
  { key: "pageviews", color: "#60a5fa" },
  { key: "visitors", color: "#f472b6" },
] as const;

/**
 * One site on /websites: a 30-day sparkline of pageviews and visitors, the domain
 * and the 30-day pageview total. The whole card opens the dashboard; the gear opens
 * settings (a separate link layered above the card's, since links cannot nest).
 */
export default function SiteCard({
  domain,
  pageviews,
  days,
}: {
  domain: string;
  pageviews: number;
  days: Day[];
}) {
  return (
    <div className="group relative flex flex-col rounded-lg border border-line bg-panel/40 transition-colors hover:border-ring">
      <div className="h-32 px-3 pt-3" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={days} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              {SERIES.map((s) => (
                <linearGradient key={s.key} id={`card-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0.05} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="var(--border)" />
            {/* Keeps a flat line at the bottom for a site with no traffic yet */}
            <YAxis hide domain={[0, (max: number) => Math.max(max, 1)]} />
            {SERIES.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={1.5}
                fill={`url(#card-${s.key})`}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-baseline justify-between gap-3 px-4 pt-3 pb-4">
        <Link
          href={sitePath(domain, "analytics")}
          title={domain}
          className="min-w-0 text-xl text-strong after:absolute after:inset-0 after:rounded-lg"
        >
          {truncateMiddle(domain, 22)}
        </Link>
        <span
          className="text-xl text-link tabular-nums"
          title="Pageviews in the last 30 days"
        >
          {formatNumber(pageviews)}
        </span>
      </div>
      <Link
        href={sitePath(domain, "settings")}
        aria-label={`${domain} settings`}
        className="absolute top-2 right-2 z-10 rounded p-1.5 text-muted-foreground opacity-60 hover:bg-line hover:text-strong hover:opacity-100 group-hover:opacity-100"
      >
        <FiSettings aria-hidden />
      </Link>
    </div>
  );
}
