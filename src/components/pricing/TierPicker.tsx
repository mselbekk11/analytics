"use client";

import { useState, type ReactNode } from "react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CONTACT_EMAIL, pricing } from "@/components/home/content";
import {
  formatEvents,
  type Interval,
  STEPS,
  stepLabel,
  stepValueText,
  type Tier,
  tierAt,
  tierPrice,
} from "@/lib/pricing";

const ITEM = "rounded-md! px-3 text-[13px] text-muted-foreground data-pressed:text-foreground";

/**
 * The one-plan pricing card (launch v1 Phase 4): a Monthly | Yearly toggle, a slider over
 * the event tiers plus "10M+", the price, and one button. The homepage passes "Start free
 * trial", /billing "Subscribe". The last step swaps the price for "Get in touch".
 */
export default function TierPicker({
  initialStep = 0,
  initialInterval = "month",
  action,
  className,
}: {
  initialStep?: number;
  initialInterval?: Interval;
  /** The button for a tier, e.g. a sign-up link or a Subscribe button. */
  action: (tier: Tier, interval: Interval) => ReactNode;
  className?: string;
}) {
  const [step, setStep] = useState(Math.min(Math.max(0, initialStep), STEPS - 1));
  const [interval, setPeriod] = useState<Interval>(initialInterval);
  const tier = tierAt(step);
  const price = tier === null ? null : tierPrice(tier, interval);

  return (
    <div className={cn("rounded-xl border border-line p-5 sm:p-6", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          value={[interval]}
          onValueChange={(value) => {
            // Clicking the pressed one again reports an empty value; keep it
            const next = value[0] as Interval | undefined;
            if (next) setPeriod(next);
          }}
          spacing={0}
          size="sm"
          aria-label="Billing period"
          className="rounded-lg border border-line p-0.5"
        >
          <ToggleGroupItem value="month" className={ITEM}>
            {pricing.monthly}
          </ToggleGroupItem>
          <ToggleGroupItem value="year" className={ITEM}>
            {pricing.yearly}
            <span className="ml-1.5 rounded-sm bg-muted px-1.5 py-px text-[11px] font-medium text-foreground">
              {pricing.yearlyNote}
            </span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-[32px] leading-none font-semibold tracking-tight tabular-nums">{stepLabel(step)}</p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {tier === null ? pricing.contact.heading : `${formatEvents(tier.events)} ${pricing.eventsLabel}`}
          </p>
        </div>
        {price !== null && (
          <div className="text-right" aria-live="polite">
            <p className="flex items-baseline justify-end gap-1.5">
              <span className="text-[32px] leading-none font-semibold tracking-tight tabular-nums">{price.amount}</span>
              <span className="text-[13px] text-muted-foreground">{price.unit}</span>
            </p>
            <p className="mt-2 text-[13px] text-muted-foreground">{price.note}</p>
          </div>
        )}
      </div>

      <div className="mt-8">
        <Slider
          value={step}
          onValueChange={(value) => setStep(Array.isArray(value) ? value[0] : value)}
          min={0}
          max={STEPS - 1}
          step={1}
          getAriaLabel={() => "Events a month"}
          getAriaValueText={(_formatted, value) => stepValueText(value)}
          className="[&_[data-slot=slider-thumb]]:size-4 [&_[data-slot=slider-track]]:h-1.5"
        />
        <ol aria-hidden className="mt-3 flex justify-between text-[11px] text-muted-foreground tabular-nums">
          {Array.from({ length: STEPS }, (_, i) => (
            <li key={i}>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setStep(i)}
                className={cn("transition-colors hover:text-foreground", i === step && "font-medium text-foreground")}
              >
                {stepLabel(i)}
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-8 border-t border-line pt-5">
        {tier === null ? (
          <>
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("More than 10M events")}`}
              className={buttonVariants({ size: "lg", className: "w-full" })}
            >
              {pricing.contact.cta}
            </a>
            <p className="mt-3 text-center text-[13px] text-muted-foreground">{pricing.contact.note}</p>
          </>
        ) : (
          action(tier, interval)
        )}
      </div>
    </div>
  );
}
