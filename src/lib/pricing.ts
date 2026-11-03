/** How a price is shown: per month, or per year paid up front. */
export type Billing = "monthly" | "yearly";

/** One plan. Prices are whole dollars; every plan has every feature, only the volume differs. */
export type Plan = {
  name: string;
  audience: string; // one line under the name
  monthly: number; // $ a month, billed monthly
  yearly: number; // $ a year, billed yearly
  events: number; // a month
  popular?: boolean;
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const count = new Intl.NumberFormat("en-US");

/** "$5", "$179". */
export function formatPrice(dollars: number): string {
  return usd.format(dollars);
}

/** "500,000". */
export function formatEvents(n: number): string {
  return count.format(n);
}

/** The share of twelve monthly payments saved by paying yearly, in percent (28.125 for $8 vs $69). */
export function yearlySaving(plan: Pick<Plan, "monthly" | "yearly">): number {
  const twelve = plan.monthly * 12;
  return twelve > 0 ? ((twelve - plan.yearly) / twelve) * 100 : 0;
}

/** The best yearly saving across the plans, rounded down so "save up to N%" never overstates it. */
export function maxYearlySaving(plans: Pick<Plan, "monthly" | "yearly">[]): number {
  return Math.floor(Math.max(0, ...plans.map(yearlySaving)));
}

/**
 * The big number, its unit and the line under it for a plan:
 * monthly "$5" "/ month" "or $49 billed yearly", yearly "$49" "/ year" "or $5 / month billed monthly".
 */
export function planPrice(plan: Plan, billing: Billing): { amount: string; unit: string; note: string } {
  return billing === "monthly"
    ? { amount: formatPrice(plan.monthly), unit: "/ month", note: `or ${formatPrice(plan.yearly)} billed yearly` }
    : { amount: formatPrice(plan.yearly), unit: "/ year", note: `or ${formatPrice(plan.monthly)} / month billed monthly` };
}
