import type { ContentPointer, LocaleInfo, NormalizedContentType, NormalizedEntry, Page, Publication } from "@/lib/domain/types";

export interface StackContext {
  stack: string;
  region: string;
  branch?: string;
  masterLocale: string;
  locales: LocaleInfo[];
  environmentUid?: string;
  environmentName?: string;
}

/** Read-only contract. Writes live in a separate, guarded writer (lib/security/write-policy + lib/adapters/live-writer). */
export interface ContentstackAdapter {
  kind: "demo" | "live";
  getContext(): Promise<StackContext>;
  listContentTypes(): Promise<NormalizedContentType[]>;
  listSourceEntries(input: { contentTypeUid: string; cursor?: string }): Promise<Page<NormalizedEntry>>;
  /** Locale codes with an explicit localized version (delivery fallback is NOT presence). */
  getLocalePresence(input: { contentTypeUid: string; entryUid: string }): Promise<string[]>;
  getLocalizedEntry(input: ContentPointer): Promise<NormalizedEntry | null>;
  getPublicationState(input: ContentPointer): Promise<Publication>;
  /** Demo only: pre-existing approval baselines used to derive freshness. */
  getApprovalBaselines?(): Map<string, string>;
}

export interface ReviewedContentWriter {
  applyReviewedProposal(input: { proposalId: string; actorId: string; confirm: true }): Promise<WriteResult>;
}

export type WriteResult =
  | { ok: true; readBackVerified: true; entryVersion: number }
  | { ok: false; code: "writes_disabled" | "conflict" | "forbidden" | "failed"; message: string };
