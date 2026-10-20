import { entryDisplayTitle, normalizeContentType, type RawContentType } from "@/lib/domain/normalizer";
import type { ContentPointer, LocaleInfo, NormalizedContentType, NormalizedEntry, Page, Publication } from "@/lib/domain/types";
import type { ContentstackAdapter, StackContext } from "./contentstack-adapter";
import { CmaClient } from "./cma-client";

interface RawLocale { code: string; name?: string; fallback_locale?: string | null; created_at?: string }
interface RawEnvironment { uid: string; name: string }
interface PublishDetail { environment?: string; locale?: string }
type RawEntry = Record<string, unknown> & { uid: string; title?: string; locale?: string; _version?: number; updated_at?: string; publish_details?: PublishDetail[] };

const SYSTEM_KEYS = new Set(["uid", "created_by", "updated_by", "created_at", "updated_at", "ACL", "_version", "tags", "_in_progress", "locale", "publish_details", "_workflow"]);
const PAGE = 100;

export interface LiveAdapterOptions {
  client: CmaClient;
  region: string;
  branch?: string;
  masterLocale?: string;
  environment?: string; // name or uid
}

export function createLiveAdapter(opts: LiveAdapterOptions): ContentstackAdapter & { client: CmaClient } {
  const { client } = opts;
  let ctx: StackContext | undefined;

  const normalize = (raw: RawEntry, ct: string, fallbackLocale: string): NormalizedEntry => {
    const locale = typeof raw.locale === "string" ? raw.locale : fallbackLocale;
    const values: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) if (!SYSTEM_KEYS.has(k)) values[k] = v;
    const known = Array.isArray(raw.publish_details);
    return {
      uid: raw.uid,
      contentTypeUid: ct,
      title: entryDisplayTitle(values, raw.uid),
      locale,
      version: typeof raw._version === "number" ? raw._version : 1,
      updatedAt: raw.updated_at,
      values,
      publicationKnown: known,
      publishedEnvironments: known ? (raw.publish_details ?? []).filter((p) => !p.locale || p.locale === locale).map((p) => p.environment ?? "") : undefined,
    };
  };

  const adapter: ContentstackAdapter & { client: CmaClient } = {
    kind: "live",
    client,

    async getContext() {
      if (ctx) return ctx;
      const { locales: raw } = await client.get<{ locales: RawLocale[] }>("/locales");
      if (!raw.length) throw new Error("The stack returned no locales");
      const locales: LocaleInfo[] = raw.map((l) => ({ code: l.code, name: l.name ?? l.code, fallbackLocale: l.fallback_locale ?? null }));
      const master =
        opts.masterLocale ??
        [...raw].filter((l) => !l.fallback_locale).sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))[0]?.code ??
        raw[0]!.code;
      if (!locales.some((l) => l.code === master)) throw new Error(`Configured master locale "${master}" is not a locale of this stack`);

      let environmentUid: string | undefined;
      let environmentName: string | undefined;
      if (opts.environment) {
        try {
          const { environments } = await client.get<{ environments: RawEnvironment[] }>("/environments");
          const hit = environments.find((e) => e.uid === opts.environment || e.name === opts.environment);
          environmentUid = hit?.uid;
          environmentName = hit?.name;
        } catch {
          /* publication checks degrade to "unknown" */
        }
      }
      ctx = {
        stack: "Contentstack stack",
        region: opts.region,
        branch: opts.branch,
        masterLocale: master,
        locales,
        environmentUid,
        environmentName,
      };
      return ctx;
    },

    async listContentTypes(): Promise<NormalizedContentType[]> {
      const all: RawContentType[] = [];
      for (let skip = 0; ; skip += PAGE) {
        const res = await client.get<{ content_types: RawContentType[]; count?: number }>("/content_types", {
          limit: PAGE, skip, include_count: true, include_global_field_schema: true,
        });
        all.push(...res.content_types);
        if (res.content_types.length < PAGE || (res.count !== undefined && all.length >= res.count)) break;
      }
      return all.map((c) => normalizeContentType(c, new Map()));
    },

    async listSourceEntries({ contentTypeUid, cursor }): Promise<Page<NormalizedEntry>> {
      const c = await adapter.getContext();
      const skip = cursor ? Number(cursor) : 0;
      const res = await client.get<{ entries: RawEntry[]; count?: number }>(`/content_types/${encodeURIComponent(contentTypeUid)}/entries`, {
        locale: c.masterLocale, limit: PAGE, skip, include_count: true, include_publish_details: true,
      });
      const next = skip + res.entries.length;
      return {
        items: res.entries.map((e) => normalize(e, contentTypeUid, c.masterLocale)),
        total: res.count,
        cursor: res.entries.length === PAGE && (res.count === undefined || next < res.count) ? String(next) : undefined,
      };
    },

    async getLocalePresence({ contentTypeUid, entryUid }) {
      const res = await client.get<{ locales: { code: string; localized?: boolean }[] }>(
        `/content_types/${encodeURIComponent(contentTypeUid)}/entries/${encodeURIComponent(entryUid)}/locales`,
      );
      return res.locales.filter((l) => l.localized).map((l) => l.code);
    },

    async getLocalizedEntry(p: ContentPointer) {
      const res = await client.get<{ entry: RawEntry }>(
        `/content_types/${encodeURIComponent(p.contentTypeUid)}/entries/${encodeURIComponent(p.entryUid)}`,
        { locale: p.locale, include_publish_details: true },
      );
      // CMA returns master content for a non-localized locale; never treat that as a localized version.
      if (res.entry.locale && res.entry.locale !== p.locale) return null;
      return normalize(res.entry, p.contentTypeUid, p.locale);
    },

    async getPublicationState(p: ContentPointer): Promise<Publication> {
      const c = await adapter.getContext();
      const e = await adapter.getLocalizedEntry(p);
      if (!e || !c.environmentUid || !e.publicationKnown) return "unknown";
      return e.publishedEnvironments?.includes(c.environmentUid) ? "published" : "unpublished";
    },
  };
  return adapter;
}
