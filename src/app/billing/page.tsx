import { Suspense } from "react";
import BillingView from "@/components/billing/BillingView";
import TopBar from "@/components/TopBar";

export default function BillingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <TopBar account="billing" />
      {/* BillingView reads ?checkout=, which needs a Suspense boundary with Cache Components */}
      <Suspense>
        <BillingView />
      </Suspense>
    </div>
  );
}
