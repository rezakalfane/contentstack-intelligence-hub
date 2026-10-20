import { shortId } from "./fingerprint";
import type { AuditEvent, ProposalState, TranslationProposal } from "./types";

export class TransitionError extends Error {
  constructor(
    message: string,
    readonly code: "invalid_state" | "empty_text" | "blocking_validation" | "not_verified",
  ) {
    super(message);
  }
}

export type ReviewEvent =
  | { type: "request" }
  | { type: "generation_failed"; reason: string }
  | { type: "generated"; patch: Partial<TranslationProposal> }
  | { type: "edit"; text: string }
  | { type: "approve"; actorId: string; text: string; blockingIssues: string[] }
  | { type: "reject"; actorId: string; comment?: string }
  | { type: "apply_to_demo"; actorId: string }
  | { type: "rebase"; actorId: string; cmsVersion?: number; sourceFingerprint: string; sourceText: string; existingText?: string }
  | { type: "write_start"; actorId: string }
  | { type: "write_result"; actorId: string; ok: boolean; readBackVerified: boolean; error?: string };

export interface TransitionResult {
  proposal: TranslationProposal;
  audit: AuditEvent;
}

const FROM: Record<ReviewEvent["type"], ProposalState[]> = {
  request: ["not_requested", "rejected", "write_failed"],
  generation_failed: ["generating"],
  generated: ["generating"],
  edit: ["proposed", "in_review"],
  approve: ["proposed", "in_review"],
  reject: ["proposed", "in_review"],
  rebase: ["write_failed"],
  apply_to_demo: ["approved"],
  write_start: ["approved"],
  write_result: ["write_pending"],
};

export function effectiveText(p: TranslationProposal): string {
  return p.editedText ?? p.suggestedText;
}

export function transition(p: TranslationProposal, event: ReviewEvent, now: Date): TransitionResult {
  if (!FROM[event.type].includes(p.status)) {
    throw new TransitionError(`Cannot ${event.type} a proposal in state "${p.status}"`, "invalid_state");
  }
  if (event.type === "apply_to_demo" && p.appliedToDemo) {
    throw new TransitionError("Proposal already applied to the demo dataset", "invalid_state");
  }
  const at = now.toISOString();
  let next: TranslationProposal = { ...p, updatedAt: at };
  let nextState: ProposalState = p.status;
  let actorId = "system";
  let action: string = event.type;
  let comment: string | undefined;

  switch (event.type) {
    case "request":
      nextState = "generating";
      next = { ...next, editedText: undefined, reviewedBy: undefined, reviewedAt: undefined, writeError: undefined };
      action = "Proposal requested";
      break;
    case "generation_failed":
      nextState = "not_requested";
      comment = event.reason;
      action = "Proposal generation failed";
      break;
    case "generated":
      nextState = "proposed";
      next = { ...next, ...event.patch };
      action = `Proposal generated (${next.provenance === "openai" ? `OpenAI ${next.model}` : "SIMULATED"})`;
      break;
    case "edit":
      nextState = "in_review";
      next = { ...next, editedText: event.text };
      action = "Proposal edited by reviewer";
      break;
    case "approve": {
      if (!event.text.trim()) throw new TransitionError("Translation cannot be empty", "empty_text");
      if (event.blockingIssues.length) {
        throw new TransitionError(`Fix before approving: ${event.blockingIssues.join("; ")}`, "blocking_validation");
      }
      nextState = "approved";
      actorId = event.actorId;
      next = { ...next, editedText: event.text, reviewedBy: event.actorId, reviewedAt: at };
      action = "Proposal approved — NO CMS write performed";
      break;
    }
    case "reject":
      nextState = "rejected";
      actorId = event.actorId;
      comment = event.comment;
      next = { ...next, reviewedBy: event.actorId, reviewedAt: at };
      action = "Proposal rejected — issue returns to the queue";
      break;
    case "apply_to_demo":
      actorId = event.actorId;
      next = { ...next, appliedToDemo: true };
      action = "Applied to local demo dataset — NOT Contentstack";
      break;
    case "rebase":
      // Re-review: keep the reviewer's text but pin it to the CURRENT CMS version/source; approval is required again.
      nextState = "in_review";
      actorId = event.actorId;
      next = {
        ...next,
        cmsVersionAtProposal: event.cmsVersion,
        sourceFingerprint: event.sourceFingerprint,
        sourceText: event.sourceText,
        existingText: event.existingText,
        editedText: effectiveText(p),
        writeError: undefined,
        reviewedBy: undefined,
        reviewedAt: undefined,
      };
      action = `Re-review started against current CMS version ${event.cmsVersion ?? "?"} — approval required again`;
      break;
    case "write_start":
      nextState = "write_pending";
      actorId = event.actorId;
      action = "Contentstack draft write started";
      break;
    case "write_result":
      actorId = event.actorId;
      if (event.ok && !event.readBackVerified) {
        throw new TransitionError("A write is only 'written' after read-back verification", "not_verified");
      }
      nextState = event.ok ? "written" : "write_failed";
      next = { ...next, writeError: event.ok ? undefined : event.error };
      comment = event.error;
      action = event.ok ? "Draft written and verified by read-back" : "Contentstack write failed";
      break;
  }

  next.status = nextState;
  const audit: AuditEvent = {
    id: shortId("ev", `${p.id}|${at}|${action}|${Math.random()}`),
    proposalId: p.id,
    issueId: p.issueId,
    actorId,
    action,
    previousState: p.status,
    nextState,
    comment,
    at,
  };
  return { proposal: next, audit };
}
