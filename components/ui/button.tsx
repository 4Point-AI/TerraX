import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-[44px] items-center justify-center whitespace-nowrap border border-dashed border-transparent px-4 py-2 text-[0.92rem] font-semibold uppercase tracking-[0.03em] ring-offset-background transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-[rgba(188,132,88,0.68)] bg-primary text-primary-foreground shadow-[0_14px_38px_rgba(0,0,0,0.24)] hover:-translate-y-px hover:border-[rgba(196,148,79,0.8)] hover:bg-[rgba(196,148,79,1)]",
        destructive: "border-[rgba(166,82,50,0.72)] bg-destructive text-destructive-foreground hover:-translate-y-px hover:bg-destructive/90",
        outline: "border-[rgba(245,242,237,0.24)] bg-[rgba(255,255,255,0.02)] text-foreground hover:-translate-y-px hover:border-[rgba(188,132,88,0.52)] hover:bg-[rgba(185,120,70,0.08)]",
        secondary: "border-[rgba(245,242,237,0.16)] bg-secondary text-secondary-foreground hover:-translate-y-px hover:border-[rgba(245,242,237,0.3)] hover:bg-secondary/90",
        ghost: "border-transparent bg-transparent text-muted-foreground hover:-translate-y-px hover:border-[rgba(245,242,237,0.18)] hover:bg-[rgba(255,255,255,0.03)] hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-10 px-3",
        lg: "h-12 px-8",
        icon: "h-11 w-11 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
