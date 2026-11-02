import { McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import { z } from "zod";
import { api } from "../../../../convex/_generated/api";
import { dimValidator, type Dim } from "../../../../convex/lib/dims";
import { FILTER_HELP, RANGE_HELP } from "../../../../convex/lib/mcp";
import { PAGE_SORTS } from "../../../../convex/lib/pages";

// The MCP server's tools (design v4). Every tool is read-only and calls one mcp.*
// Convex query with INGEST_SECRET and the key's hash, so the numbers come from the same
// helpers as the dashboard. Results are compact JSON text.

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const INSTRUCTIONS = `Read-only access to the owner's website analytics. Start with list_sites to get the domains.
Every stats tool takes a domain and an optional range (default 7d): ${RANGE_HELP}. Dates are days in the site's timezone; today, yesterday and 24h are hourly.
Most also take optional filters in the dashboard's syntax: ${FILTER_HELP}. Filtered ranges are limited to 90 days.
Results echo the range, timezone and filters used. Revenue is in the currency's smallest unit (cents), times are Unix milliseconds, rates are fractions (0.42 = 42%) and durations are milliseconds.`;

const domain = z.string().describe("The site's domain, as list_sites returns it, e.g. example.com");
const range = z.string().optional().describe(`Optional; ${RANGE_HELP}. Default 7d`);
const filters = z.string().optional().describe(`Optional; ${FILTER_HELP}`);
const offset = z.number().int().min(0).optional().describe("Row to start from, in steps of 50. Default 0");
const dims = dimValidator.members.map((m) => m.value) as [string, ...string[]];

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

type Key = { secret: string; keyHash: string };

/** A fresh server for one request, bound to the caller's key hash (checked by the route). */
export function buildServer(keyHash: string, secret: string): McpServer {
  const server = new McpServer({ name: "analytics", version: "1.0.0" }, { instructions: INSTRUCTIONS });

  // Runs one mcp.* query and turns its result, or its ConvexError, into a tool result
  async function run<Args extends Key>(
    fn: FunctionReference<"query", "public", Args>,
    args: Omit<Args, keyof Key>,
  ): Promise<CallToolResult> {
    try {
      const result: unknown = await convex.query(fn as FunctionReference<"query">, { ...args, secret, keyHash });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      if (error instanceof ConvexError) {
        return { content: [{ type: "text", text: String(error.data) }], isError: true };
      }
      console.error("[mcp]", error);
      return { content: [{ type: "text", text: "Could not read the stats" }], isError: true };
    }
  }
  // Queries can't read the clock, so each call passes it
  const now = () => Date.now();

  server.registerTool(
    "list_sites",
    {
      title: "List sites",
      description:
        "The owner's sites: domain, timezone, whether it has visitor ids (needed for filters, sessions and visitors), its currency when it takes payments, and its key goal.",
      annotations: readOnly,
    },
    () => run(api.mcp.sites, {}),
  );

  server.registerTool(
    "get_summary",
    {
      title: "Summary",
      description:
        "The Analytics tiles for a range and the equal-length range before it: visitors, pageviews, sessions, bounce rate, time on page, session time, revenue and payments; converted visitors (paying ones on a site with revenue, otherwise key-goal ones) and the key goal's completions. `comparable` is false when visitor tracking started inside the comparison window.",
      inputSchema: z.object({ domain, range, filters }),
      annotations: readOnly,
    },
    (args) => run(api.mcp.summary, { ...args, now: now() }),
  );

  server.registerTool(
    "get_timeseries",
    {
      title: "Timeseries",
      description:
        "The dashboard chart: one point per day (per hour for today, yesterday and 24h) with visitors, pageviews, bounce rate, session time and time on page, plus revenue, key-goal completions and conversion rate where the site has them.",
      inputSchema: z.object({ domain, range, filters }),
      annotations: readOnly,
    },
    (args) => run(api.mcp.timeseries, { ...args, now: now() }),
  );

  server.registerTool(
    "get_breakdown",
    {
      title: "Breakdown",
      description:
        "One of the dashboard's lists, top rows first: page, entry, exit, referrer, source, channel, utm_*, ref, country, region (\"US/CA\"), city (\"US/CA/San Francisco\"), device, browser, os, goal or outbound. Each row has visitors, pageviews, sessions, events (goal completions or outbound clicks) and revenue. Ranked by the list's own count unless `metric` is given, as the cards' metric toggle does.",
      inputSchema: z.object({
        domain,
        dim: z.enum(dims).describe("The list"),
        range,
        filters,
        metric: z
          .enum(["visitors", "pageviews", "revenue"])
          .optional()
          .describe("Rank by this, as the cards do; lists without it use their own count"),
        channel: z.literal("AI").optional().describe("Sources only: keep AI sources (the AI tab)"),
        limit: z.number().int().min(1).max(100).optional().describe("Rows to return, 1 to 100. Default 20"),
      }),
      annotations: readOnly,
    },
    (args) => run(api.mcp.breakdown, { ...args, dim: args.dim as Dim, now: now() }),
  );

  server.registerTool(
    "get_pages",
    {
      title: "Pages",
      description:
        "The Pages table, 50 rows at a time: each page's title, views, sessions (and change), bounce rate (on sessions that started there), average engaged time and revenue, plus the tab's tiles. Search matches paths and titles.",
      inputSchema: z.object({
        domain,
        range,
        filters,
        sort: z.enum(PAGE_SORTS).optional().describe("Column to sort by. Default views"),
        desc: z.boolean().optional().describe("Largest first. Default true"),
        search: z.string().optional().describe("Keep pages whose path or title contains this"),
        offset,
      }),
      annotations: readOnly,
    },
    (args) => run(api.mcp.pages, { ...args, now: now() }),
  );

  server.registerTool(
    "get_visitors",
    {
      title: "Visitors",
      description:
        "The Users table, 50 rows at a time: visitors seen in the range, latest first, with name or email when known, location, device, browser, first source, entry and exit pages, and lifetime sessions, pageviews, engaged time and revenue. `kind: customers` keeps paying (or key-goal) visitors. Search matches names, emails, ids, countries, cities and pages. Not filtered.",
      inputSchema: z.object({
        domain,
        range,
        kind: z.enum(["all", "customers"]).optional().describe("Default all"),
        search: z.string().optional(),
        offset,
      }),
      annotations: readOnly,
    },
    (args) => run(api.mcp.visitors, { ...args, now: now() }),
  );

  server.registerTool(
    "get_visitor_journey",
    {
      title: "Visitor journey",
      description:
        "One visitor's profile and journey (the visitor drawer): who they are, lifetime totals, how their first visit arrived, and their latest 50 sessions with source, location, device and every pageview, goal, outbound click and payment. visitorId comes from get_visitors or get_live.",
      inputSchema: z.object({ domain, visitorId: z.string().describe("The visitor id") }),
      annotations: readOnly,
    },
    (args) => run(api.mcp.journey, { ...args, now: now() }),
  );

  server.registerTool(
    "get_live",
    {
      title: "Live",
      description:
        "The Live tab: how many visitors are online now (a pageview or ping in the last 5 minutes), who they are and which page they're on, and the latest pageviews, goals and payments of the last 24 hours.",
      inputSchema: z.object({ domain }),
      annotations: readOnly,
    },
    (args) => run(api.mcp.live, { ...args, now: now() }),
  );

  return server;
}
