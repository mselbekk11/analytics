import type { HourPeriod } from "./dates";
import { dimValidator } from "./dims";
import { formatFiltersParam, MAX_FILTERS, parseFiltersParam, type Filter } from "./filters";
import { DEFAULT_PRESET, isValidRange, PRESETS, presetRange, type DateRange, type Preset } from "./ranges";

// Argument parsing for the MCP tools (design v4). The tools take the dashboard's own
// `?range=` and `?f=` grammar, but unlike the URL they refuse what they can't read
// instead of falling back, so an assistant never gets numbers for a range it didn't ask for.

export type ToolRange = {
  /** The range as asked for, or the default preset */
  param: string;
  range: DateRange;
  /** Today, Yesterday and 24h chart hours, as on the dashboard */
  hourly: HourPeriod | null;
};

export const RANGE_HELP = `range is one of ${PRESETS.join(", ")} or a custom span YYYY-MM-DD_YYYY-MM-DD (at most 365 days)`;

export const FILTER_HELP = `filters are "dim:value" pairs separated by commas (at most ${MAX_FILTERS}, one per dim), e.g. "country:US,device:mobile". Dims: ${dimValidator.members.map((m) => m.value).join(", ")}`;

/** A tool's `range` argument; missing or empty means the dashboard's default (7d). */
export function parseToolRange(param: string | undefined, today: string): ToolRange | { error: string } {
  const value = param?.trim() || DEFAULT_PRESET;
  if ((PRESETS as readonly string[]).includes(value)) {
    const preset = value as Preset;
    const hourly = preset === "today" || preset === "yesterday" || preset === "24h" ? preset : null;
    return { param: value, range: presetRange(preset, today), hourly };
  }
  const [from, to, extra] = value.split("_");
  if (from !== undefined && to !== undefined && extra === undefined && isValidRange({ from, to })) {
    return { param: value, range: { from, to }, hourly: null };
  }
  return { error: `Invalid range "${value}": ${RANGE_HELP}` };
}

/** A tool's `filters` argument, in the `?f=` syntax; every pair must be readable. */
export function parseToolFilters(param: string | undefined): Filter[] | { error: string } {
  const value = param?.trim() ?? "";
  if (value === "") return [];
  const parsed = parseFiltersParam(value);
  if (parsed.length !== value.split(",").length) return { error: `Invalid filters "${value}": ${FILTER_HELP}` };
  return parsed;
}

/** The filters as the dashboard's `?f=` shows them (readable, for echoing back). */
export function formatToolFilters(filters: Filter[]): string {
  return decodeURIComponent(formatFiltersParam(filters));
}
