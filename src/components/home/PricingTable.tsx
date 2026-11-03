"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type Billing, formatEvents, maxYearlySaving, planPrice } from "@/lib/pricing";
import { pricing, SIGN_IN } from "./content";

const ITEM = "rounded-md! px-3 text-[13px] text-muted-foreground data-pressed:text-foreground";

// Worked out from the plans, so it can't drift from the prices
const SAVING = maxYearlySaving(pricing.plans);

/**
 * The Monthly | Yearly toggle over the three plans, joined in one frame (stacked on
 * phones). Growth is shaded and its button filled; every button goes to sign-in.
 */
export default function PricingTable() {
  const [billing, setBilling] = useState<Billing>("monthly");

  return (
    <div>
      <ToggleGroup
        value={[billing]}
        onValueChange={(value) => {
          // Clicking the pressed one again reports an empty value; keep it
          const next = value[0] as Billing | undefined;
          if (next) setBilling(next);
        }}
        spacing={0}
        size="sm"
        aria-label="Billing period"
        className="rounded-lg border border-line p-0.5"
      >
        <ToggleGroupItem value="monthly" className={ITEM}>
          {pricing.monthly}
        </ToggleGroupItem>
        <ToggleGroupItem value="yearly" className={ITEM}>
          {pricing.yearly} {SAVING}%
        </ToggleGroupItem>
      </ToggleGroup>
      <ul className="mt-4 grid divide-y divide-line overflow-hidden rounded-xl border border-line md:grid-cols-3 md:divide-x md:divide-y-0">
        {pricing.plans.map((plan) => {
          const price = planPrice(plan, billing);
          const popular = plan.popular;
          return (
            <li key={plan.name} className={cn("flex flex-col p-5", popular && "bg-muted/50")}>
              <div className="flex h-5 items-center justify-between gap-2">
                <h3 className="text-[15px] font-semibold">{plan.name}</h3>
                {popular && <Badge className="h-[18px] rounded-sm px-1.5 text-[11px]">{pricing.popular}</Badge>}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{plan.audience}</p>
              <p className="mt-6 flex items-baseline gap-1.5">
                <span className="text-[32px] leading-none font-semibold tracking-tight tabular-nums">
                  {price.amount}
                </span>
                <span className="text-[13px] text-muted-foreground">{price.unit}</span>
              </p>
              <p className="mt-2 text-[13px] text-muted-foreground">{price.note}</p>
              <p className="mt-6 flex items-center justify-between border-t border-line pt-4 text-[13px]">
                <span className="text-muted-foreground">{pricing.eventsLabel}</span>
                <span className="font-medium tabular-nums">{formatEvents(plan.events)}</span>
              </p>
              <Link
                href={SIGN_IN}
                className={buttonVariants({
                  variant: popular ? "default" : "outline",
                  size: "lg",
                  className: "mt-5 w-full",
                })}
              >
                {pricing.choose} {plan.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
