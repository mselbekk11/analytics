import { cn } from "cn";

/** The app's mark: a ring on a filled square, in the foreground colour. */
export default function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md bg-foreground", className)}>
      <span className="size-3.5 rounded-full border-[2.5px] border-background" />
    </span>
  );
}
