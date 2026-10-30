import { Suspense } from "react";
import AddWebsite from "@/components/websites/AddWebsite";

// Client component that reads ?site= from the URL, so it renders inside Suspense.
export default function NewWebsitePage() {
  return (
    <Suspense>
      <AddWebsite />
    </Suspense>
  );
}
