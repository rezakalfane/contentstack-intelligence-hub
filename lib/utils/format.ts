export function relativeTime(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export const pct = (v: number | null) => (v === null ? "N/A" : `${v}%`);
export const usd = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `$${v < 0.01 ? v.toFixed(5) : v.toFixed(3)}`);
