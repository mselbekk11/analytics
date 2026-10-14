import { UserButton } from "@clerk/nextjs";
import AddWebsiteForm from "@/components/AddWebsiteForm";
import SiteLinks from "@/components/SiteLinks";
import WhoAmI from "@/components/WhoAmI";

// Placeholder home: replaced by a redirect to /websites in Phase 3.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Analytics</h1>
        <UserButton />
      </header>
      <section className="rounded-lg border border-zinc-800 p-4">
        <h2 className="mb-3 text-sm font-medium text-zinc-400">Your sites</h2>
        <SiteLinks />
      </section>
      <section className="rounded-lg border border-zinc-800 p-4">
        <h2 className="mb-3 text-sm font-medium text-zinc-400">
          Convex identity
        </h2>
        <WhoAmI />
      </section>
      <section className="rounded-lg border border-zinc-800 p-4">
        <h2 className="mb-3 text-sm font-medium text-zinc-400">Add website</h2>
        <AddWebsiteForm />
      </section>
    </main>
  );
}
