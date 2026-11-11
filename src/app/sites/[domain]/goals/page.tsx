import { Suspense } from "react";
import GoalsView from "@/components/goals/GoalsView";

// Client component that reads the domain, ?range= and ?f= from the URL, so it renders inside Suspense.
export default function GoalsPage() {
  return (
    <Suspense>
      <GoalsView />
    </Suspense>
  );
}
