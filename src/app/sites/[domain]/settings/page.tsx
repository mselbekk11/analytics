import { Suspense } from "react";
import SiteSettings from "@/components/settings/SiteSettings";

// Client component that reads the domain from the URL, so it renders inside Suspense.
export default function SiteSettingsPage() {
  return (
    <Suspense>
      <SiteSettings />
    </Suspense>
  );
}
