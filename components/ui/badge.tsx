import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badge = cva("inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide", {
  variants: {
    tone: {
      neutral: "bg-[#f2f5f7] text-[#647886]",
      critical: "bg-danger-soft text-[#b84b40]",
      high: "bg-amber-soft text-[#a06a1f]",
      medium: "bg-[#eff2fb] text-[#5a6fa5]",
      low: "bg-[#e8f7f0] text-[#217d63]",
      info: "bg-info-soft text-info",
      live: "border border-[#bfe3da] bg-accent-soft text-accent",
      demo: "border border-[#f1d9b0] bg-amber-soft text-[#8a5a14]",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ tone, className, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}
