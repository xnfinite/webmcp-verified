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
 *     call's output tokens are metered, so you can prove the per-call cost —
 *     counts, not rounded rates. The bigger DISCOVERY axis — the descriptions
 *     + schemas an agent loads to CHOOSE among ALL tools — is measured by
 *     discoveryCost()/discoveryBreakEven(). Its default ("served") counts the
 *     list this library actually serves, schema included; its "deferred"
 *     mode counts a schema-less list and is an upper bound that holds only
 *     on a host that lets you omit inputSchema from the list.
 *     discoveryCostOverTurns() carries the same measurement across a session
 *     with prompt caching, where a single-load count overstates the lean win.
 *
 * Dependency-free ESM. Browser (real WebMCP) + Node (tests). Spec shape per
 * the W3C WebMCP draft: registerTool / getTools / executeTool.
 */

/** @typedef {'customer'|'internal'} Surface */
/** @typedef {{lines:Array<[string,string|number]>, internal?:Array<[string,string|number]>, summary?:string}} Resolved */

function assert(c, m) { if (!c) throw new Error("webmcp-verified: " + m); }
const money = (n) => (typeof n === "number" ? "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(n));

/** Cheap, honest token estimate (~4 chars/token). Not a tokenizer — a gauge. */
export const estimateTokens = (s) => Math.ceil((s || "").length / 4);

/**
 * Content fingerprint (FNV-1a, 32-bit hex). Tamper-EVIDENCE, not a crypto
 * signature: two identical strings hash identically, so a receipt proves
 * "this exact answer, from this exact source state." For legal-grade
 * non-repudiation, hash with crypto.subtle / node:crypto and sign — this is
 * the honest default that runs everywhere with zero dependencies.
 */
export function fingerprint(s) {
  let h = 0x811c9dc5 >>> 0; s = String(s == null ? "" : s);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

/** First sentence of a description — the lean, agent-facing form. */
const oneLine = (s) => { const m = /^(.*?[.!?])(\s|$)/.exec(s || ""); return (m ? m[1] : s || "").trim(); };

function render(resolved, surface, provenance) {
  const rows = [];
  if (resolved.summary) rows.push(resolved.summary);
  for (const [k, v] of resolved.lines || []) rows.push(`${k}: ${typeof v === "number" ? money(v) : v}`);
  if (surface === "internal") for (const [k, v] of resolved.internal || []) rows.push(`[internal] ${k}: ${typeof v === "number" ? money(v) : v}`);
  return rows.join("\n") + (provenance ? "\n" + provenance : "");
}

/**
 * Hard input boundary. The agent's args are untrusted: coerce each declared
 * property to its schema type, enforce enums, and DROP anything not in the
 * schema — so no unexpected/injected field ever reaches resolve(). A missing
 * required field is reported, never guessed around.
 */
function coerce(v, type) {
  if (v == null) return undefined;
  switch (type) {
    case "number": { const n = Number(v); return Number.isFinite(n) ? n : undefined; }
    case "integer": { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : undefined; }
    case "boolean": return typeof v === "boolean" ? v : v === "true" ? true : v === "false" ? false : undefined;
    case "string": return typeof v === "object" ? undefined : String(v);
    default: return v;
  }
}
function validateArgs(args, schema) {
  const props = (schema && schema.properties) || {};
  const clean = {};
  const a = args && typeof args === "object" ? args : {};
  for (const k of Object.keys(props)) {
    if (!(k in a)) continue;
    const c = coerce(a[k], props[k].type);
    if (c === undefined) continue;
    if (props[k].enum && !props[k].enum.includes(c)) continue;  // reject out-of-enum
    clean[k] = c;
  }
  const missing = (schema.required || []).filter((r) => !(r in clean));
  return { clean, missing };
}

/** Performance + cost tracker. One per toolkit; records every call. */
export class Metrics {
  constructor() { this.byTool = new Map(); this.now = () => (typeof performance !== "undefined" ? performance.now() : Date.now()); }
  _slot(n) { if (!this.byTool.has(n)) this.byTool.set(n, { calls: 0, grounded: 0, fallback: 0, error: 0, totalMs: 0, maxMs: 0, totalTokens: 0 }); return this.byTool.get(n); }
  record(name, outcome, ms, tokens) { const s = this._slot(name); s.calls++; s[outcome] = (s[outcome] || 0) + 1; s.totalMs += ms; s.maxMs = Math.max(s.maxMs, ms); s.totalTokens += tokens || 0; }
  /** Counts and totals — never rounded-up rates. */
  report() {
    const out = {};
    for (const [n, s] of this.byTool) out[n] = { calls: s.calls, grounded: s.grounded, fallback: s.fallback, error: s.error,
      avgMs: s.calls ? +(s.totalMs / s.calls).toFixed(1) : 0, maxMs: +s.maxMs.toFixed(1),
      totalTokens: s.totalTokens, avgTokens: s.calls ? Math.round(s.totalTokens / s.calls) : 0 };
    return out;
  }
  reset() { this.byTool.clear(); }
}

/**
 * The accountability layer. Every answer an agent gets can emit a RECEIPT —
 * a timestamped record of what was returned (fingerprinted), which source it
 * derived from, and the outcome. This is the proof a business produces in a
 * dispute: "here is exactly what our AI told the customer, and that it came
 * from our data, not invention." The security research is blunt that logging
 * the LLM's reply alone is useless for forensics; this logs provenance.
 *
 * Pass an AuditLog (or any function) as `audit` to defineTool. Ring-buffered
 * so it can run in the browser without growing without bound.
 */
export class AuditLog {
  constructor(cap = 1000) { this.cap = cap; this.entries = []; }
  push(receipt) { this.entries.push(receipt); if (this.entries.length > this.cap) this.entries.shift(); }
  /** Re-check a stored receipt against a freshly rendered answer + source. */
  verify(receipt, answerText, sourceSnapshot) {
    return receipt.resultHash === fingerprint(answerText) &&
      (sourceSnapshot === undefined || receipt.sourceHash === fingerprint(typeof sourceSnapshot === "string" ? sourceSnapshot : JSON.stringify(sourceSnapshot)));
  }
  all() { return this.entries.slice(); }
}

/**
 * Define one verified tool.
 * @param {Object} def
 * @param {string} def.name
 * @param {string} def.description       lean, agent-facing (first sentence is the tool-list line)
 * @param {Object} def.inputSchema       JSON Schema, type:"object" — part of the served tool list, not deferred
 * @param {()=>any} def.source           the ground truth
 * @param {(args,data)=>(Resolved|null)} def.resolve   pure; null = not answerable from source
 * @param {(args,data)=>Resolved} [def.onUnknown]      fallback (still from source)
 * @param {Surface} [def.surface]        'customer' (default) redacts internal rows
 * @param {string} [def.sourceName]
 * @param {'full'|'compact'} [def.provenance]  'full' sentence (default) or token-lean "✓ sourced"
 * @param {string} [def.help]            long-form detail, kept OUT of the tool list; served on demand via describe_tool
 * @param {Metrics} [def.metrics]
 */
export function defineTool(def) {
  assert(def && typeof def.name === "string" && def.name, "name is required");
  assert(typeof def.description === "string" && def.description.trim().length >= 10, `tool "${def.name}": description must be a real sentence (agents pick tools by it)`);
  assert(def.inputSchema && def.inputSchema.type === "object", `tool "${def.name}": inputSchema must be a typed object`);
  assert(typeof def.source === "function", `tool "${def.name}": source() required`);
  assert(typeof def.resolve === "function", `tool "${def.name}": resolve() required`);
  const surface = def.surface || "customer";
  // Each tool gets its OWN meter when none is passed. (Was a process-global
  // singleton on defineTool._m, which bled calls/tokens/outcomes between
  // unrelated tools — corrupting the "measured, not claimed" metering for the
  // default usage. Callers wanting one shared meter across a toolkit pass an
  // explicit `metrics:` to every tool.)
  const metrics = def.metrics || new Metrics();
  const sourceName = def.sourceName || "the declared source";
  const provStyle = def.provenance || "full";
  const auditSink = typeof def.audit === "function" ? def.audit : (def.audit && typeof def.audit.push === "function" ? (r) => def.audit.push(r) : null);
  const clock = def.now || (() => Date.now());

  // Least privilege: our tools compute from a source and are read-only by
  // default. A tool that changes state must say so — the host uses this to
  // require human-in-the-loop confirmation (WebMCP's own control).
  const annotations = { readOnlyHint: def.mutates !== true, ...(def.mutates === true ? { destructiveHint: !!def.destructive } : {}) };

  const tool = {
    name: def.name,
    description: oneLine(def.description),          // lean by default — token discipline
    inputSchema: def.inputSchema,
    annotations,
    help: def.help || def.description,             // full detail, fetched only on demand
    async execute(rawArgs) {
      const t0 = metrics.now();
      let clean;
      try {
        // hard input boundary BEFORE any source/resolve runs
        const v = validateArgs(rawArgs, def.inputSchema);
        clean = v.clean;
        if (v.missing.length) {
          // Input-validation rejection is still a real answer: it must meter
          // its own tokens and emit a receipt like any other reply (README:
          // "every answer emits a receipt"). sourceHash is null on purpose —
          // validation runs BEFORE def.source(), so no source was consulted;
          // the receipt says so rather than fabricating a source hash.
          const text = `Missing required field(s): ${v.missing.join(", ")}. No value returned.`;
          metrics.record(def.name, "fallback", metrics.now() - t0, estimateTokens(text));
          if (auditSink) auditSink({ at: clock(), tool: def.name, outcome: "fallback", surface, sourceName,
            argKeys: Object.keys(clean), resultHash: fingerprint(text), sourceHash: null });
          return { content: [{ type: "text", text }],
            structuredContent: { sourced: false, outcome: "fallback", missing: v.missing, values: {} } };
        }
        const data = await def.source();
        let resolved = def.resolve(clean, data), outcome = "grounded";
        if (resolved == null) { outcome = "fallback"; resolved = def.onUnknown ? def.onUnknown(clean, data) : { summary: "No estimate — outside the source data; this tool does not guess.", lines: [] }; }
        // structural redaction: customer surface never even receives internal rows
        const shown = surface === "internal" ? resolved : { summary: resolved.summary, lines: resolved.lines };
        // Provenance names WHERE the answer is sourced. It deliberately does
        // NOT assert "nothing generated by the agent": resolve() is developer
        // code, and a resolve that echoes an agent arg would put agent text on
        // the surface. We name the source; we don't claim the impossible.
        const prov = provStyle === "compact"
          ? (outcome === "grounded" ? "✓ sourced" : "✓ fallback (no guess)")
          : (outcome === "grounded" ? `Answer derives from ${sourceName}.` : `Outside ${sourceName}. Returned a fallback, not a guessed value.`);
        const text = render(shown, surface, prov);
        metrics.record(def.name, outcome, metrics.now() - t0, estimateTokens(text));
        if (auditSink) auditSink({ at: clock(), tool: def.name, outcome, surface, sourceName,
          argKeys: Object.keys(clean), resultHash: fingerprint(text), sourceHash: fingerprint(typeof data === "string" ? data : JSON.stringify(data)) });
        // structuredContent: give the agent the values as DATA, not prose to
        // re-parse. The text stays human-readable; the agent reads this.
        return { content: [{ type: "text", text }],
          structuredContent: { sourced: outcome === "grounded", outcome,
            values: Object.fromEntries((shown.lines || []).map(([k, v]) => [k, v])) } };
      } catch (e) {
        // Return an actionable tool-error result the agent can READ and route
        // around (isError:true), instead of throwing a transport-level error
        // that breaks its plan. sourceHash is null: on failure we can't know
        // the source state. The harness treats isError as a journey failure.
        const text = `Tool error: ${e && e.message ? e.message : String(e)}. No value returned.`;
        metrics.record(def.name, "error", metrics.now() - t0, estimateTokens(text));
        if (auditSink) auditSink({ at: clock(), tool: def.name, outcome: "error", surface, sourceName,
          argKeys: clean ? Object.keys(clean) : [], resultHash: fingerprint(text), sourceHash: null });
        return { content: [{ type: "text", text }], isError: true,
          structuredContent: { sourced: false, outcome: "error", error: text, values: {} } };
      }
    },
    _metrics: metrics
  };
  return tool;
}

/**
 * The schema-DEFERRED list: name + one-line description per tool, NO
 * inputSchema. This is NOT what mount() registers — mount() registers the
 * whole tool (name, one-line description, inputSchema, help), and an MCP
 * tools/list or WebMCP getTools() host shows the agent name + one-line +
 * inputSchema. Serve this list only on a host that lets the agent fetch
 * inputSchema on demand; on a standard host the schema is in the list.
 * discoveryCost({ list: "deferred" }) meters this shape as an upper bound.
 *
 * On such a host the one-liner is doing all the disambiguation work, so
 * `signatures: true` appends the argument names to each line — a practitioner
 * on r/mcp asked for exactly this (2026-09-02) so look-alike tools stay
 * distinguishable without the schema. Its token cost is measurable:
 * discoveryCost({ list: "deferred", signatures: true }).
 *
 * @param {Array} tools
 * @param {{signatures?:boolean}} [opts]
 *        signatures  false (default): each entry is exactly { name, description }.
 *                    true: description becomes `<description> (args: a, b?)` —
 *                    inputSchema.properties keys in declaration order, required
 *                    ones plain, optional ones suffixed "?". A tool with no
 *                    properties is unchanged.
 * @returns {Array<{name:string, description:string}>}
 */
export function manifest(tools, opts = {}) {
  const signatures = !!opts && opts.signatures === true;
  return tools.map((t) => ({ name: t.name, description: signatures ? withSignature(t) : t.description }));
}

/**
 * `<description> (args: a, b?)` — property keys in declaration order, "?"
 * marks a property not listed in `required`. A tool with no properties gets
 * its description back unchanged. Module-private; manifest() is the API.
 */
function withSignature(t) {
  const keys = Object.keys(schemaProps(t));
  if (keys.length === 0) return t.description;
  const req = new Set(schemaRequired(t));
  return `${t.description} (args: ${keys.map((k) => (req.has(k) ? k : k + "?")).join(", ")})`;
}

/**
 * The on-demand describe payload for ONE tool — the exact string
 * describe_tool returns. Extracted so the measured lean on-demand cost
 * (discoveryCost) EQUALS the real artifact with no format drift: this is the
 * single source of truth for both the served text and the metered text.
 * @param {{name:string, help?:string, description?:string, inputSchema:object}} tool
 * @returns {string}
 */
export function describeText(tool) {
  return `${tool.name}\n${tool.help || tool.description || ""}\nInput: ${JSON.stringify(tool.inputSchema)}`;
}

/**
 * A meta-tool implementing progressive disclosure: an agent calls
 * describe_tool({name}) to get full detail for one tool, instead of every
 * page load paying for every tool's long description up front.
 */
export function describeTool(tools) {
  const byName = new Map(tools.map((t) => [t.name, t]));
  return {
    name: "describe_tool",
    description: "Get the full description and input schema for one named tool. Call this only when you need detail beyond the manifest.",
    inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    async execute({ name }) {
      const t = byName.get(name);
      const text = t ? describeText(t) : `No tool named "${name}". Available: ${[...byName.keys()].join(", ")}.`;
      return { content: [{ type: "text", text }] };
    }
  };
}

/**
 * THE HEADLINE — meter the DISCOVERY token axis: the descriptions + schemas
 * an agent loads to CHOOSE among tools, before it calls anything.
 *
 * NAIVE path = what a generic MCP/WebMCP surface forces up front: the result
 * of tools/list (MCP) / navigator.modelContext.getTools() (WebMCP) — a FULL
 * Tool descriptor { name, description, inputSchema } for EVERY registered
 * tool, with the LONG-FORM description in the list, all resident at once.
 * Base MCP has no lazy/paged descriptor fetch.
 *
 * LEAN path = this library's progressive disclosure: the tool list for all N
 * tools + the fixed describe_tool descriptor + the full describe payload for
 * only the `used` tools the agent actually pulls. What the list holds is the
 * `opts.list` choice, and it is the whole difference between the two modes:
 *
 *   "served" (DEFAULT) — { name, one-line description, inputSchema } per tool.
 *     This is what defineTool() returns and what mount() registers, so it is
 *     the list an MCP tools/list or WebMCP getTools() host actually shows an
 *     agent. The ONLY thing deferred behind describe_tool is the long-form
 *     `help`. This is the mode to quote for a standard host.
 *   "deferred" — { name, one-line description } per tool, NO schema (the
 *     manifest() shape). An UPPER BOUND: it holds only on a host that lets
 *     you omit inputSchema from the list and fetch it on demand. Standard
 *     MCP/WebMCP hosts do not, and lazy-loading schemas is what practitioners
 *     on r/mcp report causes tools/list_changed churn.
 *
 * Nothing else differs between the modes: the naive side, the describe_tool
 * descriptor and the on-demand payload are identical, so served − deferred is
 * exactly the schema payload inside the list's JSON layout.
 *
 * Both paths are serialized identically (canonical JSON.stringify) and counted
 * with the SAME gauge, so `savedPct` and the break-even are robust to the ~4-
 * char approximation (the factor cancels in the ratio). ABSOLUTE counts are
 * gauge estimates, not tokenizer-exact. It measures tokens, not reasoning
 * quality, and is "per discovery" = per context-load of the tool list (per
 * session/page), NOT per tool call. Deterministic and dependency-free: same
 * input → byte-identical output.
 *
 * @param {Array} tools  the real tool set (a `describe_tool` in it is filtered
 *                       out to avoid double-counting the meta-tool overhead)
 * @param {{list?:'served'|'deferred', signatures?:boolean, used?:number, estimate?:(s:string)=>number, fullText?:(t:any)=>string}} [opts]
 *        list       "served" (default): the list carries inputSchema, as mount()
 *                   registers it. "deferred": schema-less list; upper bound for a
 *                   host that lets you omit inputSchema from the list.
 *        signatures deferred mode only: true appends " (args: a, b?)" to each
 *                   list line (see manifest()), so the cost of keeping look-alike
 *                   tools apart without a schema is measurable. Ignored in served
 *                   mode, where the schema is already in the list. Default false.
 *        used       tools the agent describes+calls this visit (default 1, clamped to [0,N])
 *        estimate   token gauge (default estimateTokens)
 *        fullText   naive `description` text (default t.help||t.description — the
 *                   full explanation you'd otherwise ship with no help split)
 * @returns {{tools:number, used:number, gauge:string, list:'served'|'deferred', signatures:boolean,
 *   naive:{total:number, perTool:Array<{name:string,tokens:number}>},
 *   lean:{total:number, list:number, manifest:number, describeToolDescriptor:number, onDemand:number, describedTools:Array<{name:string,tokens:number}>},
 *   saved:number, savedPct:number, leanWins:boolean}}
 *   lean.list is the tokens of the list in the chosen mode; lean.manifest is
 *   an alias of lean.list kept so earlier callers keep working. `signatures`
 *   echoes whether argument signatures were applied to the list (always false
 *   in served mode).
 */
export function discoveryCost(tools, opts = {}) {
  const estimate = opts.estimate || estimateTokens;
  const fullText = opts.fullText || ((t) => t.help || t.description || "");
  const list = opts.list == null ? "served" : opts.list;
  assert(list === "served" || list === "deferred", `discoveryCost: opts.list must be "served" or "deferred", got ${JSON.stringify(opts.list)}`);
  const signatures = list === "deferred" && opts.signatures === true;
  const real = (tools || []).filter((t) => t && t.name !== "describe_tool");
  const N = real.length;
  let used = opts.used == null ? 1 : opts.used;
  used = Math.max(0, Math.min(used, N));

  // NAIVE: every tool's full descriptor (long-form text + schema), resident up front.
  const perTool = real.map((t) => ({
    name: t.name,
    tokens: estimate(JSON.stringify({ name: t.name, description: fullText(t), inputSchema: t.inputSchema }))
  }));
  const naiveTotal = perTool.reduce((a, p) => a + p.tokens, 0);

  // LEAN: the tool list (all N) + fixed describe_tool descriptor + full
  // describe payload for only the `used` tools. The list is the only term
  // that depends on the mode.
  //   served   — name + one-line + inputSchema: what mount() registers.
  //   deferred — name + one-line, no schema: manifest(); an upper bound.
  //              With signatures, each line also carries " (args: a, b?)".
  const listTokens = list === "served"
    ? estimate(JSON.stringify(real.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }))))
    : estimate(JSON.stringify(manifest(real, { signatures })));
  const dt = describeTool(real);
  const describeToolDescriptor = estimate(JSON.stringify({ name: dt.name, description: dt.description, inputSchema: dt.inputSchema }));
  const describedTools = real.slice(0, used).map((t) => ({ name: t.name, tokens: estimate(describeText(t)) }));
  const onDemand = describedTools.reduce((a, d) => a + d.tokens, 0);
  const leanTotal = listTokens + describeToolDescriptor + onDemand;

  const saved = naiveTotal - leanTotal;
  const savedPct = naiveTotal === 0 ? 0 : Math.round((saved / naiveTotal) * 100);
  return {
    tools: N, used, gauge: estimate.name || "custom", list, signatures,
    naive: { total: naiveTotal, perTool },
    // `manifest` is an alias of `list`, kept so earlier callers keep working.
    lean: { total: leanTotal, list: listTokens, manifest: listTokens, describeToolDescriptor, onDemand, describedTools },
    saved, savedPct, leanWins: saved > 0
  };
}

/**
 * The honest few-tools caveat, COMPUTED not asserted. Evaluates discoveryCost
 * on prefixes tools.slice(0,n) for n=1..N and returns the smallest n where
 * lean first wins, plus the full curve — the reproducible "where the line is"
 * number. Lean loses at few tools (the describe_tool round-trip costs more
 * than it saves); this reports exactly where it flips for a given set. `opts`
 * (including `list`) is passed through to discoveryCost unchanged, and the
 * mode it ran under is echoed back as `list`.
 * @returns {{n:number|null, saved:number, list:'served'|'deferred', perN:Array<{n:number,naive:number,lean:number,saved:number,leanWins:boolean}>}}
 */
export function discoveryBreakEven(tools, opts = {}) {
  const real = (tools || []).filter((t) => t && t.name !== "describe_tool");
  const N = real.length;
  const perN = [];
  let firstWin = null;
  let list = opts.list == null ? "served" : opts.list;
  for (let n = 1; n <= N; n++) {
    const c = discoveryCost(real.slice(0, n), opts);  // used clamps to n inside
    list = c.list;
    perN.push({ n, naive: c.naive.total, lean: c.lean.total, saved: c.saved, leanWins: c.leanWins });
    if (firstWin === null && c.leanWins) firstWin = n;
  }
  const saved = firstWin !== null ? perN[firstWin - 1].saved : (perN.length ? perN[perN.length - 1].saved : 0);
  return { n: firstWin, saved, list, perN };
}

/**
 * Default price ratios for discoveryCostOverTurns — PARAMETERS, not facts.
 * One vendor's published ratios at the time of writing, relative to fresh
 * input = 1. Pass `prices` to override; a partial object merges over these.
 */
const DEFAULT_CACHE_PRICES = Object.freeze({ input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 });

/**
 * The discovery cost over a SESSION, with prompt caching. Practitioners on
 * r/mcp pointed out (2026-09-02) that a static tool list sits in a cached
 * prompt prefix from turn 2 on and is cheap to re-read, while every deferred
 * describe_tool result arrives once as new input and the describe CALL itself
 * is generated output. A single-load token count (discoveryCost) therefore
 * OVERSTATES the lean win over a session. This returns the session figure.
 *
 * THE MODEL, in words. A session is T turns. On every turn the whole tool
 * list is in the prompt prefix. Prices are ratios relative to fresh input = 1,
 * so every cost below is in fresh-input-token units (tokens × price).
 *
 *   NAIVE  turn 1      = naiveList × cacheWrite
 *          turns 2..T  = naiveList × cacheRead                      (each turn)
 *   LEAN   turn 1      = leanList × cacheWrite
 *                      + Σ over the `used` tools of
 *                          describeCallTokens × output + describeText(tool) × cacheWrite
 *          turns 2..T  = (leanList + Σ describeText(tool)) × cacheRead   (each turn)
 *
 * where naiveList = discoveryCost().naive.total (every tool's full descriptor),
 * leanList = discoveryCost().lean.list + lean.describeToolDescriptor (the list
 * in the chosen mode plus the describe_tool descriptor registered beside the
 * tools), and describeText(tool) is the exact describe_tool result for each
 * used tool (lean.describedTools). Every token count comes from discoveryCost()
 * in the same mode, so there is one source of truth.
 *
 * With rebuildListEveryTurn the prefix is re-sent fresh on every turn: both
 * sides pay cacheWrite every turn instead of cacheRead. That models a client
 * that re-lists on every tools/list_changed notification, or a design that
 * mutates tools/list between turns (lazy-loading schemas does). This library's
 * lean path does neither: describe_tool returns a RESULT and never
 * re-registers anything, so tools/list is unchanged across the session
 * (smoke test T50 pins this).
 *
 * CONSERVATIVE ASSUMPTIONS — each one costs the lean path, none costs naive:
 *   - All `used` describes happen on turn 1, so their results sit in the cached
 *     history and are re-read on every later turn — the largest number of
 *     turns they could be paid for. Describing later in the session costs less.
 *   - A describe result is charged at cacheWrite on turn 1 (it becomes part of
 *     the cached history from turn 2), not at the fresh-input price — the
 *     dearer of the two whenever cacheWrite >= input.
 *   - User turns, answers and the tool calls themselves are identical on both
 *     paths and are excluded from both.
 * Not modelled, and in lean's favour: the extra request a describe_tool
 * round-trip adds inside turn 1 (it re-reads the prefix at cacheRead), and the
 * cached re-read of the describe call's own tokens on later turns. Both are
 * small; state them if you quote a figure to a decimal.
 *
 * THE PRICES ARE PARAMETERS. The defaults { input: 1, output: 5,
 * cacheWrite: 1.25, cacheRead: 0.1 } are one vendor's published ratios at the
 * time of writing, relative to fresh input = 1. They are not facts about your
 * deployment: pass `prices` with your vendor's current ratios (a partial object
 * merges over the defaults). `input` is the unit the other three are relative
 * to; no term of the model is priced at `input` itself, because the turn-1
 * describe result is charged at cacheWrite (see above).
 *
 * Deterministic and dependency-free. Nothing is rounded except savedPct.
 *
 * @param {Array} tools  the real tool set (a describe_tool in it is filtered out)
 * @param {{turns?:number, used?:number, list?:'served'|'deferred', signatures?:boolean,
 *   prices?:{input?:number, output?:number, cacheWrite?:number, cacheRead?:number},
 *   describeCallTokens?:number, rebuildListEveryTurn?:boolean,
 *   estimate?:(s:string)=>number, fullText?:(t:any)=>string}} [opts]
 *        turns                session length in turns (default 10; integer >= 1)
 *        used                 tools described over the session (default 1; clamped to [0, N])
 *        list                 "served" (default) | "deferred", as discoveryCost
 *        signatures           passed to manifest() in deferred mode (default false)
 *        prices               price ratios relative to fresh input = 1 (see above)
 *        describeCallTokens   output tokens the agent generates to emit ONE
 *                             describe_tool call (default 20)
 *        rebuildListEveryTurn true: the list is re-sent fresh every turn (default false)
 *        estimate, fullText   as discoveryCost
 * @returns {{turns:number, used:number, list:'served'|'deferred', signatures:boolean,
 *   prices:{input:number, output:number, cacheWrite:number, cacheRead:number},
 *   describeCallTokens:number, rebuildListEveryTurn:boolean,
 *   tokens:{naiveList:number, leanList:number, describeResults:number},
 *   perTurn:Array<{turn:number, naive:number, lean:number, cumulativeNaive:number, cumulativeLean:number}>,
 *   total:{naive:number, lean:number, saved:number, savedPct:number},
 *   turn1:{naive:number, lean:number, saved:number, savedPct:number},
 *   steadyState:{naivePerTurn:number, leanPerTurn:number},
 *   crossoverTurn:number|null}}
 *   `tokens` echoes the three raw counts the model was fed. `steadyState` is
 *   the per-turn cost from turn 2 on. `crossoverTurn` is the earliest turn at
 *   which cumulativeLean >= cumulativeNaive — the turn the lean path stops
 *   being cheaper over the session — or null when it is cheaper on every turn
 *   of the session. savedPct is an integer percent of the naive figure.
 */
export function discoveryCostOverTurns(tools, opts = {}) {
  const turns = opts.turns == null ? 10 : opts.turns;
  assert(Number.isInteger(turns) && turns >= 1, `discoveryCostOverTurns: opts.turns must be an integer >= 1, got ${JSON.stringify(opts.turns)}`);
  const describeCallTokens = opts.describeCallTokens == null ? 20 : opts.describeCallTokens;
  assert(typeof describeCallTokens === "number" && Number.isFinite(describeCallTokens) && describeCallTokens >= 0,
    `discoveryCostOverTurns: opts.describeCallTokens must be a finite number >= 0, got ${JSON.stringify(opts.describeCallTokens)}`);
  const prices = { ...DEFAULT_CACHE_PRICES, ...(opts.prices || {}) };
  for (const k of Object.keys(DEFAULT_CACHE_PRICES)) {
    assert(typeof prices[k] === "number" && Number.isFinite(prices[k]) && prices[k] >= 0, `discoveryCostOverTurns: opts.prices.${k} must be a finite number >= 0, got ${JSON.stringify(prices[k])}`);
  }
  const rebuildListEveryTurn = opts.rebuildListEveryTurn === true;

  // One source of truth for every token count: discoveryCost() in the same mode.
  const cost = discoveryCost(tools, { list: opts.list, used: opts.used, signatures: opts.signatures, estimate: opts.estimate, fullText: opts.fullText });
  const used = cost.used;
  const naiveList = cost.naive.total;
  const leanList = cost.lean.list + cost.lean.describeToolDescriptor;
  const describeResults = cost.lean.onDemand;   // Σ describeText over the used tools

  const laterPrice = rebuildListEveryTurn ? prices.cacheWrite : prices.cacheRead;
  const naiveTurn1 = naiveList * prices.cacheWrite;
  const leanTurn1 = leanList * prices.cacheWrite + used * describeCallTokens * prices.output + describeResults * prices.cacheWrite;
  const naivePerTurn = naiveList * laterPrice;
  const leanPerTurn = (leanList + describeResults) * laterPrice;

  const perTurn = [];
  let cumulativeNaive = 0, cumulativeLean = 0, crossoverTurn = null;
  for (let turn = 1; turn <= turns; turn++) {
    const naive = turn === 1 ? naiveTurn1 : naivePerTurn;
    const lean = turn === 1 ? leanTurn1 : leanPerTurn;
    cumulativeNaive += naive; cumulativeLean += lean;
    perTurn.push({ turn, naive, lean, cumulativeNaive, cumulativeLean });
    if (crossoverTurn === null && cumulativeLean >= cumulativeNaive) crossoverTurn = turn;
  }
  const pct = (naive, lean) => (naive === 0 ? 0 : Math.round(((naive - lean) / naive) * 100));
  return {
    turns, used, list: cost.list, signatures: cost.signatures, prices, describeCallTokens, rebuildListEveryTurn,
    tokens: { naiveList, leanList, describeResults },
    perTurn,
    total: { naive: cumulativeNaive, lean: cumulativeLean, saved: cumulativeNaive - cumulativeLean, savedPct: pct(cumulativeNaive, cumulativeLean) },
    turn1: { naive: naiveTurn1, lean: leanTurn1, saved: naiveTurn1 - leanTurn1, savedPct: pct(naiveTurn1, leanTurn1) },
    steadyState: { naivePerTurn, leanPerTurn },
    crossoverTurn
  };
}

/**
 * A canonical string for a tool's INPUT SHAPE (sorted prop:type pairs + sorted
 * required). Two tools with the same signature are indistinguishable by their
 * arguments at call time — no description prose can tell them apart.
 */
export function schemaSignature(tool) {
  const s = (tool && tool.inputSchema) || {};
  const props = s.properties || {};
  const shape = Object.keys(props).sort().map((k) => `${k}:${(props[k] && props[k].type) || "any"}`).join(",");
  const req = (s.required || []).slice().sort().join(",");
  return `{${shape}}!${req}`;
}

/**
 * Surface analysis: which tools an agent CAN'T tell apart. As a tool surface
 * grows, mis-selection is driven by OVERLAP, not count — two tools sharing an
 * input-schema shape are indistinguishable at call time whatever their prose
 * says. Returns the groups of 2+ tools with an identical schema signature, so
 * you can merge or differentiate them before an agent has to guess. This is a
 * design check; it is separate from discoveryCost (which meters tokens, not
 * disambiguation). A describe_tool in the set is ignored.
 * @returns {Array<{signature:string, tools:string[]}>} empty when all distinct
 */
export function schemaCollisions(tools) {
  const by = new Map();
  for (const t of (tools || []).filter((t) => t && t.name !== "describe_tool")) {
    const sig = schemaSignature(t);
    if (!by.has(sig)) by.set(sig, []);
    by.get(sig).push(t.name);
  }
  return [...by.entries()].filter(([, names]) => names.length > 1).map(([signature, names]) => ({ signature, tools: names }));
}

// ---------------------------------------------------------------------------
// DISAMBIGUATION AXIS, PART TWO — variations that could have been parameters.
//
// This exists because of practitioner feedback on r/mcp (2026-09-01), and it
// concedes their point rather than arguing with it: a cheaper menu does not fix
// a blurry pick. One r/mcp practitioner — "the menu only makes reading cheaper, the
// pick still happens on blurry input." Another, who runs a production
// MCP server — "anything that was a variation on the same question became a
// parameter instead of a new tool… the number worth watching isn't twelve, it's
// how many of those twelve answer questions a human would phrase the same way."
//
// schemaCollisions states a FACT: two tools are literally indistinguishable by
// their arguments at call time. variationCandidates raises a QUESTION: these
// tools LOOK like one tool plus a parameter — should they be? It is a
// HEURISTIC over two syntactic signals. It cannot read meaning, cannot see what
// a tool returns, and never decides anything. The merge is a human's call.
// ---------------------------------------------------------------------------

/** Connectives dropped from a tool name before comparison. Fixed list, no lexicon. */
const NAME_CONNECTIVES = new Set(["by", "with", "for", "of", "and", "or", "to", "in", "on", "from", "a", "an", "the"]);

/**
 * HEURISTIC helper (module-private). Crude suffix singulariser: `reviews`→
 * `review`, `repositories`→`repository`, while `status`/`address`/`analysis`
 * survive intact. A string rule, not a stemmer and not a lexicon — it WILL
 * mangle irregular words (`children` stays `children`). It is applied to both
 * sides of every comparison, so its errors cost recall, not precision.
 */
function singularise(w) {
  if (w.length > 4 && /ies$/.test(w)) return w.slice(0, -3) + "y";
  if (w.length >= 4 && /s$/.test(w) && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}

/**
 * HEURISTIC helper (module-private). A tool name's content words, in order,
 * deduped. Splits on non-alphanumerics AND camelCase boundaries, lowercases,
 * drops the fixed connective list, singularises. Assumes Latin-alphabet
 * snake_case / kebab-case / camelCase names; opaque names (`tool_a1`) and
 * non-English names yield nothing useful, which means silence, not noise.
 */
function nameTokens(name) {
  const parts = String(name == null ? "" : name)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/);
  const out = [];
  for (const p of parts) {
    if (!p) continue;
    const w = singularise(p.toLowerCase());
    if (!w || NAME_CONNECTIVES.has(w) || out.includes(w)) continue;
    out.push(w);
  }
  return out;
}

const schemaProps = (t) => { const s = (t && t.inputSchema) || {}; return (s.properties && typeof s.properties === "object") ? s.properties : {}; };
const schemaRequired = (t) => { const s = (t && t.inputSchema) || {}; return Array.isArray(s.required) ? s.required : []; };
const propType = (p) => (p && typeof p === "object" && p.type) || null;
/** Shallow on purpose: only the top-level JSON-Schema `type`, absent matches anything. */
const typesCompatible = (a, b) => a === null || b === null || a === b;

/**
 * HEURISTIC helper (module-private). Can `variant` accept `base`'s input?
 * Returns null (no relation) unless all three schema gates pass:
 *   2a shared core — at least one property present on BOTH with a compatible
 *      declared type. This is what rejects name-nested-but-unrelated pairs such
 *      as list_directory{path} / list_allowed_directories{} and
 *      maps_geocode{address} / maps_reverse_geocode{latitude,longitude}.
 *      Side effect, stated: a no-argument tool can never head a family.
 *   2b divergence tolerance — at most `tolerance` of base's properties absent
 *      (0 under strict). An absolute count, never a similarity score. It is the
 *      only rule that catches a variant which REPLACES a filter rather than
 *      adding one.
 *   2c required-core preservation — none of base's REQUIRED properties may be
 *      among the absent ones. If the variant cannot be asked the base's
 *      mandatory question, it is not a variation of it.
 */
function schemaRelation(base, variant, tolerance) {
  const bp = schemaProps(base), vp = schemaProps(variant);
  const shared = [], missing = [];
  for (const k of Object.keys(bp)) {
    if (Object.prototype.hasOwnProperty.call(vp, k) && typesCompatible(propType(bp[k]), propType(vp[k]))) shared.push(k);
    else missing.push(k);
  }
  if (shared.length < 1) return null;                                        // 2a
  if (missing.length > tolerance) return null;                               // 2b
  const req = schemaRequired(base);
  if (missing.some((k) => req.includes(k))) return null;                     // 2c
  const sharedSet = new Set(shared);
  return {
    relation: missing.length === 0 ? "superset" : "near-superset",
    sharedProps: shared.slice().sort(),
    addedProps: Object.keys(vp).filter((k) => !sharedSet.has(k)).sort(),
    missingProps: missing.slice().sort()
  };
}

/**
 * A HEURISTIC that SUGGESTS tools which might be one tool with a parameter.
 * It does NOT detect duplication, does not read semantics, and guarantees
 * nothing. Read every result as a question for a human designer.
 *
 * It fires only when TWO INDEPENDENT SYNTACTIC SIGNALS agree on an ordered
 * pair (base, variant). Neither is shippable alone, and the AND is the whole
 * reason it stays quiet:
 *
 *   1. NAME NESTING — the base's name WORDS are a PROPER SUBSET of the
 *      variant's (`get_reviews` ⊂ `get_reviews_by_version`). Set containment,
 *      NOT a shared prefix or stem: that is what keeps sibling verbs
 *      (`git_status` / `git_commit`, `search_code` / `search_issues`) out.
 *      Names alone would flag `maps_geocode` / `maps_reverse_geocode`.
 *   2. SCHEMA NESTING — the variant can accept the base's input (see
 *      schemaRelation). Schemas alone would flag `git_status` ⊂ `git_commit`,
 *      a strict subset of two unrelated tools.
 *
 * Equal token sets (`get_review` vs `get_reviews`) deliberately do NOT fire —
 * that is schemaCollisions' half of the problem, and requiring PROPER
 * containment keeps the classic get-one / list-many pattern quiet.
 *
 * Deliberately absent: description/prose similarity, edit distance, embeddings,
 * synonym tables, similarity thresholds, and any per-family confidence score.
 * Each would be a knob to tune, none could be defended as measured, and prose
 * on a real surface is the noisiest input available.
 *
 * WHAT IT CANNOT DO. It reads a tool's NAME and its INPUT-SCHEMA SHAPE, and
 * nothing else. It cannot see what a tool returns or means, so it cannot know
 * whether two tools answer the same question — `get_issue` and
 * `get_issue_comments` take identical arguments and return different things,
 * and this offers them as a question it cannot answer. It is synonym-blind by
 * construction (`get_reviews` vs `fetch_feedback` is invisible, permanently:
 * closing that gap needs embeddings or a lexicon, i.e. a runtime dependency
 * this library refuses). It cannot separate a qualifier that names a DIFFERENT
 * OBJECT (`create_user` / `create_user_group`) from one that names a FILTER
 * (`get_reviews` / `get_recent_reviews`) — that false positive is structural,
 * not a tuning problem; marking the base's distinguishing field `required`
 * suppresses it, and `strict:true` avoids the whole class. And it says NOTHING
 * about tool-selection accuracy: this measures surface SHAPE, discoveryCost
 * measures TOKENS, and neither measures whether an agent picks correctly.
 *
 * AN EMPTY RESULT IS NOT A CLEAN BILL OF HEALTH. It means these two signals did
 * not fire on these names and these schemas. Untested, not missing.
 *
 * @param {Array} tools               a `describe_tool` in the set is ignored
 * @param {{strict?:boolean}} [opts]  strict:true requires an exact superset
 *                                    (divergence tolerance 0; default 1)
 * @returns {{tools:number, strict:boolean, families:Array, involved:string[]}}
 *   Deterministic: same input → byte-identical output, whatever the input order.
 */
export function variationCandidates(tools, opts = {}) {
  const strict = opts.strict === true;
  const tolerance = strict ? 0 : 1;
  const real = (tools || []).filter((t) => t && t.name !== "describe_tool");
  const words = real.map((t) => nameTokens(t.name));
  const sets = words.map((w) => new Set(w));
  const byBase = new Map();

  for (let i = 0; i < real.length; i++) {
    for (let j = 0; j < real.length; j++) {
      if (i === j || real[i].name === real[j].name) continue;
      // signal 1: proper subset of name words
      if (!(sets[i].size < sets[j].size && words[i].every((w) => sets[j].has(w)))) continue;
      // signal 2: the variant can accept the base's input
      const rel = schemaRelation(real[i], real[j], tolerance);
      if (!rel) continue;
      if (!byBase.has(i)) byBase.set(i, []);
      byBase.get(i).push({ name: real[j].name, ...rel,
        // corroboration from the OTHER check, reported not gating: an identical
        // signature means schemaCollisions already reports this pair too.
        sameSchemaSignature: schemaSignature(real[i]) === schemaSignature(real[j]) });
    }
  }

  const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const families = [...byBase.entries()].map(([i, variants]) => {
    variants.sort((a, b) => byName(a.name, b.name));
    const params = new Set();
    for (const v of variants) for (const p of v.addedProps) params.add(p);
    return {
      base: real[i].name,
      stem: words[i].join(" "),
      tools: [real[i].name, ...variants.map((v) => v.name)].sort(byName),
      candidateParams: [...params].sort(byName),
      variants
    };
  }).sort((a, b) => byName(a.base, b.base));

  const involved = [...new Set(families.flatMap((f) => f.tools))].sort(byName);
  // involved.length / tools is the closest a static check gets to the r/mcp
  // practitioner's "how many of those twelve answer questions a human would
  // phrase the same way" — as a count of QUESTIONS RAISED, never a defect
  // rate or a score.
  return { tools: real.length, strict, families, involved };
}

/** Register tools with a WebMCP host (document.modelContext) or any registerTool host. */
export function mount(host, tools, opts = {}) {
  assert(host && typeof host.registerTool === "function", "mount: host must expose registerTool");
  const handles = tools.map((t) => host.registerTool(t, opts));
  return { count: tools.length, metrics: tools[0] && tools[0]._metrics, unregister() { for (const h of handles) if (h && h.unregister) h.unregister(); } };
}

export const version = "0.7.0";
