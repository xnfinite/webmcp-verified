/**
 * webmcp-verified — verified, token-lean agent tools for the agentic web.
 *
 * Two properties it adds, on top of any WebMCP/ACP tool surface:
 *
 *  1. GROUNDED, NOT INVENTED. Values come from resolve(args, data) — your
 *     code over a source YOU declare — and off-source questions return a
 *     declared fallback, never an invented figure. The model supplies the
 *     validated arguments, not the answer. One boundary: a resolve that
 *     echoes an agent-supplied arg into the result passes that text through
 *     — the library grounds what it derives from your source (see README).
 *
 *  2. CHEAP FOR THE AGENT (the ICM way). Progressive disclosure: the tool
 *     list an agent reads holds name + one-line description + inputSchema
 *     (that is what defineTool() returns and mount() registers on an
 *     MCP/WebMCP host); the long-form `help` is deferred behind describe_tool
 *     and pulled only for the tool actually used; results are compact. Every
 *     call's output tokens are metered. The bigger DISCOVERY axis — the
 *     descriptions + schemas an agent loads to CHOOSE among ALL tools — is
 *     measured by discoveryCost() / discoveryBreakEven(). Its default
 *     ("served") counts the list this library actually serves, schema
 *     included; its "deferred" mode counts a schema-less list and is an upper
 *     bound that holds only on a host that lets you omit inputSchema from the
 *     list. That is a COST axis: it does not make an agent pick better (see
 *     schemaCollisions/variationCandidates and the README).
 *     discoveryCostOverTurns() carries the same measurement across a session
 *     with prompt caching, where a single-load count overstates the lean win.
 *
 * Dependency-free ESM. Browser (real WebMCP) + Node (tests). Spec shape per
 * the W3C WebMCP draft: registerTool / getTools / executeTool.
 *
 * Hand-authored declarations for the public API of src/index.js (v0.7.0).
 * Every shape here is backed by the runtime behaviour the smoke suite
 * exercises (test/smoke.mjs) — the types make no claim the code does not.
 */

// ---------------------------------------------------------------------------
// Core value types
// ---------------------------------------------------------------------------

/** Which surface a tool answers on. 'customer' (default) redacts internal rows. */
export type Surface = "customer" | "internal";

/** Outcome of a single tool call, as recorded on metrics and receipts. */
export type Outcome = "grounded" | "fallback" | "error";

/**
 * The shape resolve()/onUnknown() return: labelled rows derived from your
 * source. `internal` rows are only ever rendered on an 'internal' surface;
 * a 'customer' surface never even receives them.
 */
export interface Resolved {
  /** Public rows: [label, value]. A numeric value is rendered as money. */
  lines: Array<[string, string | number]>;
  /** Rows shown only on an 'internal' surface. */
  internal?: Array<[string, string | number]>;
  /** Optional leading summary line. */
  summary?: string;
}

/**
 * A minimal JSON Schema for a tool's input. The library requires
 * `type: "object"`; extra JSON-Schema keywords are permitted via the index
 * signature and passed through untouched.
 */
export interface JSONSchema {
  type: "object";
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  [keyword: string]: unknown;
}

/** One property inside a JSONSchema. Only `type` and `enum` are interpreted. */
export interface JSONSchemaProperty {
  /** Interpreted by the input coercion boundary; other values pass through. */
  type?: "string" | "number" | "integer" | "boolean" | "object" | "array" | "null";
  /** If present, args whose coerced value is not in this list are dropped. */
  enum?: ReadonlyArray<string | number | boolean>;
  [keyword: string]: unknown;
}

// ---------------------------------------------------------------------------
// Cheap gauges
// ---------------------------------------------------------------------------

/** Cheap, honest token estimate (~4 chars/token). Not a tokenizer — a gauge. */
export const estimateTokens: (s?: string | null) => number;

/**
 * Content fingerprint (FNV-1a, 32-bit hex). Tamper-EVIDENCE, not a crypto
 * signature: two identical strings hash identically, so a receipt proves
 * "this exact answer, from this exact source state." For legal-grade
 * non-repudiation, hash with crypto.subtle / node:crypto and sign — this is
 * the honest default that runs everywhere with zero dependencies.
 */
export function fingerprint(s?: unknown): string;

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

/** Raw per-tool accumulator held in Metrics.byTool. */
export interface MetricsSlot {
  calls: number;
  grounded: number;
  fallback: number;
  error: number;
  totalMs: number;
  maxMs: number;
  totalTokens: number;
}

/** One tool's line in Metrics.report() — counts and totals, never rounded rates. */
export interface MetricsToolReport {
  calls: number;
  grounded: number;
  fallback: number;
  error: number;
  avgMs: number;
  maxMs: number;
  totalTokens: number;
  avgTokens: number;
}

/** Metrics.report() output, keyed by tool name. */
export type MetricsReport = Record<string, MetricsToolReport>;

/** Performance + cost tracker. One per toolkit; records every call. */
export class Metrics {
  constructor();
  byTool: Map<string, MetricsSlot>;
  now: () => number;
  record(name: string, outcome: Outcome, ms: number, tokens?: number): void;
  /** Counts and totals — never rounded-up rates. */
  report(): MetricsReport;
  reset(): void;
}

// ---------------------------------------------------------------------------
// Audit receipts
// ---------------------------------------------------------------------------

/**
 * The accountability record emitted for every answer: what was returned
 * (fingerprinted), which source it derived from, and the outcome. `sourceHash`
 * is null when the source was not consulted (missing-required or error paths).
 */
export interface Receipt {
  at: number;
  tool: string;
  outcome: Outcome;
  surface: Surface;
  sourceName: string;
  argKeys: string[];
  resultHash: string;
  sourceHash: string | null;
}

/** Where receipts go: an AuditLog, or any function that consumes a Receipt. */
export type AuditSink = AuditLog | ((receipt: Receipt) => void);

/**
 * The accountability layer. Every answer an agent gets can emit a RECEIPT — a
 * timestamped record of what was returned (fingerprinted), which source it
 * derived from, and the outcome. Ring-buffered so it can run in the browser
 * without growing without bound. Pass an AuditLog (or any function) as `audit`
 * to defineTool.
 */
export class AuditLog {
  constructor(cap?: number);
  cap: number;
  entries: Receipt[];
  push(receipt: Receipt): void;
  /** Re-check a stored receipt against a freshly rendered answer + source. */
  verify(receipt: Receipt, answerText: string, sourceSnapshot?: string | object): boolean;
  all(): Receipt[];
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

/**
 * Least-privilege hints the host reads. read-only by default; a tool that
 * mutates state is flagged so the host can require human-in-the-loop
 * confirmation (WebMCP's own control).
 */
export interface ToolAnnotations {
  readOnlyHint: boolean;
  /** Present only when the tool declares `mutates: true`. */
  destructiveHint?: boolean;
}

/** The single text-content shape every reply uses. */
export interface TextContent {
  type: "text";
  text: string;
}

/**
 * The machine-readable half of a reply — values as DATA, not prose to
 * re-parse. `sourced` is true only when the answer came from resolve();
 * `missing` appears when a required field was absent; `error` appears on the
 * error branch. `values` is empty on every non-grounded branch.
 */
export type StructuredContent =
  | { sourced: true; outcome: "grounded"; values: Record<string, string | number> }
  | {
      sourced: false;
      outcome: "fallback";
      values: Record<string, string | number>;
      /** Present when the call was rejected for a missing required field. */
      missing?: string[];
    }
  | { sourced: false; outcome: "error"; error: string; values: Record<string, never> };

/** What a verified tool's execute() resolves to. */
export interface ToolResult {
  content: TextContent[];
  structuredContent: StructuredContent;
  /** true only on the error branch (a readable tool-error the agent can route around). */
  isError?: boolean;
}

/**
 * The minimum a tool needs to appear in the tool list and the discovery
 * metering. Every Tool satisfies it; lighter descriptors can too.
 */
export interface ToolLike {
  name: string;
  description: string;
  /** Part of the served tool list (mount() registers it); not deferred. */
  inputSchema: JSONSchema;
  /** Full detail, kept OUT of the tool list and served on demand via describe_tool. */
  help?: string;
}

/** A verified tool, as returned by defineTool(). */
export interface Tool extends ToolLike {
  /** Lean, agent-facing line: the first sentence of the definition's description. */
  description: string;
  inputSchema: JSONSchema;
  annotations: ToolAnnotations;
  /** Long-form detail, fetched only on demand (never in the manifest line). */
  help: string;
  execute(rawArgs?: unknown): Promise<ToolResult>;
  /** The meter recording this tool's calls (its own, unless a shared one was passed). */
  _metrics: Metrics;
}

/**
 * The definition passed to defineTool(). `TData` is the type your source
 * returns; resolve()/onUnknown() receive the awaited value.
 */
export interface ToolDefinition<TData = any> {
  name: string;
  /** Lean, agent-facing. The FIRST SENTENCE becomes the tool-list line. Min 10 chars. */
  description: string;
  /** JSON Schema, `type: "object"`. Served in the tool list; not deferred. */
  inputSchema: JSONSchema;
  /** The ground truth. May be async; the resolved value is passed to resolve(). */
  source: () => TData | Promise<TData>;
  /** Pure. Return null when the question is not answerable from the source. */
  resolve: (args: Record<string, any>, data: Awaited<TData>) => Resolved | null;
  /** Fallback when resolve() returns null (still derived from the source). */
  onUnknown?: (args: Record<string, any>, data: Awaited<TData>) => Resolved;
  /** 'customer' (default) structurally redacts internal rows. */
  surface?: Surface;
  /** Human-readable source name used in provenance text. */
  sourceName?: string;
  /** 'full' sentence (default) or token-lean "✓ sourced". */
  provenance?: "full" | "compact";
  /** Long-form detail, kept OUT of the tool list and served on demand via describe_tool. */
  help?: string;
  /** Share one meter across a toolkit by passing the same Metrics to every tool. */
  metrics?: Metrics;
  /** Emit a receipt per call to this AuditLog (or function). */
  audit?: AuditSink;
  /** Clock for receipt timestamps (default () => Date.now()). */
  now?: () => number;
  /** true marks the tool not read-only (host may require confirmation). */
  mutates?: boolean;
  /** When mutates is true, sets annotations.destructiveHint. */
  destructive?: boolean;
}

/**
 * Define one verified tool. Every value it returns is produced by resolve()
 * from your declared source; off-source questions return a fallback, never an
 * invented figure.
 */
export function defineTool<TData = any>(def: ToolDefinition<TData>): Tool;

// ---------------------------------------------------------------------------
// Progressive disclosure (the ICM catalog, one layer down)
// ---------------------------------------------------------------------------

/** One entry in the schema-DEFERRED list: name + one-line description, no schema. */
export interface ManifestEntry {
  name: string;
  description: string;
}

/** Options for manifest(). */
export interface ManifestOptions {
  /**
   * false (default): each entry is exactly { name, description }.
   * true: description becomes `<description> (args: a, b?)` — the
   * inputSchema.properties keys in declaration order, required ones plain,
   * optional ones suffixed "?". A tool with no properties is unchanged.
   */
  signatures?: boolean;
}

/**
 * The schema-DEFERRED list: name + one-line description per tool, NO
 * inputSchema. This is NOT what mount() registers — mount() registers the
 * whole tool (name, one-line description, inputSchema, help), and an MCP
 * tools/list or WebMCP getTools() host shows the agent name + one-line +
 * inputSchema. Serve this list only on a host that lets the agent fetch
 * inputSchema on demand. discoveryCost({ list: "deferred" }) meters this
 * shape as an upper bound. On such a host the one-liner does all the
 * disambiguation work; `signatures: true` appends the argument names so
 * look-alike tools stay distinguishable, at a measurable token cost.
 */
export function manifest(tools: ReadonlyArray<ToolLike>, opts?: ManifestOptions): ManifestEntry[];

/**
 * The on-demand describe payload for ONE tool — the exact string describe_tool
 * returns. Single source of truth for both the served text and the metered
 * text, so the measured lean cost equals the real artifact.
 */
export function describeText(tool: {
  name: string;
  help?: string;
  description?: string;
  inputSchema: JSONSchema;
}): string;

/** The describe_tool meta-tool returned by describeTool(). */
export interface DescribeToolTool {
  name: "describe_tool";
  description: string;
  inputSchema: JSONSchema;
  execute(args: { name: string }): Promise<{ content: TextContent[] }>;
}

/**
 * A meta-tool implementing progressive disclosure: an agent calls
 * describe_tool({ name }) to get full detail for one tool, instead of every
 * page load paying for every tool's long description up front.
 */
export function describeTool(tools: ReadonlyArray<ToolLike>): DescribeToolTool;

// ---------------------------------------------------------------------------
// Discovery-axis metering (the headline)
//
// The lean path is: the tool list for all N tools + the describe_tool
// descriptor + the describe payload for the `used` tools. The list mode is the
// only thing the two modes disagree on:
//   "served"   (default) name + one-line + inputSchema — what mount() registers,
//                        so what an MCP/WebMCP host shows the agent; only the
//                        long-form help is deferred. Quote this mode.
//   "deferred"           name + one-line, NO schema (manifest()) — an upper
//                        bound valid only on a host that lets you omit
//                        inputSchema from the list. Standard hosts do not.
// ---------------------------------------------------------------------------

/**
 * What the lean tool list carries. "served" is what this library actually
 * registers; "deferred" is a schema-less upper bound for hosts that allow it.
 */
export type DiscoveryListMode = "served" | "deferred";

/** Options shared by discoveryCost() and discoveryBreakEven(). */
export interface DiscoveryCostOptions {
  /**
   * "served" (default): the list is name + one-line description + inputSchema
   * per tool — what defineTool() returns and mount() registers, i.e. what an
   * MCP tools/list or WebMCP getTools() host shows the agent; only the
   * long-form help is deferred. "deferred": the list is name + one-line with
   * NO schema (the manifest() shape) — an upper bound that holds only on a
   * host that lets you omit inputSchema from the list. Any other value throws.
   */
  list?: DiscoveryListMode;
  /**
   * Deferred mode only: true appends " (args: a, b?)" to each list line (see
   * manifest()), so the cost of keeping look-alike tools apart without a
   * schema is measurable. Ignored in served mode. Default false.
   */
  signatures?: boolean;
  /** Tools the agent describes+calls this visit (default 1, clamped to [0, N]; 0 is accepted). */
  used?: number;
  /** Token gauge (default estimateTokens). */
  estimate?: (s: string) => number;
  /** Naive `description` text (default t.help || t.description). */
  fullText?: (tool: ToolLike) => string;
}

/** A named token count for one tool within a discovery report. */
export interface TokenLine {
  name: string;
  tokens: number;
}

/**
 * The discovery-axis measurement: the descriptions + schemas an agent loads to
 * CHOOSE among tools, before it calls anything. `saved`/`savedPct` compare the
 * naive up-front load against the lean progressive-disclosure load in the
 * chosen list mode. Absolute counts are gauge estimates, not tokenizer-exact;
 * the ratio is robust because both paths use the same gauge. Deterministic:
 * same input → identical output.
 */
export interface DiscoveryReport {
  /** Number of real tools (a describe_tool in the set is filtered out). */
  tools: number;
  used: number;
  /** Name of the gauge function used (or "custom"). */
  gauge: string;
  /** The list mode this report was measured under ("served" unless asked otherwise). */
  list: DiscoveryListMode;
  /** Whether argument signatures were applied to the list (always false in served mode). */
  signatures: boolean;
  naive: {
    total: number;
    perTool: TokenLine[];
  };
  lean: {
    total: number;
    /** Tokens of the tool list in the chosen mode (with schema when served, without when deferred). */
    list: number;
    /** Alias of `list`, kept so earlier callers keep working. */
    manifest: number;
    describeToolDescriptor: number;
    onDemand: number;
    describedTools: TokenLine[];
  };
  saved: number;
  savedPct: number;
  leanWins: boolean;
}

/**
 * THE HEADLINE — meter the DISCOVERY token axis. Measures tokens, not
 * reasoning quality, and is "per discovery" (per context-load of the tool
 * list), NOT per tool call. Defaults to the "served" list mode — the list
 * this library actually registers on a host, schema included.
 */
export function discoveryCost(
  tools: ReadonlyArray<ToolLike>,
  opts?: DiscoveryCostOptions
): DiscoveryReport;

/** One row of the break-even curve: discoveryCost over tools.slice(0, n). */
export interface BreakEvenPoint {
  n: number;
  naive: number;
  lean: number;
  saved: number;
  leanWins: boolean;
}

/** Result of discoveryBreakEven(): where lean first overtakes naive, plus the curve. */
export interface BreakEvenReport {
  /** Smallest n where lean first wins, or null if it never does for this set. */
  n: number | null;
  saved: number;
  /** The list mode the curve was measured under (passed through from opts). */
  list: DiscoveryListMode;
  perN: BreakEvenPoint[];
}

/**
 * The honest few-tools caveat, COMPUTED not asserted. Evaluates discoveryCost
 * on prefixes tools.slice(0, n) for n = 1..N and returns the smallest n where
 * lean first wins, plus the full curve. `opts` (including `list`) is passed
 * through to discoveryCost unchanged.
 */
export function discoveryBreakEven(
  tools: ReadonlyArray<ToolLike>,
  opts?: DiscoveryCostOptions
): BreakEvenReport;

// ---------------------------------------------------------------------------
// Discovery cost over a SESSION, with prompt caching
//
// A static tool list sits in a cached prompt prefix from turn 2 on and is
// cheap to re-read; each deferred describe_tool result arrives once as new
// input and the describe CALL is generated output. A single-load count
// (discoveryCost) therefore overstates the lean win over a session.
// ---------------------------------------------------------------------------

/**
 * Price ratios relative to fresh input = 1. These are PARAMETERS: the defaults
 * { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 } are one vendor's
 * published ratios at the time of writing, not facts about your deployment —
 * pass your vendor's current ratios. `input` is the unit the other three are
 * relative to; no term of the model is priced at `input` itself (the turn-1
 * describe result is charged at cacheWrite, the conservative choice).
 */
export interface CachePrices {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

/** Options for discoveryCostOverTurns(). `list`, `signatures`, `used`, `estimate`, `fullText` are as discoveryCost. */
export interface DiscoveryCostOverTurnsOptions extends DiscoveryCostOptions {
  /** Session length in turns (default 10; integer >= 1, else throws). */
  turns?: number;
  /** Price ratios; a partial object merges over the defaults. See CachePrices. */
  prices?: Partial<CachePrices>;
  /** Output tokens the agent generates to emit ONE describe_tool call (default 20). */
  describeCallTokens?: number;
  /**
   * true: the list is re-sent fresh every turn — both sides pay cacheWrite
   * every turn instead of cacheRead. Models a client that re-lists on every
   * tools/list_changed, or a design that mutates tools/list between turns.
   * Default false. This library's lean path never changes tools/list.
   */
  rebuildListEveryTurn?: boolean;
}

/** One turn of the session: this turn's cost and the running total, in fresh-input-token units. */
export interface DiscoveryTurnRow {
  turn: number;
  naive: number;
  lean: number;
  cumulativeNaive: number;
  cumulativeLean: number;
}

/** A naive-vs-lean pair with its saving; savedPct is an integer percent of naive. */
export interface DiscoverySessionCost {
  naive: number;
  lean: number;
  saved: number;
  savedPct: number;
}

/**
 * Result of discoveryCostOverTurns(). Every option is echoed so a printed
 * report says which parameters produced it. Nothing is rounded except savedPct.
 */
export interface DiscoveryOverTurnsReport {
  turns: number;
  used: number;
  list: DiscoveryListMode;
  signatures: boolean;
  /** The merged price ratios the report was computed with. */
  prices: CachePrices;
  describeCallTokens: number;
  rebuildListEveryTurn: boolean;
  /**
   * The raw token counts the model was fed, all from discoveryCost() in the
   * same mode: the naive list, the lean list (list + describe_tool descriptor)
   * and the sum of the describe results for the `used` tools.
   */
  tokens: { naiveList: number; leanList: number; describeResults: number };
  perTurn: DiscoveryTurnRow[];
  /** Cumulative over the whole session. */
  total: DiscoverySessionCost;
  /** Turn 1 alone: the cache write plus every describe. */
  turn1: DiscoverySessionCost;
  /** The per-turn cost from turn 2 on. */
  steadyState: { naivePerTurn: number; leanPerTurn: number };
  /**
   * The earliest turn at which cumulativeLean >= cumulativeNaive — the turn
   * the lean path stops being cheaper over the session — or null when it is
   * cheaper on every turn of the session.
   */
  crossoverTurn: number | null;
}

/**
 * The discovery cost over a session of `turns` turns with the tool list in a
 * cached prompt prefix. NAIVE: turn 1 = naiveList × cacheWrite, then
 * naiveList × cacheRead per turn. LEAN: turn 1 = leanList × cacheWrite +
 * Σ over the used tools of (describeCallTokens × output + describeText ×
 * cacheWrite), then (leanList + Σ describeText) × cacheRead per turn. All
 * describes are assumed on turn 1 — the conservative case for lean, since
 * their results are then re-read on every later turn. Token counts come from
 * discoveryCost() in the same mode (one source of truth). The price defaults
 * are parameters — see CachePrices.
 */
export function discoveryCostOverTurns(
  tools: ReadonlyArray<ToolLike>,
  opts?: DiscoveryCostOverTurnsOptions
): DiscoveryOverTurnsReport;

// ---------------------------------------------------------------------------
// Surface analysis — which tools an agent can't tell apart
// ---------------------------------------------------------------------------

/**
 * A canonical string for a tool's input shape (sorted prop:type + required).
 * Two tools with the same signature are indistinguishable by their arguments
 * at call time, whatever their descriptions say.
 */
export function schemaSignature(tool: { inputSchema?: JSONSchema }): string;

/** A group of 2+ tools sharing an identical input-schema signature. */
export interface SchemaCollision {
  signature: string;
  tools: string[];
}

/**
 * Which tools an agent CAN'T tell apart: groups of 2+ tools with an identical
 * input-schema shape. As a surface grows, mis-selection is driven by overlap,
 * not count. A design check, separate from discoveryCost (tokens, not
 * disambiguation). Empty when every schema is distinct.
 */
export function schemaCollisions(tools: ReadonlyArray<ToolLike>): SchemaCollision[];

// ---------------------------------------------------------------------------
// Disambiguation axis, part two — variations that could have been parameters
//
// A HEURISTIC. It SUGGESTS candidates for a human design decision; it does not
// detect duplication, does not read semantics, and guarantees nothing.
// ---------------------------------------------------------------------------

/** How a variant's input relates to its base's: exact superset, or one property short. */
export type VariationRelation = "superset" | "near-superset";

/** One tool that looks like a variation of the family's base. */
export interface VariationVariant {
  name: string;
  /** "near-superset" means it drops one of the base's OPTIONAL properties. */
  relation: VariationRelation;
  /** The common input core. Never empty — a shared core is a required signal. */
  sharedProps: string[];
  /** What this variant adds: the candidate parameter(s) a merged tool would take. */
  addedProps: string[];
  /** Base properties it does not accept (length <= 1; always [] under strict). */
  missingProps: string[];
  /**
   * Corroboration from the OTHER check, reported not gating: true when base and
   * variant share an identical schemaSignature, i.e. schemaCollisions reports
   * this pair as well.
   */
  sameSchemaSignature: boolean;
}

/** One base tool and the tools whose name and input both nest around it. */
export interface VariationFamily {
  /** The tool whose name words and input the others extend. */
  base: string;
  /** The base's name words, space-joined — e.g. "get review". */
  stem: string;
  /** [base, ...variant names], sorted. Same field name as SchemaCollision.tools. */
  tools: string[];
  /** Union of every variant's addedProps — the parameters one merged tool would take. */
  candidateParams: string[];
  variants: VariationVariant[];
}

/**
 * The report from variationCandidates(). Self-describing: it echoes the gate it
 * ran under so a printed report says which setting produced it.
 */
export interface VariationReport {
  /** Number of tools considered (a describe_tool in the set is ignored). */
  tools: number;
  /** Echoed back: true = exact-superset only (divergence tolerance 0). */
  strict: boolean;
  families: VariationFamily[];
  /**
   * Unique tool names appearing in >= 1 family, sorted. `involved.length /
   * tools` is the closest a static check gets to "how many of those twelve
   * answer questions a human would phrase the same way" — as a count of
   * QUESTIONS RAISED, never a defect rate, a score, or a verdict.
   */
  involved: string[];
}

/**
 * A HEURISTIC that SUGGESTS tools which might be one tool with a parameter.
 * It fires only when two independent syntactic signals agree: the base's name
 * WORDS are a proper subset of the variant's, AND the variant can accept the
 * base's input (non-empty shared core, at most one optional property dropped,
 * no required property dropped).
 *
 * It reads a tool's NAME and INPUT-SCHEMA SHAPE and nothing else. It cannot see
 * what a tool returns or means, so it cannot know whether two tools answer the
 * same question; it is synonym-blind by construction; it cannot tell a qualifier
 * that names a different OBJECT (create_user_group) from one that names a FILTER
 * (get_recent_reviews); and it says NOTHING about tool-selection accuracy.
 *
 * An empty result means these two signals did not fire on these names and
 * schemas — not that a surface is well designed. Untested, not missing.
 *
 * Deterministic: same input → identical output, whatever the input order.
 */
export function variationCandidates(
  tools: ReadonlyArray<ToolLike>,
  opts?: { strict?: boolean }
): VariationReport;

// ---------------------------------------------------------------------------
// Mounting on a host
// ---------------------------------------------------------------------------

/** A WebMCP host (document.modelContext) or any object exposing registerTool. */
export interface RegisterToolHost {
  registerTool(tool: Tool, opts?: unknown): { unregister?(): void } | void;
}

/** What mount() returns: the count, the shared meter (if any), and an unregister. */
export interface MountResult {
  count: number;
  /** The first tool's meter, or undefined when no tools were mounted. */
  metrics: Metrics | undefined;
  unregister(): void;
}

/** Register tools with a WebMCP host (document.modelContext) or any registerTool host. */
export function mount(
  host: RegisterToolHost,
  tools: ReadonlyArray<Tool>,
  opts?: unknown
): MountResult;

// ---------------------------------------------------------------------------

/** The library version (currently "0.7.0"). */
export const version: string;
