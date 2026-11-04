"use client";

import { ReactNode, useEffect } from "react";
import { Authenticated, ConvexReactClient, useMutation } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";

if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
  throw new Error("Missing NEXT_PUBLIC_CONVEX_URL in your .env file");
}

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL);

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <Authenticated>
        <EnsureAccount />
      </Authenticated>
      {children}
    </ConvexProviderWithClerk>
  );
}

/**
 * Makes the signed-in user's account (and 7-day trial) on their first page load, and
 * locks a trial whose end has passed. Idempotent, so it runs once per page load.
 */
function EnsureAccount() {
  const ensure = useMutation(api.accounts.ensure);
  useEffect(() => {
    ensure().catch((error) => console.error("[accounts.ensure]", error));
  }, [ensure]);
  return null;
}
