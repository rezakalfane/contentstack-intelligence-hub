// Deep links into the Contentstack web app. Pure (no env access) so client components can build them.
// URL shapes follow the app's hash routes; they have not been click-tested against every plan/region.

export const APP_HOSTS: Record<string, string> = {
  na: "https://app.contentstack.com",
  eu: "https://eu-app.contentstack.com",
  au: "https://au-app.contentstack.com",
  "azure-na": "https://azure-na-app.contentstack.com",
  "azure-eu": "https://azure-eu-app.contentstack.com",
  "gcp-na": "https://gcp-na-app.contentstack.com",
  "gcp-eu": "https://gcp-eu-app.contentstack.com",
};

export interface LinkBase {
  host: string;
  /** Stack API key: an identifier used in app URLs, not an authentication secret (tokens are). */
  stackKey: string;
  branch?: string;
}

const q = (b: LinkBase) => (b.branch ? `?branch=${encodeURIComponent(b.branch)}` : "");
const seg = encodeURIComponent;

export const csLinks = {
  dashboard: (b: LinkBase) => `${b.host}/#!/stack/${seg(b.stackKey)}/dashboard${q(b)}`,
  languages: (b: LinkBase) => `${b.host}/#!/stack/${seg(b.stackKey)}/settings/languages${q(b)}`,
  entries: (b: LinkBase, contentType: string, locale: string) =>
    `${b.host}/#!/stack/${seg(b.stackKey)}/content-type/${seg(contentType)}/${seg(locale)}/entries${q(b)}`,
  entry: (b: LinkBase, contentType: string, locale: string, entryUid: string) =>
    `${b.host}/#!/stack/${seg(b.stackKey)}/content-type/${seg(contentType)}/${seg(locale)}/entry/${seg(entryUid)}/edit${q(b)}`,
};
