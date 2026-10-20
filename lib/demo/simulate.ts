import { CTAS, HEADLINES, SENTENCES, type DemoLocale, type Phrase } from "./bank";

const ALL: Phrase[] = [...SENTENCES, ...HEADLINES, ...CTAS];

/** SIMULATED output for DEMO mode: looks the source up in the sample phrase bank. Never labelled as generated live. */
export function simulateTranslation(source: string, locale: string): string {
  return source
    .split("\n")
    .map((line) => {
      const hit = ALL.find((p) => p["en-us"] === line);
      return hit ? hit[locale as DemoLocale] ?? `[${locale}] ${line}` : `[${locale}] ${line}`;
    })
    .join("\n");
}
