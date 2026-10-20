import type { ContentPointer, NormalizedContentType, NormalizedEntry, Page, Publication } from "@/lib/domain/types";
import { buildDemoWorld, DEMO_CONTENT_TYPES, DEMO_ENV_UID, DEMO_LOCALES, DEMO_MASTER, DEMO_STACK } from "@/lib/demo/fixtures";
import type { ContentstackAdapter, StackContext } from "./contentstack-adapter";

export function createDemoAdapter(): ContentstackAdapter {
  const world = buildDemoWorld();
  return {
    kind: "demo",
    async getContext(): Promise<StackContext> {
      return {
        stack: DEMO_STACK, region: "n/a (offline fixtures)", branch: "main", masterLocale: DEMO_MASTER,
        locales: DEMO_LOCALES, environmentUid: DEMO_ENV_UID, environmentName: "production (sample)",
      };
    },
    async listContentTypes(): Promise<NormalizedContentType[]> {
      return DEMO_CONTENT_TYPES;
    },
    async listSourceEntries({ contentTypeUid }): Promise<Page<NormalizedEntry>> {
      const items = world.sourceEntries.filter((e) => e.contentTypeUid === contentTypeUid);
      return { items, total: items.length };
    },
    async getLocalePresence({ contentTypeUid, entryUid }) {
      return world.presence.get(`${contentTypeUid}/${entryUid}`) ?? [];
    },
    async getLocalizedEntry(p: ContentPointer) {
      return world.targets.get(`${p.contentTypeUid}/${p.entryUid}/${p.locale}`) ?? null;
    },
    async getPublicationState(p: ContentPointer): Promise<Publication> {
      const t = world.targets.get(`${p.contentTypeUid}/${p.entryUid}/${p.locale}`);
      return t?.publishedEnvironments?.includes(DEMO_ENV_UID) ? "published" : "unpublished";
    },
    getApprovalBaselines: () => world.baselines,
  };
}
