import { Suspense } from "react";
import PagesView from "@/components/pages/PagesView";

// Client component that reads the domain, ?range= and ?f= from the URL, so it renders inside Suspense.
export default function PagesPage() {
  return (
    <Suspense>
      <PagesView />
    </Suspense>
  );
}
