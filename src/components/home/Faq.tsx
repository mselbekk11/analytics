import { Plus } from "lucide-react";
import { CONTACT_EMAIL, faq } from "./content";
import { LINK_FOCUS } from "./container";
import SoonBadge from "./SoonBadge";

/** The FAQ as native disclosures (no JS), with a rule between entries. */
export default function Faq() {
  return (
    <div className="border-y border-line">
      {faq.map((entry) => (
        <details key={entry.question} className="group border-t border-line first:border-t-0">
          <summary className="flex cursor-pointer list-none items-center gap-3 rounded-md py-4 text-[15px] font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            <span className="flex-1">
              {entry.question}
              {entry.soon && <SoonBadge className="ml-2 align-[2px]" />}
            </span>
            <Plus
              className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-45 motion-reduce:transition-none"
              aria-hidden
            />
          </summary>
          <p className="max-w-[640px] pb-5 text-[15px] leading-relaxed text-pretty text-muted-foreground">
            {entry.answer}
            {entry.email && (
              <>
                {" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className={`font-medium text-foreground underline-offset-4 hover:underline ${LINK_FOCUS}`}>
                  {CONTACT_EMAIL}
                </a>
              </>
            )}
          </p>
        </details>
      ))}
    </div>
  );
}
