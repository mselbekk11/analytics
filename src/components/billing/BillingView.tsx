"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Authenticated, useAction, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { format } from "date-fns";
import { CircleCheck, Gift, Loader2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import PageHeader from "@/components/PageHeader";
import TierPicker from "@/components/pricing/TierPicker";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNow } from "@/components/dashboard/useNow";
import { fittingTierIndex, formatEvents, type Interval, type Tier, tierPrice } from "@/lib/pricing";
import { trialDaysLeft } from "@/lib/trial";

// Stripe Checkout only carries a trial over with more than 48 hours left (billing.checkout)
const MIN_TRIAL_LEFT_MS = 49 * 60 * 60 * 1000;
// How long "Finishing up…" waits for the webhook before saying it's slow
const SLOW_MS = 30 * 1000;

/**
 * /billing (launch v1 Phase 4): the tier slider with Subscribe for a trial or a locked
 * account, the tier for a subscribed one, and "Finishing up…" after Checkout until the
 * webhook has written the subscription (accounts.me is reactive, so no polling).
 */
export default function BillingView() {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-10 px-4 pt-10 pb-20 sm:px-6 lg:px-8">
      <PageHeader title="Billing" />
      <div className="flex max-w-2xl flex-col gap-6">
        <Authenticated>
          <BillingBody />
        </Authenticated>
      </div>
    </main>
  );
}

function BillingBody() {
  const account = useQuery(api.accounts.me);
  const success = useSearchParams().get("checkout") === "success";
  const subscribed = account?.access === "active" || account?.access === "past_due";

  let body;
  if (account == null) body = <p className="text-sm text-muted-foreground">Loading…</p>;
  else if (account.access === "comped") body = <Comped />;
  else if (subscribed) body = <Subscribed events={account.events} interval={account.interval} justPaid={success} />;
  else if (success) body = <FinishingUp />;
  else body = <Choose trialing={account.access === "trialing"} trialEndsAt={account.trialEndsAt} />;

  return body;
}

function Choose({ trialing, trialEndsAt }: { trialing: boolean; trialEndsAt: number }) {
  const now = useNow(60 * 1000);
  // The browser's month; the slider starts on the tier this month's traffic fits
  const [month] = useState(() => new Date().toISOString().slice(0, 7));
  const pageviews = useQuery(api.billing.monthPageviews, { month });
  const checkout = useAction(api.billing.checkout);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const keepsTrial = trialing && trialEndsAt - now > MIN_TRIAL_LEFT_MS;
  const days = trialDaysLeft(trialEndsAt, now);

  async function subscribe(tier: Tier, interval: Interval) {
    setPending(true);
    setError(null);
    try {
      window.location.assign(await checkout({ events: tier.events, interval }));
    } catch (e) {
      setError(e instanceof ConvexError ? String(e.data) : "Couldn't open checkout. Please try again.");
      setPending(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{trialing ? "Pick your plan" : "Pick a plan to continue"}</h2>
        <p className="text-sm text-muted-foreground">
          {trialing
            ? `Your free trial has ${days} ${days === 1 ? "day" : "days"} left. Every tier has every feature; choose how many events you send each month.`
            : "Your free trial has ended. Your sites are still collecting data, so nothing is lost: subscribe to see it again."}
          {pageviews !== undefined && pageviews > 0 && (
            <> This month so far: {formatEvents(pageviews)} pageviews.</>
          )}
        </p>
      </div>
      {pageviews === undefined ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <TierPicker
          initialStep={fittingTierIndex(pageviews)}
          action={(tier, interval) => (
            <>
              <Button size="lg" className="w-full" disabled={pending} onClick={() => subscribe(tier, interval)}>
                {pending && <Loader2 aria-hidden className="animate-spin" />}
                Subscribe · {tierPrice(tier, interval).amount} {tierPrice(tier, interval).unit}
              </Button>
              <p className="mt-3 text-center text-[13px] text-muted-foreground" role={error ? "alert" : undefined}>
                {error ??
                  (keepsTrial
                    ? `You won't be charged until your trial ends on ${format(trialEndsAt, "MMMM d")}.`
                    : "Secure checkout by Stripe.")}
              </p>
            </>
          )}
        />
      )}
    </>
  );
}

function FinishingUp() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(id);
  }, []);
  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-muted">
          <Loader2 aria-hidden className="size-4 animate-spin text-muted-foreground" />
        </div>
        <CardTitle>Finishing up…</CardTitle>
        <CardDescription role="status">
          {slow
            ? "This is taking longer than usual. Your payment went through; your dashboard unlocks as soon as Stripe confirms it. You can leave this page and come back."
            : "Your payment went through. Waiting for Stripe to confirm it, which takes a few seconds."}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

function Subscribed({
  events,
  interval,
  justPaid,
}: {
  events: number | null;
  interval: Interval | null;
  justPaid: boolean;
}) {
  const tier = events === null ? "your plan" : `${formatEvents(events)} events / month`;
  const billed = interval === "year" ? ", billed yearly" : interval === "month" ? ", billed monthly" : "";
  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-muted">
          <CircleCheck aria-hidden className="size-4 text-muted-foreground" />
        </div>
        <CardTitle>{justPaid ? "You're all set" : "You're subscribed"}</CardTitle>
        <CardDescription>
          You&apos;re on {tier}
          {billed}.
        </CardDescription>
        {justPaid && (
          <Button className="mt-4 w-fit" render={<Link href="/websites" />} nativeButton={false}>
            Go to your websites
          </Button>
        )}
      </CardHeader>
    </Card>
  );
}

function Comped() {
  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-muted">
          <Gift aria-hidden className="size-4 text-muted-foreground" />
        </div>
        <CardTitle>Your account is free</CardTitle>
        <CardDescription>Every feature, no subscription needed.</CardDescription>
      </CardHeader>
    </Card>
  );
}
