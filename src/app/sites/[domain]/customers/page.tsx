import { Suspense } from "react";
import Customers from "@/components/customers/Customers";

// Client component that reads the domain and ?by= from the URL, so it renders inside Suspense.
export default function CustomersPage() {
  return (
    <Suspense>
      <Customers />
    </Suspense>
  );
}
