import type { Doc } from "../_generated/dataModel";
import { persona } from "./names";

// The Users tab's search (design v4): a visitor matches when the text is part of its
// name as the table shows it (identify() name, email or animal), its id, its latest
// country's English name or city, or its latest entry or exit page, or is its country's
// code ("de"; a code alone would match "/about-us" and the like as part of a word).

let regionNames: Intl.DisplayNames | null = null;

function countryName(code: string): string {
  try {
    regionNames ??= new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export function visitorMatches(visitor: Doc<"visitors">, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (needle === "") return true;
  const country = visitor.country;
  const fields = [
    visitor.name,
    visitor.email,
    persona(visitor.visitorId).name,
    visitor.visitorId,
    country !== undefined && /^[A-Z]{2}$/.test(country) ? countryName(country) : undefined,
    visitor.city,
    visitor.entryPath,
    visitor.exitPath,
  ];
  if (country !== undefined && country.toLowerCase() === needle) return true;
  return fields.some((f) => f !== undefined && f.toLowerCase().includes(needle));
}
