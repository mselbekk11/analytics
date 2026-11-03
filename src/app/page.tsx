import type { Metadata } from "next";
import { meta } from "@/components/home/content";
import FeatureLayout from "@/components/home/FeatureLayout";
import FinalCta from "@/components/home/FinalCta";
import Hero from "@/components/home/Hero";
import HomeFooter from "@/components/home/HomeFooter";
import HomeNav from "@/components/home/HomeNav";

export const metadata: Metadata = meta;

// Public, static homepage. Signed-in visitors never see it: the proxy sends them to /websites.
// The words live in src/components/home/content.ts.
export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <HomeNav />
      <main className="flex-1">
        <Hero />
        <FeatureLayout />
        <FinalCta />
      </main>
      <HomeFooter />
    </div>
  );
}
