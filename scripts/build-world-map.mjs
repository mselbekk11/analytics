// Builds the dashboard's dotted world map: a staggered grid of land dots (one SVG path)
// and a centre point per country keyed by ISO alpha-2, both in the same Equal Earth
// projection. Run with `npm run build:world-map`; the output is committed.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { feature } from "topojson-client";
import { geoContains, geoEqualEarth, geoPath } from "d3-geo";
import countries from "i18n-iso-countries";

const require = createRequire(import.meta.url);
const read = (name) => JSON.parse(readFileSync(require.resolve(`world-atlas/${name}`), "utf8"));
const landTopology = read("land-50m.json");
const countryTopology = read("countries-50m.json");
// Outlines without a numeric code in world-atlas. Northern Cyprus and Somaliland join the
// country Vercel's geo headers report for them.
const BY_NAME = { Kosovo: "XK", "N. Cyprus": "CY", Somaliland: "SO" };

const land = feature(landTopology, landTopology.objects.land);
const world = feature(countryTopology, countryTopology.objects.countries);
world.features = world.features.filter((f) => f.properties.name !== "Antarctica");

const width = 960;
const projection = geoEqualEarth().fitWidth(width, world);
const path = geoPath(projection);
const [[, y0], [, y1]] = path.bounds(world);
const height = Math.ceil(y1 - y0);
projection.translate([projection.translate()[0], projection.translate()[1] - y0]);

// Land dots: rows `STEP * √3/2` apart, every other row shifted half a step, so the dots
// sit on a hexagonal grid as in piqo's map. Drawn as zero-length segments with round caps.
const STEP = 7;
const ROW = (STEP * Math.sqrt(3)) / 2;
const round = (n) => Math.round(n * 10) / 10;
let d = "";
let dots = 0;
let last = null;
for (let row = 0, y = ROW / 2; y < height; row++, y += ROW) {
  for (let x = (row % 2 ? STEP : STEP / 2); x < width; x += STEP) {
    const lonLat = projection.invert([x, y]);
    if (!lonLat || lonLat[1] < -60 || !geoContains(land, lonLat)) continue;
    const [px, py] = [round(x), round(y)];
    d += last ? `m${round(px - last[0])} ${round(py - last[1])}h0` : `M${px} ${py}h0`;
    last = [px, py];
    dots++;
  }
}

// Country centres: the centroid of each country's largest piece, so the United States
// sits on the lower 48 and France on the mainland, not between their territories.
const largest = new Map();
for (const f of world.features) {
  const code = BY_NAME[f.properties.name] ?? (f.id ? countries.numericToAlpha2(f.id) : undefined);
  if (!code) {
    console.warn(`Skipped ${f.properties.name} (${f.id}): no ISO code`);
    continue;
  }
  const polygons = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates];
  for (const coordinates of polygons) {
    const piece = { type: "Feature", geometry: { type: "Polygon", coordinates } };
    const area = path.area(piece);
    if (area > (largest.get(code)?.area ?? -1)) largest.set(code, { area, piece });
  }
}
const centres = Object.fromEntries(
  [...largest]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, { piece }]) => [code, path.centroid(piece).map(round)]),
);

const out = { width, height, dotRadius: 2.1, dots: d, centres };
writeFileSync("src/components/dashboard/world-dots.json", JSON.stringify(out) + "\n");
console.log(
  `${dots} dots, ${Object.keys(centres).length} countries, ${width}x${height}, ${JSON.stringify(out).length} bytes`,
);
