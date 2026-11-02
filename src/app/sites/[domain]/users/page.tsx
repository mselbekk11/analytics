import { Suspense } from "react";
import UsersView from "@/components/users/UsersView";

// Client component that reads the domain, ?range= and ?kind= from the URL, so it renders inside Suspense.
export default function UsersPage() {
  return (
    <Suspense>
      <UsersView />
    </Suspense>
  );
}
