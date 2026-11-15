import { cronJobs } from "convex/server";
import { components, internal } from "./_generated/api";
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// Insight emails (launch v1 Phase 15), all UTC. Each finds the accounts that get that
// cadence and schedules one send per account (insights.startCadence).
const crons = cronJobs();

crons.cron("insight emails, daily", "0 7 * * *", internal.insights.startCadence, { cadence: "daily" });
crons.cron("insight emails, weekly (Mondays)", "0 9 * * 1", internal.insights.startCadence, { cadence: "weekly" });
crons.cron("insight emails, monthly (the 1st)", "0 9 1 * *", internal.insights.startCadence, { cadence: "monthly" });

// The Resend component keeps every email it sent (with its HTML) until cleared
crons.cron("clear sent emails", "30 10 * * *", internal.crons.cleanupResend, {});

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const cleanupResend = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, components.resend.lib.cleanupOldEmails, { olderThan: 4 * WEEK_MS });
    await ctx.scheduler.runAfter(0, components.resend.lib.cleanupAbandonedEmails, { olderThan: 4 * WEEK_MS });
    return null;
  },
});

export default crons;
