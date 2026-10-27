// Region and city keys for dailyDims. Each includes its parents, so two cities with
// the same name in different regions or countries stay separate rows.

const UNKNOWN = "Unknown";

/** "US/CA", or "Unknown" without a region. */
export function regionKey(country: string, region: string | undefined): string {
  return region ? `${country}/${region}` : UNKNOWN;
}

/** "US/CA/San Francisco", or "Unknown" without a city. The region part may be empty. */
export function cityKey(country: string, region: string | undefined, city: string | undefined): string {
  return city ? `${country}/${region ?? ""}/${city}` : UNKNOWN;
}

/** Splits a region or city key back into its parts; null for "Unknown". */
export function parseGeoKey(key: string): { country: string; region: string; city?: string } | null {
  if (key === UNKNOWN) return null;
  const [country, region = "", ...rest] = key.split("/");
  return rest.length > 0 ? { country, region, city: rest.join("/") } : { country, region };
}
