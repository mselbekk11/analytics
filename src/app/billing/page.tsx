import { CreditCard } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import TopBar from "@/components/TopBar";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function BillingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <TopBar account="billing" />
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-10 px-4 pt-10 pb-20 sm:px-6 lg:px-8">
        <PageHeader title="Billing" />
        <Card className="max-w-xl">
          <CardHeader>
            <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-muted">
              <CreditCard aria-hidden className="size-4 text-muted-foreground" />
            </div>
            <CardTitle>Billing is coming soon</CardTitle>
            <CardDescription>Plans and invoices will show up here.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    </div>
  );
}
