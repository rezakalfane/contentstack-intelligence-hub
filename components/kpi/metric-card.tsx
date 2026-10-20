import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export function MetricCard({ label, value, foot, icon: Icon, tone = "accent" }: { label: string; value: string; foot: string; icon: LucideIcon; tone?: "accent" | "amber" | "danger" }) {
  const t = { accent: "bg-accent-soft text-accent", amber: "bg-amber-soft text-amber", danger: "bg-danger-soft text-danger" }[tone];
  return (
    <Card className="relative min-h-[132px] p-5">
      <h3 className="text-xs font-semibold text-[#5b6e7e]">{label}</h3>
      <div className={`absolute right-[18px] top-[18px] grid h-[33px] w-[33px] place-items-center rounded-lg ${t}`} aria-hidden><Icon size={16} /></div>
      <div className="mb-1.5 mt-4 text-[31px] font-bold leading-tight tracking-[-0.04em]">{value}</div>
      <div className="text-[11px] leading-snug text-[#81909c]">{foot}</div>
    </Card>
  );
}
