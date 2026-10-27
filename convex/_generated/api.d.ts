/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ingest from "../ingest.js";
import type * as lib_attribution from "../lib/attribution.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_dates from "../lib/dates.js";
import type * as lib_dims from "../lib/dims.js";
import type * as lib_domain from "../lib/domain.js";
import type * as lib_geo from "../lib/geo.js";
import type * as lib_ranges from "../lib/ranges.js";
import type * as lib_rollups from "../lib/rollups.js";
import type * as lib_sources from "../lib/sources.js";
import type * as me from "../me.js";
import type * as migrations from "../migrations.js";
import type * as sites from "../sites.js";
import type * as stats from "../stats.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ingest: typeof ingest;
  "lib/attribution": typeof lib_attribution;
  "lib/auth": typeof lib_auth;
  "lib/dates": typeof lib_dates;
  "lib/dims": typeof lib_dims;
  "lib/domain": typeof lib_domain;
  "lib/geo": typeof lib_geo;
  "lib/ranges": typeof lib_ranges;
  "lib/rollups": typeof lib_rollups;
  "lib/sources": typeof lib_sources;
  me: typeof me;
  migrations: typeof migrations;
  sites: typeof sites;
  stats: typeof stats;
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
