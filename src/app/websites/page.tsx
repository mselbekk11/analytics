import { Suspense } from "react";
import Websites from "@/components/websites/Websites";

// Client component that reads ?add= from the URL, so it renders inside Suspense.
export default function WebsitesPage() {
  return (
    <Suspense>
      <Websites />
    </Suspense>
  );
}
