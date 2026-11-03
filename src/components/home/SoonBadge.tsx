import { cn } from "cn";
import { Badge } from "@/components/ui/badge";

/** Marks a feature that isn't built yet. */
export default function SoonBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("h-[18px] px-1.5 text-[11px] font-normal text-muted-foreground", className)}>
      Soon
    </Badge>
  );
}
