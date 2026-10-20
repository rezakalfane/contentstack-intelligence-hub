import type { IssueStatus, ProposalState, Severity } from "@/lib/domain/types";

export const STATUS_LABEL: Record<IssueStatus, string> = {
  missing: "Missing",
  incomplete: "Incomplete",
  stale: "Stale candidate",
  unpublished: "Unpublished",
  resolved: "Resolved (demo)",
};

export const SEVERITY_TONE: Record<Severity, "critical" | "high" | "medium" | "low"> = {
  critical: "critical", high: "high", medium: "medium", low: "low",
};

export const PROPOSAL_LABEL: Record<ProposalState, string> = {
  not_requested: "No proposal",
  generating: "Generating…",
  proposed: "Proposed",
  in_review: "In review",
  approved: "Approved",
  rejected: "Rejected",
  write_pending: "Write pending",
  written: "Written to CMS",
  write_failed: "Write failed",
};

export const RULE_TITLES: Record<string, string> = {
  "LOC-001": "Missing translation",
  "LOC-002": "Incomplete / possibly untranslated",
  "LOC-003": "Possibly stale",
  "LOC-004": "Placeholder mismatch",
  "PUB-001": "Unpublished variant",
};
