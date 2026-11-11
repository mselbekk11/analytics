import { Suspense } from "react";
import OutboundView from "@/components/outbound/OutboundView";

// Client component that reads the domain, ?range= and ?f= from the URL, so it renders inside Suspense.
export default function OutboundPage() {
  return (
    <Suspense>
      <OutboundView />
    </Suspense>
  );
}
