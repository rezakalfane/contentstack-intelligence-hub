import type { CoverageCell } from "@/lib/domain/types";
import { pct } from "@/lib/utils/format";

export function CoverageBars({ rows }: { rows: { locale: string; name: string; cell: CoverageCell }[] }) {
  return (
    <div>
      {rows.map(({ locale, name, cell }) => {
        const v = cell.percent;
        const tone = v === null ? "bg-[#cfd8dc]" : v < 70 ? "bg-[#c86c63]" : v < 85 ? "bg-[#c58a43]" : "bg-[#138778]";
        return (
          <div key={locale} className="my-4 grid grid-cols-[110px_1fr_56px] items-center gap-3 max-sm:grid-cols-[84px_1fr_48px]">
            <span className="truncate text-xs text-[#39505d]" title={name}>{locale.toUpperCase()}</span>
            <div className="h-[9px] overflow-hidden rounded-full bg-[#ecf0f0]" role="img" aria-label={`${name}: ${pct(v)} complete, ${cell.complete} of ${cell.eligible} fields`}>
              <div className={`h-full rounded-full transition-[width] duration-300 ${tone}`} style={{ width: `${v ?? 0}%` }} />
            </div>
            <small className="text-right text-xs font-bold text-[#536978]">{pct(v)}</small>
          </div>
        );
      })}
      {rows.length === 0 && <p className="text-xs text-muted">No target locales configured.</p>}
    </div>
  );
}
