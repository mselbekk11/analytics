/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounts from "../accounts.js";
import type * as apiKeys from "../apiKeys.js";
import type * as billing from "../billing.js";
import type * as goals from "../goals.js";
import type * as http from "../http.js";
import type * as ingest from "../ingest.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_attribution from "../lib/attribution.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_billing from "../lib/billing.js";
import type * as lib_dates from "../lib/dates.js";
import type * as lib_dims from "../lib/dims.js";
import type * as lib_domain from "../lib/domain.js";
import type * as lib_filtered from "../lib/filtered.js";
import type * as lib_filters from "../lib/filters.js";
import type * as lib_geo from "../lib/geo.js";
import type * as lib_goals from "../lib/goals.js";
import type * as lib_keys from "../lib/keys.js";
import type * as lib_mcp from "../lib/mcp.js";
import type * as lib_names from "../lib/names.js";
import type * as lib_outbound from "../lib/outbound.js";
import type * as lib_pages from "../lib/pages.js";
import type * as lib_paths from "../lib/paths.js";
import type * as lib_ranges from "../lib/ranges.js";
import type * as lib_revenue from "../lib/revenue.js";
import type * as lib_rollups from "../lib/rollups.js";
import type * as lib_secret from "../lib/secret.js";
import type * as lib_sources from "../lib/sources.js";
import type * as lib_statsShapes from "../lib/statsShapes.js";
import type * as lib_stripe from "../lib/stripe.js";
import type * as lib_stripeApi from "../lib/stripeApi.js";
import type * as lib_tiers from "../lib/tiers.js";
import type * as lib_usage from "../lib/usage.js";
import type * as lib_visitors from "../lib/visitors.js";
import type * as mcp from "../mcp.js";
import type * as me from "../me.js";
import type * as migrations from "../migrations.js";
import type * as outbound from "../outbound.js";
import type * as pages from "../pages.js";
import type * as payments from "../payments.js";
import type * as sites from "../sites.js";
import type * as stats from "../stats.js";
import type * as visitors from "../visitors.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accounts: typeof accounts;
  apiKeys: typeof apiKeys;
  billing: typeof billing;
  goals: typeof goals;
  http: typeof http;
  ingest: typeof ingest;
  "lib/access": typeof lib_access;
  "lib/attribution": typeof lib_attribution;
  "lib/auth": typeof lib_auth;
  "lib/billing": typeof lib_billing;
  "lib/dates": typeof lib_dates;
  "lib/dims": typeof lib_dims;
  "lib/domain": typeof lib_domain;
  "lib/filtered": typeof lib_filtered;
  "lib/filters": typeof lib_filters;
  "lib/geo": typeof lib_geo;
  "lib/goals": typeof lib_goals;
  "lib/keys": typeof lib_keys;
  "lib/mcp": typeof lib_mcp;
  "lib/names": typeof lib_names;
  "lib/outbound": typeof lib_outbound;
  "lib/pages": typeof lib_pages;
  "lib/paths": typeof lib_paths;
  "lib/ranges": typeof lib_ranges;
  "lib/revenue": typeof lib_revenue;
  "lib/rollups": typeof lib_rollups;
  "lib/secret": typeof lib_secret;
  "lib/sources": typeof lib_sources;
  "lib/statsShapes": typeof lib_statsShapes;
  "lib/stripe": typeof lib_stripe;
  "lib/stripeApi": typeof lib_stripeApi;
  "lib/tiers": typeof lib_tiers;
  "lib/usage": typeof lib_usage;
  "lib/visitors": typeof lib_visitors;
  mcp: typeof mcp;
  me: typeof me;
  migrations: typeof migrations;
  outbound: typeof outbound;
  pages: typeof pages;
  payments: typeof payments;
  sites: typeof sites;
  stats: typeof stats;
  visitors: typeof visitors;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
