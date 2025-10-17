import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-[10px] font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // ROUGEE PLAY tech variants
        tech: "tech-button text-foreground hover:text-neon-green hover:neon-glow font-mono font-semibold",
        neon: "bg-neon-green text-black hover:bg-neon-green-dim font-mono font-bold neon-glow transition-all duration-300",
        disconnect: "tech-button text-neon-green border-neon-green hover:bg-neon-green hover:text-black font-mono",
        tab: "tech-button text-muted-foreground hover:text-neon-green hover:border-neon-green font-mono rounded-none border-b-2 border-transparent",
        live: "bg-live-indicator text-black font-mono font-bold text-xs px-2 py-1 rounded-sm",
      },
      size: {
        default: "h-7 px-3 py-1",
        sm: "h-6 rounded-md px-2",
        lg: "h-8 rounded-md px-4",
        icon: "h-7 w-7",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
