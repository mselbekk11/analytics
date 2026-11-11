"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Authenticated, useAction, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { format } from "date-fns";
import { CircleAlert, CircleCheck, CalendarX, ExternalLink, Gift, Loader2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import PageHeader from "@/components/PageHeader";
import TierPicker from "@/components/pricing/TierPicker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNow } from "@/components/dashboard/useNow";
import { fittingTierIndex, formatEvents, type Interval, type Tier, tierByEvents, tierPrice } from "@/lib/pricing";
import { trialDaysLeft } from "@/lib/trial";

// Stripe Checkout only carries a trial over with more than 48 hours left (billing.checkout)
const MIN_TRIAL_LEFT_MS = 49 * 60 * 60 * 1000;
// How long "Finishing up…" waits for the webhook before saying it's slow
const SLOW_MS = 30 * 1000;

/**
 * /billing (launch v1 Phases 4 and 5): the tier slider with Subscribe for a trial or a
 * locked account; for a subscribed one the tier, interval, status and renewal or end
 * date, the cancelling and payment-failed banners, and Manage subscription (the Stripe
 * portal). "Finishing up…" shows after Checkout until the webhook has written the
 * subscription (accounts.me is reactive, so no polling, and portal changes show too).
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
  else if (subscribed) body = <Subscribed account={account} justPaid={success} />;
  else if (success) body = <FinishingUp />;
  else
    body = (
      <Choose
        trialing={account.access === "trialing"}
        trialEndsAt={account.trialEndsAt}
        lapsed={account.lapsed}
        hasCustomer={account.hasCustomer}
      />
    );

  return body;
}

/**
 * Opens the Stripe customer portal (billing.portal), optionally straight at the card form.
 * The page navigates away on success, so `pending` only resets on an error.
 */
function usePortal() {
  const portal = useAction(api.billing.portal);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function open(flow?: "payment_method_update") {
    setPending(true);
    setError(null);
    try {
      window.location.assign(await portal(flow ? { flow } : {}));
    } catch (e) {
      setError(e instanceof ConvexError ? String(e.data) : "Couldn't open the billing portal. Please try again.");
      setPending(false);
    }
  }
  return { open, pending, error };
}

function Choose({
  trialing,
  trialEndsAt,
  lapsed,
  hasCustomer,
}: {
  trialing: boolean;
  trialEndsAt: number;
  lapsed: boolean;
  hasCustomer: boolean;
}) {
  const now = useNow(60 * 1000);
  // The browser's month; the slider starts on the tier this month's traffic fits
  const [month] = useState(() => new Date().toISOString().slice(0, 7));
  const pageviews = useQuery(api.billing.monthPageviews, { month });
  const checkout = useAction(api.billing.checkout);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const keepsTrial = trialing && trialEndsAt - now > MIN_TRIAL_LEFT_MS;
  const days = trialDaysLeft(trialEndsAt, now);
  const portal = usePortal();

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
            : lapsed
              ? "Your subscription has ended. Your sites are still collecting data, so nothing is lost: subscribe again to see it."
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
      {lapsed && hasCustomer && (
        <p className="text-sm text-muted-foreground">
          Need an old invoice?{" "}
          <button
            type="button"
            className="underline underline-offset-3 hover:text-foreground disabled:opacity-50"
            disabled={portal.pending}
            onClick={() => portal.open()}
          >
            See your billing history
          </button>
          {portal.error && <span role="alert"> {portal.error}</span>}
        </p>
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

type Account = NonNullable<FunctionReturnType<typeof api.accounts.me>>;

const longDate = (ms: number) => format(ms, "MMMM d, yyyy");

/**
 * The subscription: tier and price, status, and the renewal or end date, with a banner
 * when it's cancelling or a payment failed. Everything is changed in the Stripe portal.
 */
function Subscribed({ account, justPaid }: { account: Account; justPaid: boolean }) {
  const portal = usePortal();
  const { events, interval, status, currentPeriodEnd, cancelAt } = account;
  const tier = events === null ? null : tierByEvents(events);
  const pastDue = account.access === "past_due";
  // Checkout carried the free trial over: the first charge is at the trial's end
  const stripeTrial = status === "trialing";

  const title = events === null ? "Your plan" : `${formatEvents(events)} events / month`;
  const price = tier !== null && interval !== null ? tierPrice(tier, interval) : null;
  const badge = pastDue
    ? { label: "Past due", variant: "destructive" as const }
    : cancelAt !== null
      ? { label: "Cancelling", variant: "outline" as const }
      : stripeTrial
        ? { label: "Trial", variant: "secondary" as const }
        : { label: "Active", variant: "secondary" as const };

  let when: string | null = null;
  if (cancelAt !== null) when = `Ends on ${longDate(cancelAt)}`;
  else if (currentPeriodEnd !== null) {
    when = stripeTrial ? `First charge on ${longDate(currentPeriodEnd)}` : `Renews on ${longDate(currentPeriodEnd)}`;
  }

  return (
    <>
      {justPaid && (
        <Alert>
          <CircleCheck aria-hidden />
          <AlertTitle>You&apos;re all set</AlertTitle>
          <AlertDescription>
            Thanks for subscribing. <Link href="/websites">Go to your websites</Link>
          </AlertDescription>
        </Alert>
      )}
      {pastDue && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>Payment failed, update your card</AlertTitle>
          <AlertDescription>
            We couldn&apos;t charge your card for this period. Stripe will try again over the next few days, and your
            dashboard stays open meanwhile. Update your card to settle it now.
          </AlertDescription>
          <Button
            variant="outline"
            size="sm"
            className="col-start-2 mt-2 w-fit"
            disabled={portal.pending}
            onClick={() => portal.open("payment_method_update")}
          >
            Update card
          </Button>
        </Alert>
      )}
      {!pastDue && cancelAt !== null && (
        <Alert>
          <CalendarX aria-hidden />
          <AlertTitle>Cancels on {longDate(cancelAt)}</AlertTitle>
          <AlertDescription>
            You keep full access until then. Your sites keep collecting data afterwards, so you can subscribe again
            any time. Changed your mind? Renew it in Manage subscription.
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{title}</CardTitle>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <CardDescription>
            {[price && `${price.amount} ${price.unit}`, when].filter(Boolean).join(" · ")}
          </CardDescription>
          <div className="mt-4 flex flex-col gap-2">
            <Button className="w-fit" disabled={portal.pending} onClick={() => portal.open()}>
              {portal.pending ? <Loader2 aria-hidden className="animate-spin" /> : <ExternalLink aria-hidden />}
              Manage subscription
            </Button>
            <p className="text-[13px] text-muted-foreground" role={portal.error ? "alert" : undefined}>
              {portal.error ?? "Change your tier or billing interval, update your card, download invoices or cancel."}
            </p>
          </div>
        </CardHeader>
      </Card>
    </>
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
