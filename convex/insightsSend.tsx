"use node";

import { Resend } from "@convex-dev/resend";
import { render } from "@react-email/render";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, type ActionCtx } from "./_generated/server";
import InsightEmail, { insightSubject, type InsightSite } from "./emails/InsightEmail";
import { ownerEmail } from "./lib/clerk";
import { localDate } from "./lib/dates";
import { cadenceValidator, recipientAllowed, signUnsubscribe, unsubscribeSecret, type Cadence } from "./lib/insights";

// Renders and sends one account's insight email (launch v1 Phase 15). A Node action
// because React Email's render needs Node. The cron fan-out and the numbers are in
// insights.ts.

// testMode would only deliver to Resend's test addresses
export const resend: Resend = new Resend(components.resend, { testMode: false });

const DEFAULT_FROM = "Simple Stats <insights@mail.simplestats.ai>";

const resultValidator = v.object({
  status: v.union(
    v.literal("sent"),
    v.literal("no_account"),
    v.literal("opted_out"),
    v.literal("locked"),
    v.literal("no_activity"),
    v.literal("no_email"),
    v.literal("not_allowed"),
  ),
  sites: v.number(),
  emailId: v.optional(v.string()), // the Resend component's id, when sent
});
type Result = typeof resultValidator.type;

async function send(
  ctx: ActionCtx,
  args: { accountId: string; cadence: Cadence; now: number; force?: boolean },
): Promise<Result> {
  const account = await ctx.runQuery(internal.insights.accountForSend, {
    accountId: args.accountId,
    cadence: args.cadence,
  });
  if (account.skip !== null) return { status: account.skip, sites: 0 };

  const sites: InsightSite[] = [];
  for (const siteId of account.siteIds) {
    try {
      const site = await ctx.runQuery(internal.insights.siteInsight, { siteId, cadence: args.cadence, now: args.now });
      if (site !== null) sites.push(site);
    } catch (error) {
      // One site past the read limits shouldn't stop the others
      console.error(`insights: skipped site ${siteId} for ${args.accountId}`, error);
    }
  }
  if (sites.length === 0) return { status: "no_activity", sites: 0 };
  sites.sort((a, b) => b.visitors.current - a.visitors.current || a.domain.localeCompare(b.domain));

  const to = await ownerEmail(account.ownerId);
  if (to === null) return { status: "no_email", sites: sites.length };
  if (!recipientAllowed(to, process.env.INSIGHT_EMAILS_ONLY_TO)) {
    console.log(`insights: ${args.cadence} for ${args.accountId} not sent, recipient not in INSIGHT_EMAILS_ONLY_TO`);
    return { status: "not_allowed", sites: sites.length };
  }

  const token = await signUnsubscribe(unsubscribeSecret(), args.accountId, args.cadence);
  const siteUrl = process.env.CONVEX_SITE_URL;
  if (!siteUrl) throw new Error("CONVEX_SITE_URL is not set");
  const unsubscribeUrl = `${siteUrl}/email/unsubscribe?t=${encodeURIComponent(token)}`;
  const appUrl = process.env.APP_URL ?? "https://www.simplestats.ai";

  const email = <InsightEmail cadence={args.cadence} sites={sites} appUrl={appUrl} unsubscribeUrl={unsubscribeUrl} />;
  const emailId = await resend.sendEmail(ctx, {
    from: process.env.INSIGHT_EMAILS_FROM || DEFAULT_FROM,
    to,
    subject: insightSubject(args.cadence, sites),
    html: await render(email),
    text: await render(email, { plainText: true }),
    headers: [
      { name: "List-Unsubscribe", value: `<${unsubscribeUrl}>` },
      { name: "List-Unsubscribe-Post", value: "List-Unsubscribe=One-Click" },
    ],
    // One email per account, cadence and cron run (a retried or repeated run collapses to it)
    idempotencyKey: args.force ? undefined : `insights:${args.accountId}:${args.cadence}:${localDate(args.now, "UTC")}`,
  });
  return { status: "sent", sites: sites.length, emailId };
}

/** Scheduled by insights.startCadence, one per account. */
export const sendAccount = internalAction({
  args: { accountId: v.id("accounts"), cadence: cadenceValidator, now: v.number() },
  returns: resultValidator,
  handler: async (ctx, args) => await send(ctx, args),
});

/**
 * Sends one account's email now, by hand, with the same checks as the cron (opted in,
 * not locked, activity, INSIGHT_EMAILS_ONLY_TO). `force` skips only the once-a-day
 * dedupe, so it can be sent again:
 * `npx convex run insightsSend:sendNow '{"ownerId": "<tokenIdentifier>", "cadence": "weekly", "force": true}'`.
 */
export const sendNow = internalAction({
  args: { ownerId: v.string(), cadence: cadenceValidator, force: v.optional(v.boolean()) },
  returns: resultValidator,
  handler: async (ctx, args): Promise<Result> => {
    const accountId: Id<"accounts"> | null = await ctx.runQuery(internal.insights.accountIdOf, { ownerId: args.ownerId });
    if (accountId === null) return { status: "no_account", sites: 0 };
    return await send(ctx, { accountId, cadence: args.cadence, now: Date.now(), force: args.force });
  },
});
