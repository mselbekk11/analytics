import { Suspense } from "react";
import FunnelsView from "@/components/funnels/FunnelsView";

// Client component that reads the domain and ?range= from the URL, so it renders inside Suspense.
export default function FunnelsPage() {
  return (
    <Suspense>
      <FunnelsView />
    </Suspense>
  );
}
