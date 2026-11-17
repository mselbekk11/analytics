import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

/**
 * Tailark Dusk's button (pill-shaped, from the hero-section-6 block), kept apart from the
 * app's shadcn button in src/components/ui/button.tsx. Only the homepage hero uses it.
 */
const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full text-sm font-medium whitespace-nowrap duration-200 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-98 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm shadow-black/10 hover:bg-primary/90",
        outline: "bg-foreground/5 shadow-sm ring-1 shadow-black/10 ring-foreground/10 hover:bg-muted/50",
        ghost: "hover:bg-foreground/6.5 hover:text-accent-foreground",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3 text-[0.8rem]",
        lg: "h-10 px-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export function DuskButton({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return <ButtonPrimitive data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
