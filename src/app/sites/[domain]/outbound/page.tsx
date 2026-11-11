import { Suspense } from "react";
import ComingSoon from "@/components/dashboard/ComingSoon";

// Built in launch v1 Phase 9; client component inside Suspense (Cache Components).
export default function OutboundPage() {
  return (
    <Suspense>
      <ComingSoon
        section="outbound"
        title="Outbound"
        text="The Outbound tab is coming soon. Until then, clicks on links to other sites are under Pages → Outbound on Analytics."
      />
    </Suspense>
  );
}
