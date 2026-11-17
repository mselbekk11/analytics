import type { Metadata } from "next";
import { meta } from "@/components/home/content";
import DuskHero from "@/components/home/DuskHero";
import FeatureLayout from "@/components/home/FeatureLayout";
import FinalCta from "@/components/home/FinalCta";
import HeroHeader from "@/components/home/HeroHeader";
import HomeFooter from "@/components/home/HomeFooter";

export const metadata: Metadata = meta;

// Public, static homepage. Signed-in visitors never see it: the proxy sends them to /websites.
// The words live in src/components/home/content.ts.
export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <HeroHeader />
      <main className="flex-1">
        <DuskHero />
        <FeatureLayout />
        <FinalCta />
      </main>
      <HomeFooter />
    </div>
  );
}
