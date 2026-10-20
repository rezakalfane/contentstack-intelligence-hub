import { cn } from "@/lib/utils/cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-line bg-white shadow-card", className)} {...props} />;
}

export function SectionTitle({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-bold tracking-tight">{title}</h2>
        {hint && <p className="mt-1 text-[11px] text-[#8695a0]">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHead({ eyebrow, title, sub, actions }: { eyebrow: string; title: string; sub: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="mb-1.5 mt-2 text-[28px] font-bold leading-tight tracking-[-0.04em] sm:text-[30px]">{title}</h1>
        <p className="max-w-3xl text-[13px] leading-relaxed text-muted">{sub}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Note({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" | "danger" }) {
  const t = { info: "border-[#d9ece5] bg-[#eff8f5] text-[#537169]", warn: "border-[#f1d9b0] bg-amber-soft text-[#7a5316]", danger: "border-[#f0c9c5] bg-danger-soft text-[#8f2f2a]" }[tone];
  return <div className={cn("rounded-lg border px-4 py-3 text-[11px] leading-relaxed", t)}>{children}</div>;
}
