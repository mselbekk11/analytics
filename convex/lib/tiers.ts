// The event tiers (launch v1 pricing, decided 2026-11-10): one plan with every feature,
// priced by monthly events. This list drives the homepage slider, /billing, the Stripe
// prices (scripts/stripe-setup.mjs) and the checkout action, so it is the only place a
// price is written down. Above the last tier is "Get in touch".

export type Interval = "month" | "year";

export type Tier = {
  events: number; // monthly event limit
  label: string; // "2.5M", shown on the slider
  slug: string; // "2_5m", inside the Stripe lookup key
  monthly: number; // whole dollars a month, billed monthly
  yearly: number; // whole dollars a year, billed yearly (10× monthly, "2 months free")
};

export const TIERS: readonly Tier[] = [
  { events: 500_000, label: "500k", slug: "500k", monthly: 5, yearly: 50 },
  { events: 1_000_000, label: "1M", slug: "1m", monthly: 8, yearly: 80 },
  { events: 2_500_000, label: "2.5M", slug: "2_5m", monthly: 15, yearly: 150 },
  { events: 5_000_000, label: "5M", slug: "5m", monthly: 25, yearly: 250 },
  { events: 10_000_000, label: "10M", slug: "10m", monthly: 39, yearly: 390 },
];

export const PRODUCT_NAME = "Simple Stats";

/** The Stripe Price lookup key for a tier and interval: "events_1m_year". */
export function lookupKey(tier: Pick<Tier, "slug">, interval: Interval): string {
  return `events_${tier.slug}_${interval}`;
}

export function tierByEvents(events: number): Tier | null {
  return TIERS.find((t) => t.events === events) ?? null;
}

/**
 * The index of the smallest tier that fits `events` a month, or TIERS.length (the
 * "Get in touch" step) above the largest. No traffic yet is the first tier.
 */
export function fittingTierIndex(events: number): number {
  const i = TIERS.findIndex((t) => events <= t.events);
  return i === -1 ? TIERS.length : i;
}

export type StripePrice = {
  lookupKey: string;
  unitAmount: number; // cents
  interval: Interval;
  events: number;
  nickname: string;
};

/** The 10 Stripe Prices on the one product, as scripts/stripe-setup.mjs creates them. */
export function stripePrices(): StripePrice[] {
  return TIERS.flatMap((tier) =>
    (["month", "year"] as const).map((interval) => ({
      lookupKey: lookupKey(tier, interval),
      unitAmount: (interval === "month" ? tier.monthly : tier.yearly) * 100,
      interval,
      events: tier.events,
      nickname: `${tier.label} events, ${interval === "month" ? "monthly" : "yearly"}`,
    })),
  );
}
