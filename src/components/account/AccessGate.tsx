"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { Lock } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * A site view's stats, or the "Pick a plan to continue" screen when the account is
 * locked (launch v1 Phase 3). The server refuses the stats queries anyway; this keeps
 * the page from asking. Waits while accounts.ensure makes a new user's account.
 */
export default function AccessGate({ children }: { children: ReactNode }) {
  const account = useQuery(api.accounts.me);
  if (account == null) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (account.access === "locked") return <Paywall />;
  return children;
}

function Paywall() {
  return (
    <Card className="mx-auto mt-10 w-full max-w-md text-center">
      <CardHeader className="items-center gap-2">
        <div className="mx-auto mb-2 flex size-9 items-center justify-center rounded-lg bg-muted">
          <Lock aria-hidden className="size-4 text-muted-foreground" />
        </div>
        <CardTitle>Pick a plan to continue</CardTitle>
        <CardDescription>
          Your free trial has ended. Your sites are still collecting data, so nothing is lost: pick a plan to see it
          again.
        </CardDescription>
        <Button className="mx-auto mt-4" render={<Link href="/billing" />} nativeButton={false}>
          Pick a plan
        </Button>
      </CardHeader>
    </Card>
  );
}
