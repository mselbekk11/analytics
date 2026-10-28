import { Suspense } from "react";
import VisitorProfile from "@/components/customers/VisitorProfile";

// Client component that reads the domain and visitor id from the URL, so it renders inside Suspense.
export default function VisitorPage() {
  return (
    <Suspense>
      <VisitorProfile />
    </Suspense>
  );
}
