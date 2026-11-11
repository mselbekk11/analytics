import { TIERS, type Interval, type Tier } from "../../convex/lib/tiers";

export { TIERS, fittingTierIndex, tierByEvents, type Interval, type Tier } from "../../convex/lib/tiers";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const count = new Intl.NumberFormat("en-US");

/** "$5", "$390". */
export function formatPrice(dollars: number): string {
  return usd.format(dollars);
}

/** "500,000". */
export function formatEvents(n: number): string {
  return count.format(n);
}

/** The slider's steps: each tier, then "10M+" (Get in touch). */
export const STEPS = TIERS.length + 1;

/** The tier at a slider step, or null on the last step ("Get in touch"). */
export function tierAt(step: number): Tier | null {
  return TIERS[step] ?? null;
}

/** "500k" … "10M", and "10M+" past the last tier. */
export function stepLabel(step: number): string {
  return tierAt(step)?.label ?? `${TIERS[TIERS.length - 1].label}+`;
}

/**
 * The big number, its unit and the line under it:
 * month "$8" "/ month" "or $80 a year, 2 months free", year "$80" "/ year" "$6.67 a month".
 */
export function tierPrice(tier: Tier, interval: Interval): { amount: string; unit: string; note: string } {
  if (interval === "month") {
    return {
      amount: formatPrice(tier.monthly),
      unit: "/ month",
      note: `or ${formatPrice(tier.yearly)} a year, 2 months free`,
    };
  }
  const perMonth = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(tier.yearly / 12);
  return { amount: formatPrice(tier.yearly), unit: "/ year", note: `${perMonth} a month, billed yearly` };
}

/** "1,000,000 events / month", read out by the slider for screen readers. */
export function stepValueText(step: number): string {
  const tier = tierAt(step);
  return tier === null ? `More than ${formatEvents(TIERS[TIERS.length - 1].events)} events a month` : `${formatEvents(tier.events)} events a month`;
}
