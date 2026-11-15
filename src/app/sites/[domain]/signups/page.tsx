import { Suspense } from "react";
import SignupsView from "@/components/signups/SignupsView";

// Client component that reads the domain and ?range= from the URL, so it renders inside Suspense.
export default function SignupsPage() {
  return (
    <Suspense>
      <SignupsView />
    </Suspense>
  );
}
