import { Suspense } from "react";
import SiteDashboard from "@/components/dashboard/SiteDashboard";

// The dashboard is a client component: it reads the domain and ?range= from the URL
// and all data through Convex useQuery, so it renders inside Suspense (Cache Components).
export default function SitePage() {
  return (
    <Suspense>
      <SiteDashboard />
    </Suspense>
  );
}
