import { Check } from "lucide-react";
import { pricing } from "./content";
import PricingTable from "./PricingTable";
import SoonBadge from "./SoonBadge";

/** The plans (a client island for the Monthly | Yearly toggle), then what every plan includes. */
export default function Pricing() {
  return (
    <div>
      <PricingTable />
      <h3 className="sr-only">{pricing.includesLabel}</h3>
      <ul className="mt-6 grid gap-x-8 gap-y-3 text-[15px] sm:grid-cols-2">
        {pricing.includes.map((f) => (
          <li key={f.label} className="flex items-center gap-2.5">
            <Check className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {f.label}
            {f.soon && <SoonBadge />}
          </li>
        ))}
      </ul>
    </div>
  );
}
