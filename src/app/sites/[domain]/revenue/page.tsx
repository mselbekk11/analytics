import { Suspense } from "react";
import RevenueView from "@/components/revenue/RevenueView";

// Client component that reads the domain, ?range= and ?f= from the URL, so it renders inside Suspense.
export default function RevenuePage() {
  return (
    <Suspense>
      <RevenueView />
    </Suspense>
  );
}
