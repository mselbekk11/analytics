"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { localDate } from "../../../convex/lib/dates";
import { formatFiltersParam, parseFiltersParam, type Filter } from "../../../convex/lib/filters";
import {
  formatRangeParam,
  parseRangeParam,
  PRESETS,
  presetGranularity,
  presetRange,
  type DateRange,
  type Preset,
} from "../../../convex/lib/ranges";
import { useNow } from "./useNow";

const LIVE_REFRESH_MS = 30 * 1000;
// Hour ranges pass the clock to their queries snapped to this, so the arguments stay the
// same between steps. Local hours start on a 15-minute grid in every timezone, so a
// 5-minute step never lands in the wrong hour; the window moves on within 5 minutes.
const HOURLY_STEP_MS = 5 * 60 * 1000;

export type HourPeriod = "today" | "yesterday" | "24h";

/**
 * The range and filters of a site view (Analytics, Pages), from `?range=` and `?f=`, and
 * a way to change them. Filters pick sessions, so they need visitor ids: cookieless sites
 * (`tracking` false) ignore `?f=`.
 */
export function useSiteRange(timezone: string, tracking: boolean) {
  const now = useNow(LIVE_REFRESH_MS);
  const hourNow = useNow(HOURLY_STEP_MS);
  const today = localDate(now, timezone);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { range, preset } = parseRangeParam(searchParams.get("range"), today);
  const hourly: HourPeriod | null =
    preset === "today" || preset === "yesterday" || preset === "24h" ? preset : null;
  const filters = tracking ? parseFiltersParam(searchParams.get("f")) : [];

  /**
   * A new range or filters add a history entry. Other params (`set`) replace it, with no
   * server round trip (Next keeps useSearchParams in step with the history API); null
   * removes one.
   */
  function navigate(next: { range?: string; filters?: Filter[]; set?: Record<string, string | null> }) {
    const params = new URLSearchParams(searchParams);
    if (next.range !== undefined) params.set("range", next.range);
    for (const [name, value] of Object.entries(next.set ?? {})) {
      if (value === null) params.delete(name);
      else params.set(name, value);
    }
    params.delete("f");
    const f = formatFiltersParam(next.filters ?? filters);
    const query = [params.toString(), f && `f=${f}`].filter(Boolean).join("&");
    const url = `${pathname}${query ? `?${query}` : ""}`;
    if (next.range === undefined && next.filters === undefined) window.history.replaceState(null, "", url);
    else router.push(url, { scroll: false });
  }

  return {
    today,
    range,
    preset,
    hourly,
    /** The clock for hour-range queries, in 5-minute steps */
    hourNow,
    filters,
    searchParams,
    navigate,
    setRange: (next: Preset | DateRange) =>
      navigate({ range: typeof next === "string" ? next : toParam(next, today) }),
    setFilters: (next: Filter[]) => navigate({ filters: next }),
  };
}

/** A custom range that matches a day preset ending today goes back to the preset's short name. */
function toParam(range: DateRange, today: string): string {
  const preset = PRESETS.find((p) => {
    if (presetGranularity(p) === "hour") return false;
    const r = presetRange(p, today);
    return r.from === range.from && r.to === range.to;
  });
  return preset ?? formatRangeParam(range);
}
