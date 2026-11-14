import { ConvexError, v, type Infer } from "convex/values";
import { MAX_GOAL_KEY } from "./goals";
import { matchesPattern, parseExcludedPath } from "./paths";

// Funnels (launch v1 Phase 12). A funnel is 2 to 8 ordered steps, each a page pattern
// (the excluded-paths globs: `*` matches anything, a trailing `/*` the bare prefix too)
// or a custom event by name, and a completion window. A visitor enters with a step-1 hit
// in the range; each later step is the first matching hit after the previous one, no
// later than the window from entry. A visitor who enters more than once counts their
// furthest attempt. Pure, so the queries, the form and the tests share it.

export const MIN_STEPS = 2;
export const MAX_STEPS = 8;
export const MAX_FUNNELS = 20; // per site
export const MAX_FUNNEL_NAME = 60;
export const DEFAULT_WINDOW_HOURS = 24;
export const MAX_WINDOW_HOURS = 30 * 24;

export const funnelStepValidator = v.union(
  v.object({ kind: v.literal("page"), pattern: v.string() }),
  v.object({ kind: v.literal("event"), name: v.string() }),
);
export type FunnelStep = Infer<typeof funnelStepValidator>;

/** A new funnel's name, steps and window, cleaned up, or a ConvexError saying what is wrong. */
export function parseFunnel(
  name: string,
  steps: FunnelStep[],
  windowHours: number | undefined,
): { name: string; steps: FunnelStep[]; windowHours: number } {
  const cleanName = name.trim();
  if (cleanName === "") throw new ConvexError("Give the funnel a name");
  if (cleanName.length > MAX_FUNNEL_NAME) throw new ConvexError(`Names are at most ${MAX_FUNNEL_NAME} characters`);
  if (steps.length < MIN_STEPS || steps.length > MAX_STEPS) {
    throw new ConvexError(`A funnel has ${MIN_STEPS} to ${MAX_STEPS} steps`);
  }
  const cleanSteps = steps.map((step, i): FunnelStep => {
    const error = stepError(step);
    if (error !== null) throw new ConvexError(`Step ${i + 1}: ${error}`);
    return cleanStep(step);
  });
  const hours = windowHours ?? DEFAULT_WINDOW_HOURS;
  if (!Number.isInteger(hours) || hours < 1 || hours > MAX_WINDOW_HOURS) {
    throw new ConvexError(`The window is 1 to ${MAX_WINDOW_HOURS} hours`);
  }
  return { name: cleanName, steps: cleanSteps, windowHours: hours };
}

/** What is wrong with one step as typed, or null. The form shows it under the step. */
export function stepError(step: FunnelStep): string | null {
  if (step.kind === "page") {
    const parsed = parseExcludedPath(step.pattern);
    return "error" in parsed ? parsed.error.replace("/admin/*", "/blog/*") : null;
  }
  const name = step.name.trim();
  if (name === "") return "Enter an event name";
  if (name.length > MAX_GOAL_KEY) return `Event names are at most ${MAX_GOAL_KEY} characters`;
  return null;
}

function cleanStep(step: FunnelStep): FunnelStep {
  if (step.kind === "event") return { kind: "event", name: step.name.trim() };
  const parsed = parseExcludedPath(step.pattern);
  return { kind: "page", pattern: "pattern" in parsed ? parsed.pattern : step.pattern };
}

/** A pageview (its path) or a custom event (its name), in time order within a visitor. */
export type Hit = { ts: number; kind: "page" | "event"; key: string; entry: boolean };

export function matchesStep(hit: Hit, step: FunnelStep): boolean {
  return step.kind === "page"
    ? hit.kind === "page" && matchesPattern(hit.key, step.pattern)
    : hit.kind === "event" && hit.key === step.name;
}

/**
 * How many steps one visitor reached (0 when they never entered). `hits` are in time
 * order, pageviews before the events they carry; `entry` marks hits inside the range,
 * which only matters for step 1. Each later step must be a later hit than the previous
 * step's, at most `windowMs` after the entry. The earliest match is always the best one
 * for the steps after it, so one pass per entry is enough.
 */
export function stepsReached(hits: Hit[], steps: FunnelStep[], windowMs: number): number {
  let best = 0;
  for (let i = 0; i < hits.length && best < steps.length; i++) {
    if (!hits[i].entry || !matchesStep(hits[i], steps[0])) continue;
    const deadline = hits[i].ts + windowMs;
    let reached = 1;
    for (let j = i + 1; j < hits.length && reached < steps.length && hits[j].ts <= deadline; j++) {
      if (matchesStep(hits[j], steps[reached])) reached++;
    }
    best = Math.max(best, reached);
  }
  return best;
}

/** Visitors who reached each step, from every visitor's hits. */
export function funnelCounts(journeys: Iterable<Hit[]>, steps: FunnelStep[], windowHours: number): number[] {
  const counts = steps.map(() => 0);
  const windowMs = windowHours * 60 * 60 * 1000;
  for (const hits of journeys) {
    const reached = stepsReached(hits, steps, windowMs);
    for (let s = 0; s < reached; s++) counts[s]++;
  }
  return counts;
}

export type StepStats = {
  count: number;
  ofEntered: number; // share of step 1's visitors, 0 when nobody entered
  ofPrevious: number; // share of the previous step's (1 on step 1)
  dropped: number; // reached the previous step but not this one (0 on step 1)
};

/** Each step's bar and labels, and the headline numbers, from the counts. */
export function funnelStats(counts: number[]): {
  steps: StepStats[];
  entered: number;
  completed: number;
  conversion: number;
} {
  const entered = counts[0] ?? 0;
  const steps = counts.map((count, i) => {
    const previous = i === 0 ? count : counts[i - 1];
    return {
      count,
      ofEntered: entered > 0 ? count / entered : 0,
      ofPrevious: i === 0 ? 1 : previous > 0 ? count / previous : 0,
      dropped: i === 0 ? 0 : previous - count,
    };
  });
  const completed = counts[counts.length - 1] ?? 0;
  return { steps, entered, completed, conversion: entered > 0 ? completed / entered : 0 };
}

/** How a step reads on a card and in the form's summary. */
export function stepLabel(step: FunnelStep): string {
  return step.kind === "page" ? step.pattern : step.name;
}

/** "24 hours", "1 hour", "7 days". */
export function windowLabel(hours: number): string {
  if (hours % 24 === 0 && hours >= 48) return `${hours / 24} days`;
  return hours === 1 ? "1 hour" : `${hours} hours`;
}
