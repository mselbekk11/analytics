import Link from "next/link";
import { Button } from "@/components/ui/button";
import LogoMark from "@/components/LogoMark";

// Public splash page. Signed-in visitors never see it: the proxy sends them to /websites.
export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <LogoMark />
          Analytics
        </Link>
        <Button variant="ghost" render={<Link href="/sign-in" />} nativeButton={false}>
          Log in
        </Button>
      </header>
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col items-center justify-center px-4 pt-10 pb-20 text-center sm:px-6 lg:px-8">
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Simple, private website analytics
        </h1>
        <p className="mt-4 max-w-md text-base text-pretty text-muted-foreground sm:text-lg">
          See who visits your sites and where they come from. No personal data is ever sold or shared.
        </p>
        <Button size="lg" className="mt-8 px-5" render={<Link href="/sign-in" />} nativeButton={false}>
          Log in
        </Button>
      </main>
    </div>
  );
}
