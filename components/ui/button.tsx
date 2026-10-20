import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils/cn";

const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg border text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-line bg-white text-[#273e4d] hover:border-[#a0bab8] hover:bg-[#f7fbf9]",
        primary: "border-accent bg-accent text-white hover:bg-accent-dark",
        danger: "border-line bg-white text-danger hover:border-danger/40 hover:bg-danger-soft",
        ghost: "border-transparent bg-transparent text-accent hover:bg-accent-soft",
      },
      size: { default: "min-h-[38px] px-3.5 py-2.5", sm: "min-h-[30px] px-2.5 py-1.5 text-[11px]" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = "button", ...props }, ref) => (
  <button ref={ref} type={type} className={cn(button({ variant, size }), className)} {...props} />
));
Button.displayName = "Button";
