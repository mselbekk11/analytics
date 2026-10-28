// Turns world-atlas's 110m country outlines into SVG paths keyed by ISO alpha-2 code,
// for the dashboard's Map tab. Run with `npm run build:world-map`; the output is committed.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { feature } from "topojson-client";
import { geoEqualEarth, geoPath } from "d3-geo";
import countries from "i18n-iso-countries";

const require = createRequire(import.meta.url);
const topology = JSON.parse(readFileSync(require.resolve("world-atlas/countries-110m.json"), "utf8"));
// Outlines without a numeric code in world-atlas
const BY_NAME = { Kosovo: "XK", "N. Cyprus": "CY", Somaliland: "SO" };

const world = feature(topology, topology.objects.countries);
world.features = world.features.filter((f) => f.properties.name !== "Antarctica");

const width = 960;
const projection = geoEqualEarth().fitWidth(width, world);
const path = geoPath(projection).digits(1);
const [[, y0], [, y1]] = path.bounds(world);
const height = Math.ceil(y1 - y0);
projection.translate([projection.translate()[0], projection.translate()[1] - y0]);

const byCode = new Map();
for (const f of world.features) {
  const code = BY_NAME[f.properties.name] ?? (f.id ? countries.numericToAlpha2(f.id) : undefined);
  if (!code) throw new Error(`No code for ${f.properties.name} (${f.id})`);
  const d = path(f);
  if (!d) continue;
  // Northern Cyprus and Somaliland join the country Vercel's geo headers report for them
  byCode.set(code, (byCode.get(code) ?? "") + d);
}

const out = {
  width,
  height,
  countries: [...byCode].sort(([a], [b]) => a.localeCompare(b)).map(([code, d]) => ({ code, d })),
};
writeFileSync("src/components/dashboard/world-110m.json", JSON.stringify(out) + "\n");
console.log(`${out.countries.length} countries, ${width}x${height}, ${JSON.stringify(out).length} bytes`);
