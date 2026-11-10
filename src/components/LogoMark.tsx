import { cn } from "cn";

/** The app's mark: an "S" on a filled square, in the foreground colour. */
export default function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md bg-foreground text-[17px] leading-none font-bold text-background select-none",
        className,
      )}
    >
      S
    </span>
  );
}
