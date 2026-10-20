/** SIMULATED SEO suggestion for DEMO mode (deterministic text surgery, not a model). Always labelled as simulated in the UI. */

const cutAtWord = (s: string, max: number) => {
  if (s.length <= max) return s;
  const cut = s.slice(0, max + 1).replace(/\s+\S*$/, "").replace(/[\s,;:–—-]+$/, "");
  return cut;
};
const sentences = (s: string) => s.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+/).filter(Boolean);
const ensureStop = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

export function simulateSeoText(o: { target: "meta_title" | "meta_description"; current: string; entryTitle: string; excerpt: string; min: number; max: number }): string {
  const cur = o.current.trim();
  if (o.target === "meta_title") {
    if (!cur) return cutAtWord(o.entryTitle, o.max);
    if (cur.length > o.max) return cutAtWord(cur, o.max);
    return cutAtWord(`${cur} | ${o.entryTitle}`, o.max);
  }
  // meta description: build from current text, then pad with the page excerpt until it is long enough
  let text = cur;
  for (const s of sentences(o.excerpt)) {
    if (text.length >= o.min) break;
    if (!text.includes(s)) text = `${text ? `${text} ` : ""}${s}`.trim();
  }
  if (!text) text = o.entryTitle;
  text = cutAtWord(text, o.max);
  return ensureStop(text).slice(0, o.max);
}
