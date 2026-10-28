import { Suspense } from "react";
import Live from "@/components/live/Live";

// Client component that reads the domain from the URL, so it renders inside Suspense.
export default function LivePage() {
  return (
    <Suspense>
      <Live />
    </Suspense>
  );
}
