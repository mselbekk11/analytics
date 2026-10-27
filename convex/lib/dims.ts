import { v, type Infer } from "convex/values";

// Every dimension a dailyDims row can hold. Pageview dims (page, referrer, device,
// browser, country) count each pageview and its visitor. Session dims (5b on) count
// sessions, and visitors once per visitor, key and day; their `pageviews` stays 0.
export const dimValidator = v.union(
  v.literal("page"),
  v.literal("referrer"),
  v.literal("device"),
  v.literal("browser"),
  v.literal("country"),
  v.literal("source"),
  v.literal("channel"),
  v.literal("utm_source"),
  v.literal("utm_medium"),
  v.literal("utm_campaign"),
  v.literal("utm_term"),
  v.literal("utm_content"),
  v.literal("ref"),
  v.literal("entry"),
  v.literal("exit"),
);

export type Dim = Infer<typeof dimValidator>;

/** Which count a list ranks and shows: pageviews for pages, sessions for entry and exit pages, visitors otherwise. */
export function dimMetric(dim: Dim): "pageviews" | "sessions" | "visitors" {
  if (dim === "page") return "pageviews";
  if (dim === "entry" || dim === "exit") return "sessions";
  return "visitors";
}
