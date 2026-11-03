import { ChevronLeftIcon } from "lucide-react";
import { cn } from "cn";
import world from "@/components/dashboard/world-dots.json";
import { countryFlag, deviceLabel, formatNumber } from "@/lib/format";
import { barRects, mapPoint, type MapProjection } from "@/lib/mockCharts";
import { persona } from "@/lib/names";
import { liveMock as data, type MockLiveVisitor } from "./fixtures";
import MockViewport from "./MockViewport";
import { MockSourceIcon } from "./parts";

// Drawn at the same width as Figs. 2, 3 and 6; the frame cuts the visitor feed off partway
// down, as if it goes on.
const WIDTH = 1040;
const HEIGHT = 560;
const PANEL_WIDTH = 320;
// The per-minute strip, the panel's width less its padding
const STRIP_WIDTH = PANEL_WIDTH - 2 * 20;
const STRIP_HEIGHT = 32;
// The map loses a strip of Pacific at each side (western Alaska, New Zealand), so the
// land fills more of the panel; every visitor sits well inside it
const CROP = 60;
const VIEW_BOX = `${CROP} 0 ${world.width - 2 * CROP} ${world.height}`;
const PROJECTION: MapProjection = { scale: world.scale, translate: [world.translate[0], world.translate[1]] };
// Visitor dots in map units, with a soft halo, as the Countries card's map draws its bubbles
const DOT_RADIUS = 5;
// How many visitors the feed lists before the frame cuts it off
const FEED_ROWS = 6;

/**
 * Fig. 7: a site's live view. On the left, a panel with the site and a Live dot, the
 * visitors of the last 5 minutes, pageviews a minute over the last 30 minutes, the top
 * sources of the visitors online (Countries and Devices are the other tabs), then the
 * latest visitors with their page, place, source, browser and device. On the right, the
 * dashboard's dotted world map (its build-time land dots, so no request) with a dot per
 * visitor at their city.
 */
export default function LiveMock() {
  const online = data.visitors.length;
  return (
    <MockViewport width={WIDTH} height={HEIGHT}>
      <div className="flex" style={{ height: HEIGHT }}>
        <div className="flex shrink-0 flex-col border-r border-border" style={{ width: PANEL_WIDTH }}>
          <div className="flex flex-col gap-4 px-5 pt-4 pb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 text-muted-foreground">
                <ChevronLeftIcon className="size-4" />
                {data.site}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            </div>
            <div className="flex items-end justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">Realtime</span>
                <span className="text-xs text-muted-foreground">online in the last 5 minutes</span>
              </div>
              <span className="text-3xl leading-none font-semibold tracking-tight tabular-nums">
                {formatNumber(online)}
              </span>
            </div>
            <PerMinute values={data.perMinute} />
          </div>
          <div className="border-t border-border px-5 py-3">
            <div className="flex gap-4 text-[13px]">
              {data.tabs.map((t, i) => (
                <span key={t} className={i === 0 ? "text-foreground" : "text-muted-foreground"}>
                  {t}
                </span>
              ))}
            </div>
            <Sources />
          </div>
          <div className="min-h-0 flex-1 border-t border-border pt-3">
            <div className="flex items-baseline justify-between px-5 text-[13px]">
              <span>Visitors</span>
              <span className="text-xs text-muted-foreground">latest first</span>
            </div>
            <ul className="mt-1 flex flex-col">
              {data.visitors.slice(0, FEED_ROWS).map((v) => (
                <FeedRow key={v.seed} visitor={v} />
              ))}
            </ul>
          </div>
        </div>
        <WorldDots visitors={data.visitors} />
      </div>
    </MockViewport>
  );
}

/** Pageviews a minute as small bars, oldest on the left, with the time span under them. */
function PerMinute({ values }: { values: number[] }) {
  const box = { width: STRIP_WIDTH, height: STRIP_HEIGHT, max: Math.max(1, ...values) };
  const rects = barRects(values, box, { gap: 0.35 });
  return (
    <div className="flex flex-col gap-1.5">
      <svg width={STRIP_WIDTH} height={STRIP_HEIGHT} viewBox={`0 0 ${STRIP_WIDTH} ${STRIP_HEIGHT}`} className="block">
        {rects.map((b, i) => (
          <rect key={i} {...b} rx={1} style={{ fill: "var(--series-pageviews)" }} />
        ))}
      </svg>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>Pageviews a minute · 30 min ago</span>
        <span>now</span>
      </div>
    </div>
  );
}

/** StatsCard's bar rows for the visitors online, each bar as wide as its count against the top row's. */
function Sources() {
  const top = Math.max(1, ...data.sources.map((r) => r.visitors));
  return (
    <ul className="mt-2 flex flex-col gap-0.5">
      {data.sources.map((row) => (
        <li key={row.key} className="relative isolate flex h-7 items-center gap-2 rounded-md px-2.5 text-[13px]">
          <div
            className="absolute inset-y-0 left-0 -z-10 rounded-md bg-bar"
            style={{ width: `${(row.visitors / top) * 100}%` }}
          />
          <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
            <MockSourceIcon source={row.key} className="size-3.5" />
          </span>
          <span className="min-w-0 truncate">{row.key}</span>
          <span className="ml-auto shrink-0 pl-3 tabular-nums">{formatNumber(row.visitors)}</span>
        </li>
      ))}
    </ul>
  );
}

/** One visitor: their persona avatar, the page they're on, then flag, city, source, browser and device. */
function FeedRow({ visitor: v }: { visitor: MockLiveVisitor }) {
  const p = persona(v.seed);
  return (
    <li className="flex items-center gap-3 border-b border-border/60 px-5 py-2">
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-base"
        style={{ backgroundColor: p.color }}
      >
        {p.emoji}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-mono text-xs">{v.path}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">{v.ago}</span>
        </div>
        <span className="truncate text-[11px] text-muted-foreground">
          {countryFlag(v.country)} {v.city} · {v.source} · {v.browser} on {deviceLabel(v.device).toLowerCase()}
        </span>
      </div>
    </li>
  );
}

/**
 * The dotted world map from the dashboard's Countries card (land dots built by
 * `npm run build:world-map`, inlined at build time) with a dot per visitor at their city,
 * the latest one ringed.
 */
function WorldDots({ visitors }: { visitors: MockLiveVisitor[] }) {
  return (
    <div className="flex min-w-0 flex-1 items-center bg-bar/60">
      <svg viewBox={VIEW_BOX} className="block h-auto w-full">
        <path
          d={world.dots}
          className="fill-none stroke-foreground/25 dark:stroke-foreground/15"
          strokeWidth={world.dotRadius * 2}
          strokeLinecap="round"
        />
        {/* Oldest first, so the latest visitor draws on top */}
        {[...visitors].reverse().map((v, i, all) => {
          const [cx, cy] = mapPoint(v.lon, v.lat, PROJECTION);
          const latest = i === all.length - 1;
          return (
            <g key={v.seed}>
              {latest && (
                <circle cx={cx} cy={cy} r={DOT_RADIUS * 2.6} className="fill-series-visitors [fill-opacity:0.15]" />
              )}
              <circle
                cx={cx}
                cy={cy}
                r={DOT_RADIUS}
                className={cn(
                  "fill-series-visitors stroke-series-visitors [stroke-opacity:0.3] [stroke-width:5]",
                  !latest && "[fill-opacity:0.85]",
                )}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
