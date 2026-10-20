import "server-only";
import { extractLeaves, indexLeaves, matchLeaf } from "@/lib/domain/normalizer";
import { fingerprint, normalizeText } from "@/lib/domain/fingerprint";
import { effectiveText } from "@/lib/domain/review";
import type { TranslationProposal } from "@/lib/domain/types";
import { evaluateWritePolicy } from "@/lib/security/write-policy";
import type { Env } from "@/lib/security/env";
import type { ContentstackAdapter, WriteResult } from "./contentstack-adapter";
import type { CmaClient } from "./cma-client";

import { minimalUpdateBody, setTextAtPath } from "@/lib/domain/path";

type Obj = Record<string, unknown>;

export { setTextAtPath };

export interface WriterDeps {
  env: Pick<Env, "ENABLE_CMS_WRITES" | "CONTENTSTACK_WRITE_TOKEN" | "CMS_WRITE_ALLOWED_ENTRY_UIDS">;
  mode: "live" | "demo";
  adapter: ContentstackAdapter;
  writeClient?: CmaClient;
}

/**
 * Guarded, draft-only write of ONE reviewed text field. Never publishes.
 * NOTE: the pre-read is not an atomic server-side compare-and-swap; it narrows, but does not eliminate, a race window.
 * This path has NOT been exercised against a live stack (see README).
 */
export async function applyReviewedProposal(deps: WriterDeps, proposal: TranslationProposal, confirm: boolean): Promise<WriteResult> {
  const { pointer } = proposal;
  const policy = evaluateWritePolicy(deps.env, deps.mode, { entryUid: pointer.entryUid }, confirm);
  if (!policy.allowed) return { ok: false, code: policy.code, message: policy.reason };
  if (!deps.writeClient) return { ok: false, code: "writes_disabled", message: "No write client configured" };
  if (proposal.status !== "approved") return { ok: false, code: "forbidden", message: "Only approved proposals can be written" };

  try {
    const cts = await deps.adapter.listContentTypes();
    const ct = cts.find((c) => c.uid === pointer.contentTypeUid);
    if (!ct) return { ok: false, code: "failed", message: "Content type no longer exists" };

    // Fresh reads of source and localized target.
    const sources = await deps.adapter.listSourceEntries({ contentTypeUid: ct.uid });
    let source = sources.items.find((e) => e.uid === pointer.entryUid);
    for (let c = sources.cursor; !source && c; ) {
      const next = await deps.adapter.listSourceEntries({ contentTypeUid: ct.uid, cursor: c });
      source = next.items.find((e) => e.uid === pointer.entryUid);
      c = next.cursor;
    }
    if (!source) return { ok: false, code: "conflict", message: "Source entry not found; re-review required" };
    const leaf = extractLeaves(ct.schema, source.values).find((l) => l.path === pointer.fieldPath);
    if (!leaf || leaf.kind !== "text") return { ok: false, code: "failed", message: "Only plain text fields can be written in this milestone" };
    if (fingerprint(leaf.text) !== proposal.sourceFingerprint) {
      return { ok: false, code: "conflict", message: "Source text changed since the proposal (409): re-review required" };
    }

    const localized = await deps.adapter.getLocalizedEntry(pointer);
    if (!localized) return { ok: false, code: "failed", message: "No explicit localized version exists; localizing a new entry is out of scope for this milestone" };
    if (proposal.cmsVersionAtProposal !== undefined && localized.version !== proposal.cmsVersionAtProposal) {
      return { ok: false, code: "conflict", message: `Localized entry is at version ${localized.version}, proposal was made at ${proposal.cmsVersionAtProposal} (409): re-review required` };
    }

    const entryBody = structuredClone(localized.values) as Obj;
    const text = effectiveText(proposal);
    // Locales may carry different instance ids: resolve the target's own path for the same logical leaf.
    const matched = matchLeaf(indexLeaves(extractLeaves(ct.schema, localized.values)), leaf).leaf;
    if (!matched || !setTextAtPath(entryBody, matched.path, text)) return { ok: false, code: "failed", message: "Could not resolve the field path in the localized entry" };

    await deps.writeClient.put(`/content_types/${encodeURIComponent(ct.uid)}/entries/${encodeURIComponent(pointer.entryUid)}`, { entry: minimalUpdateBody(entryBody, [matched.path]) }, { locale: pointer.locale });

    // Read-back verification.
    const after = await deps.adapter.getLocalizedEntry(pointer);
    const back = after && matchLeaf(indexLeaves(extractLeaves(ct.schema, after.values)), leaf).leaf;
    if (!after || !back || normalizeText(back.text) !== normalizeText(text)) {
      return { ok: false, code: "failed", message: "Write returned success but read-back did not match the approved text" };
    }
    return { ok: true, readBackVerified: true, entryVersion: after.version };
  } catch (err) {
    return { ok: false, code: "failed", message: err instanceof Error ? err.message : "Write failed" };
  }
}
