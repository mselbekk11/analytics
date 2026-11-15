import { clerkUserId } from "./insights";

// The account owner's email for insight emails (launch v1 Phase 15). There is no users
// table (Clerk is the user list) and a cron has no signed-in identity, so the send asks
// Clerk's Backend API for the user by the id in `ownerId` (identity.tokenIdentifier is
// "<issuer>|<user id>"), with CLERK_SECRET_KEY of the instance that issued it: the dev
// instance's key on Convex dev, the production one on Convex prod.

type ClerkUser = {
  primary_email_address_id: string | null;
  email_addresses: { id: string; email_address: string }[];
};

/** The primary email address of the Clerk user behind `ownerId`, or null when there's none. */
export async function ownerEmail(ownerId: string): Promise<string | null> {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) throw new Error("CLERK_SECRET_KEY is not set");
  const userId = clerkUserId(ownerId);
  if (userId === null) return null;
  const res = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Clerk answered ${res.status} for the account owner`);
  const user = (await res.json()) as ClerkUser;
  const primary = user.email_addresses.find((e) => e.id === user.primary_email_address_id);
  return primary?.email_address ?? null;
}
