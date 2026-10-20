import { describe, expect, it } from "vitest";
import { TransitionError, transition } from "@/lib/domain/review";
import type { TranslationProposal } from "@/lib/domain/types";
import { validateTranslation } from "@/lib/ai/validation";

const NOW = new Date("2026-10-20T10:00:00Z");
const base = (status: TranslationProposal["status"]): TranslationProposal => ({
  id: "p1", issueId: "d1", unitKey: "k", status, provenance: "simulated",
  pointer: { stackId: "s", contentTypeUid: "page", entryUid: "e1", locale: "it-it", fieldPath: "title" },
  sourceText: "Hello {{name}}", suggestedText: "Ciao {{name}}", model: "sim", promptVersion: "v1",
  sourceFingerprint: "abc", glossaryWarnings: [], placeholderWarnings: [], notes: [], updatedAt: NOW.toISOString(),
});

describe("proposal state machine", () => {
  it("approve is distinct from any CMS write and is audited", () => {
    const r = transition(base("proposed"), { type: "approve", actorId: "me", text: "Ciao {{name}}", blockingIssues: [] }, NOW);
    expect(r.proposal.status).toBe("approved");
    expect(r.proposal.appliedToDemo).toBeFalsy();
    expect(r.audit.action).toMatch(/NO CMS write/);
    expect(r.audit.previousState).toBe("proposed");
    expect(r.audit.actorId).toBe("me");
  });

  it("cannot approve with blocking validation or empty text", () => {
    expect(() => transition(base("in_review"), { type: "approve", actorId: "me", text: "", blockingIssues: [] }, NOW)).toThrow(TransitionError);
    expect(() => transition(base("in_review"), { type: "approve", actorId: "me", text: "Ciao", blockingIssues: ["Placeholders differ"] }, NOW)).toThrow(/Fix before approving/);
  });

  it("reject returns the issue to the queue and allows a new request", () => {
    const rejected = transition(base("in_review"), { type: "reject", actorId: "me" }, NOW).proposal;
    expect(rejected.status).toBe("rejected");
    expect(transition(rejected, { type: "request" }, NOW).proposal.status).toBe("generating");
  });

  it("apply-to-demo needs approval and cannot repeat", () => {
    expect(() => transition(base("proposed"), { type: "apply_to_demo", actorId: "me" }, NOW)).toThrow(TransitionError);
    const applied = transition(base("approved"), { type: "apply_to_demo", actorId: "me" }, NOW).proposal;
    expect(applied.appliedToDemo).toBe(true);
    expect(applied.status).toBe("approved"); // demo apply is not a CMS write
    expect(() => transition(applied, { type: "apply_to_demo", actorId: "me" }, NOW)).toThrow(/already applied/);
  });

  it("approved never silently becomes written: requires write_start and verified read-back", () => {
    expect(() => transition(base("approved"), { type: "write_result", actorId: "me", ok: true, readBackVerified: true }, NOW)).toThrow(TransitionError);
    const pending = transition(base("approved"), { type: "write_start", actorId: "me" }, NOW).proposal;
    expect(() => transition(pending, { type: "write_result", actorId: "me", ok: true, readBackVerified: false }, NOW)).toThrow(/read-back/);
    expect(transition(pending, { type: "write_result", actorId: "me", ok: true, readBackVerified: true }, NOW).proposal.status).toBe("written");
    expect(transition(pending, { type: "write_result", actorId: "me", ok: false, readBackVerified: false, error: "409" }, NOW).proposal.status).toBe("write_failed");
  });
});

describe("translation validation", () => {
  it("blocks altered placeholders, markdown links and html", () => {
    expect(validateTranslation("Hi {{name}}", "Ciao {{nome}}").blocking.length).toBe(1);
    expect(validateTranslation("See [docs](https://a.io)", "Voir [docs](https://b.io)").placeholderWarnings.length).toBeGreaterThan(0);
    expect(validateTranslation("Use <b>bold</b>", "Usa bold").blocking.length).toBe(1);
    expect(validateTranslation("Hi {{name}}", "Ciao {{name}}").blocking).toEqual([]);
  });

  it("warns on do-not-translate terms and suspicious length", () => {
    expect(validateTranslation("Powered by Contentstack", "Alimentato da CS").glossaryWarnings.length).toBe(1);
    expect(validateTranslation("A short source line", "x".repeat(200)).warnings.join()).toMatch(/longer/);
  });
});

describe("re-review after a write conflict", () => {
  it("rebase pins the proposal to the current CMS state and requires approval again", () => {
    const failed = { ...base("write_failed"), cmsVersionAtProposal: 4, writeError: "409", editedText: "Ciao {{name}}" };
    const r = transition(failed, { type: "rebase", actorId: "me", cmsVersion: 5, sourceFingerprint: "new", sourceText: "Hello {{name}}!", existingText: "x" }, NOW);
    expect(r.proposal.status).toBe("in_review");
    expect(r.proposal).toMatchObject({ cmsVersionAtProposal: 5, sourceFingerprint: "new", editedText: "Ciao {{name}}", writeError: undefined, reviewedBy: undefined });
    expect(() => transition(base("approved"), { type: "rebase", actorId: "me", sourceFingerprint: "n", sourceText: "s" }, NOW)).toThrow(TransitionError);
  });
});
