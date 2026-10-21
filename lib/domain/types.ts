// Domain model. Existence, completeness, freshness, publication and proposal state are
// deliberately orthogonal: never collapse them into one "status".

export type LocaleCode = string; // vendor codes preserved, e.g. "fr-fr"
export type DataMode = "live" | "demo";

export type LocalizationExistence = "exists" | "fallback_only" | "not_localized" | "unknown";
export type FieldCompleteness = "complete" | "incomplete" | "missing" | "not_applicable";
export type Freshness = "current" | "stale" | "unknown";
export type Publication = "published" | "draft" | "unpublished" | "unknown";
export type Severity = "critical" | "high" | "medium" | "low";

export type ProposalState =
  | "not_requested"
  | "generating"
  | "proposed"
  | "in_review"
  | "approved"
  | "rejected"
  | "write_pending"
  | "written"
  | "write_failed";

export interface ContentPointer {
  stackId: string;
  branch?: string;
  contentTypeUid: string;
  entryUid: string;
  locale: LocaleCode;
  /** Stable typed path. Repeated instances use `[uid=<instance id>]`, falling back to `[<index>]`. */
  fieldPath: string;
}

// ---------- Normalized CMS shapes (identical for the live and the demo adapter) ----------

export type FieldDataType =
  | "text"
  | "json"
  | "group"
  | "global_field"
  | "blocks"
  | "reference"
  | "file"
  | "link"
  | "number"
  | "boolean"
  | "isodate"
  | "other";

export interface SchemaField {
  uid: string;
  displayName: string;
  dataType: FieldDataType;
  mandatory: boolean;
  multiple: boolean;
  nonLocalizable: boolean;
  /** Text field restricted to a fixed list (not translatable). */
  hasEnum: boolean;
  /** Reference fields: content types that may be referenced. */
  referenceTo?: string[];
  schema?: SchemaField[]; // group / global_field
  blocks?: { uid: string; displayName: string; schema: SchemaField[] }[]; // modular blocks
}

export interface NormalizedContentType {
  uid: string;
  title: string;
  schema: SchemaField[];
}

export interface NormalizedEntry {
  uid: string;
  contentTypeUid: string;
  title: string;
  locale: LocaleCode;
  version: number;
  updatedAt?: string;
  /** Raw field values (never contains credentials). */
  values: Record<string, unknown>;
  /** environment uid -> published? (undefined = unknown) */
  publishedEnvironments?: string[];
  publicationKnown: boolean;
  /** Demo/campaign context; absent for live data unless the schema provides it. */
  campaign?: { id: string; launchDate?: string };
}

export interface LocaleInfo {
  code: LocaleCode;
  name: string;
  fallbackLocale: LocaleCode | null;
}

export interface Page<T> {
  items: T[];
  cursor?: string;
  total?: number;
}

// ---------- Analysis output ----------

export interface TranslatableUnit {
  /** Unique within a snapshot: contentType/entry/locale/fieldPath */
  key: string;
  pointer: ContentPointer;
  entryTitle: string;
  contentTypeTitle: string;
  fieldLabel: string;
  kind: "text" | "richtext";
  mandatory: boolean;
  sourceText: string;
  sourceFingerprint: string;
  targetText?: string;
  existence: LocalizationExistence;
  completeness: FieldCompleteness;
  freshness: Freshness;
  publication: Publication;
  sourceUpdatedAt?: string;
  targetVersion?: number;
  sourceVersion?: number;
  approvedSourceFingerprint?: string;
  campaignId?: string;
  evidence: string[];
}

/** One row per (source entry x target locale): existence + publication, independent of fields. */
export interface EntryLocaleState {
  key: string;
  contentTypeUid: string;
  contentTypeTitle: string;
  entryUid: string;
  title: string;
  locale: LocaleCode;
  existence: LocalizationExistence;
  publication: Publication;
  sourcePublished: Publication;
  sourceVersion?: number;
  targetVersion?: number;
  campaignId?: string;
  campaignLaunchDate?: string;
}

export interface LocalizationDiagnostic {
  id: string;
  unitKey: string;
  pointer: ContentPointer;
  title: string;
  contentTypeTitle: string;
  fieldLabel: string;
  campaignId?: string;
  existence: LocalizationExistence;
  completeness: FieldCompleteness;
  freshness: Freshness;
  publication: Publication;
  severity: Severity;
  /** True when a translation proposal makes sense (text leaf with source text). */
  proposable: boolean;
  ruleIds: string[];
  evidence: string[];
  sourceText: string;
  existingText?: string;
  sourceFingerprint: string;
  cmsVersion?: number;
  priority: number;
  priorityRationale: string[];
  /** Derived UI status */
  status: IssueStatus;
}

export type IssueStatus = "missing" | "incomplete" | "stale" | "unpublished" | "resolved";

export interface TranslationProposal {
  id: string;
  /** "translate" (default) or "seo" (a rewrite/generation for an SEO finding). */
  task?: "translate" | "seo";
  ruleId?: string;
  issueId: string;
  unitKey: string;
  pointer: ContentPointer;
  status: ProposalState;
  provenance: "simulated" | "openai";
  sourceText: string;
  existingText?: string;
  suggestedText: string;
  editedText?: string;
  model: string;
  promptVersion: string;
  glossaryVersion?: string;
  inputTokens?: number;
  outputTokens?: number;
  /** Reasoning tokens reported by the provider (already included in outputTokens). */
  reasoningTokens?: number;
  /** Effort actually sent with the request; undefined = model default. */
  reasoningEffort?: string;
  estimatedUsd?: number;
  actualUsd?: number;
  costNote?: string;
  sourceFingerprint: string;
  cmsVersionAtProposal?: number;
  glossaryWarnings: string[];
  placeholderWarnings: string[];
  notes: string[];
  reviewedBy?: string;
  reviewedAt?: string;
  appliedToDemo?: boolean;
  writeError?: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  proposalId: string;
  issueId: string;
  actorId: string;
  action: string;
  previousState: ProposalState;
  nextState: ProposalState;
  comment?: string;
  at: string;
}

// ---------- Schema governance ----------

/** How often a schema path is populated across master-locale entries of its content type. */
export interface FieldUsageRow {
  contentTypeUid: string;
  /** Schema path without instance ids, e.g. `hero.title` or `content.text.text`. */
  path: string;
  filled: number;
  total: number;
}

// ---------- SEO & AI discoverability ----------

export interface SeoTextField {
  path: string;
  text: string;
}

/** Everything the audit needs about one master-locale entry, extracted during the scan (no raw content kept beyond short excerpts). */
export interface SeoFacts {
  id: string; // `${ct}/${uid}`
  contentTypeUid: string;
  contentTypeTitle: string;
  uid: string;
  title: string;
  locale: string;
  // classification (derived from the schema, never from content-type names)
  pageLike: boolean;
  articleLike: boolean;
  faqLike: boolean;
  productLike: boolean;
  // fields: `null` = the schema has no such field; `{text:""}` = field exists but is empty
  metaTitle: SeoTextField | null;
  metaDescription: (SeoTextField & { source: "meta" | "description" }) | null;
  url: SeoTextField | null;
  indexable?: boolean;
  author: { fieldExists: boolean; present: boolean };
  date: { fieldExists: boolean; iso?: string };
  summaryPresent: boolean;
  images: { path: string; hasAltField: boolean; alt?: string }[];
  body: {
    words: number;
    paragraphs: number;
    longestParagraphWords: number;
    headings: number[];
    hasList: boolean;
    genericLinks: string[];
  };
  faq?: { question: string; firstParagraphWords: number; firstSentenceWords: number; answerWords: number };
  sku: boolean;
  /** Short excerpt used as grounding for AI suggestions (only sent with consent). */
  excerpt: string;
}

export type SeoCategory = "seo" | "ai";

export interface SeoFinding {
  id: string;
  ruleId: string;
  category: SeoCategory;
  severity: Severity;
  /** Entry id, or `ct:<uid>` for content-type (schema) findings. */
  entryId: string;
  contentTypeUid: string;
  contentTypeTitle: string;
  entryUid?: string;
  title: string;
  locale: string;
  message: string;
  evidence: string[];
  /** Current value of the field the finding is about, if any. */
  current?: string;
  fieldPath?: string;
  fieldLabel?: string;
  /** AI suggestions exist only for plain text fields. */
  proposable: boolean;
  suggestion?: { kind: "rewrite" | "generate"; target: "meta_title" | "meta_description"; min: number; max: number };
  excerpt?: string;
  penalty: number;
  status: "open" | "resolved";
}

// ---------- Reference graph ----------

export interface GraphNode {
  id: string; // entry: `${ct}/${uid}`, asset: `asset/${uid}`
  kind: "entry" | "asset" | "missing";
  contentTypeUid?: string;
  contentTypeTitle?: string;
  uid: string;
  title: string;
  /** Referenced, but its content type was not (fully) scanned, so existence is unknown. */
  unscanned?: boolean;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  /** Field path in the referencing entry. */
  field: string;
  via: "reference" | "rte" | "asset";
}

export interface ReferenceGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  note?: string;
}

export interface ScanError {
  scope: string;
  message: string;
}

export interface Snapshot {
  mode: DataMode;
  provenance: string; // "LIVE · Contentstack" | "DEMO · Sample fixtures"
  stack: string;
  region: string;
  branch?: string;
  masterLocale: LocaleCode;
  locales: LocaleInfo[];
  contentTypes: { uid: string; title: string; entries: number }[];
  sourceEntryCount: number;
  environment?: string;
  startedAt: string;
  completedAt: string;
  status: "complete" | "partial";
  errors: ScanError[];
  /** Limits applied (e.g. max entries per type), disclosed in the UI. */
  limits: string[];
  units: TranslatableUnit[];
  entryLocales: EntryLocaleState[];
  /** Normalised content type schemas and field fill rates (for schema governance). Absent on older snapshots. */
  schemas?: NormalizedContentType[];
  fieldUsage?: FieldUsageRow[];
  /** Audit facts for master-locale entries. Absent on snapshots created before this feature. */
  seo?: SeoFacts[];
  /** Built from master-locale entries during the scan. Absent on snapshots created before this feature. */
  graph?: ReferenceGraph;
  /** Policy disclosures shown next to coverage numbers. */
  policy: { criticalLocales: string[]; exclusions: string };
}

export interface ScanProgress {
  state: "idle" | "running" | "complete" | "partial" | "failed" | "cancelled";
  phase: string;
  /** 0–100 overall progress across phases. */
  percent?: number;
  done: number;
  total: number;
  startedAt?: string;
  finishedAt?: string;
  errors: ScanError[];
  message?: string;
}

export interface CoverageCell {
  eligible: number;
  complete: number;
  /** null => N/A (eligible = 0), never 100% */
  percent: number | null;
}
