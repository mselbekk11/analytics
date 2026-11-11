"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import TierPicker from "@/components/pricing/TierPicker";
import { pricing, SIGN_IN } from "./content";

/** The homepage's tier slider, starting on 500k; the button starts a trial (no card). */
export default function HomeTierPicker() {
  return (
    <TierPicker
      action={() => (
        <>
          <Link href={SIGN_IN} className={buttonVariants({ size: "lg", className: "w-full" })}>
            {pricing.cta}
          </Link>
          <p className="mt-3 text-center text-[13px] text-muted-foreground">{pricing.ctaNote}</p>
        </>
      )}
    />
  );
}
