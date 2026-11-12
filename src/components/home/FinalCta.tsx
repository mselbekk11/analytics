import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CONTAINER } from "./container";
import { finalCta, SIGN_UP } from "./content";

/** The last call to action, centred above the footer. */
export default function FinalCta() {
  return (
    <section aria-labelledby="final-cta-heading" className="border-t border-line">
      <div className={`${CONTAINER} py-24 text-center sm:py-32`}>
        <h2
          id="final-cta-heading"
          className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl"
        >
          <span className="sm:block">{finalCta.heading[0]}</span> <span className="sm:block">{finalCta.heading[1]}</span>
        </h2>
        <Button size="lg" className="mt-8 h-10 px-5 text-[15px]" render={<Link href={SIGN_UP} />} nativeButton={false}>
          {finalCta.button}
        </Button>
        <p className="mt-4 text-sm text-muted-foreground">{finalCta.note}</p>
      </div>
    </section>
  );
}
