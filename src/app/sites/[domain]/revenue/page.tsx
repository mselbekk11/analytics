import { Suspense } from "react";
import ComingSoon from "@/components/dashboard/ComingSoon";

// Built in launch v1 Phase 10; client component inside Suspense (Cache Components).
export default function RevenuePage() {
  return (
    <Suspense>
      <ComingSoon
        section="revenue"
        title="Revenue"
        text="The Revenue tab is coming soon. Until then, revenue is on the Analytics tiles and the cards' Revenue metric."
      />
    </Suspense>
  );
}
