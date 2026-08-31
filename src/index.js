/**
 * webmcp-verified — verified, token-lean agent tools for the agentic web.
 *
 * Two things nobody else guarantees, on top of any WebMCP/ACP tool surface:
 *
 *  1. CAN'T HALLUCINATE. The model never authors a value. Every number an
 *     agent gets is produced by resolve(args, data), a pure function of a
 *     source YOU declare. Off-source questions return a declared fallback,
 *     never an invented figure. Provenance is stamped on every reply.
 *
 *  2. CHEAP FOR THE AGENT (the ICM way). Progressive disclosure: agents load
 *     a lean manifest (name + one line), pull full detail only when needed,
 *     and get compact results. Every call's output tokens are metered, so
 *     you can prove the per-call cost — counts, not rounded rates. The bigger
 *     DISCOVERY axis — the descriptions + schemas an agent loads to CHOOSE
 *     among ALL tools — is measured by discoveryCost()/discoveryBreakEven(),
 *     not just per-call output.
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
 * @param {string} def.description       lean, agent-facing (first sentence is the manifest line)
 * @param {Object} def.inputSchema       JSON Schema, type:"object"
 * @param {()=>any} def.source           the ground truth
 * @param {(args,data)=>(Resolved|null)} def.resolve   pure; null = not answerable from source
 * @param {(args,data)=>Resolved} [def.onUnknown]      fallback (still from source)
 * @param {Surface} [def.surface]        'customer' (default) redacts internal rows
 * @param {string} [def.sourceName]
 * @param {'full'|'compact'} [def.provenance]  'full' sentence (default) or token-lean "✓ sourced"
 * @param {string} [def.help]            long-form detail, kept OUT of the lean surface; served on demand
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
        const prov = provStyle === "compact"
          ? (outcome === "grounded" ? "✓ sourced" : "✓ fallback (no guess)")
          : (outcome === "grounded" ? `Every value derives from ${sourceName}; nothing here is generated by the agent.` : `Outside ${sourceName}. Returned a fallback, not a guessed value.`);
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
 * The lean manifest — the "catalog" an agent reads to discover tools cheaply.
 * Full schemas/help are pulled only when a tool is actually used.
 * @returns {Array<{name:string, description:string}>}
 */
export function manifest(tools) { return tools.map((t) => ({ name: t.name, description: t.description })); }

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
 * tool, all resident at once. Base MCP has no lazy/paged descriptor fetch.
 *
 * LEAN path = this library's progressive disclosure: the name-only manifest
 * for all N tools + the fixed describe_tool descriptor + the full describe
 * payload for only the `used` tools the agent actually pulls. The heavy part
 * (inputSchema + full help) is never loaded for the N−used tools not chosen.
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
 * @param {{used?:number, estimate?:(s:string)=>number, fullText?:(t:any)=>string}} [opts]
 *        used     tools the agent describes+calls this visit (default 1, clamped to [0,N])
 *        estimate token gauge (default estimateTokens)
 *        fullText naive `description` text (default t.help||t.description — the
 *                 full explanation you'd otherwise ship with no help split)
 */
export function discoveryCost(tools, opts = {}) {
  const estimate = opts.estimate || estimateTokens;
  const fullText = opts.fullText || ((t) => t.help || t.description || "");
  const real = (tools || []).filter((t) => t && t.name !== "describe_tool");
  const N = real.length;
  let used = opts.used == null ? 1 : opts.used;
  used = Math.max(0, Math.min(used, N));

  // NAIVE: every tool's full descriptor, resident up front.
  const perTool = real.map((t) => ({
    name: t.name,
    tokens: estimate(JSON.stringify({ name: t.name, description: fullText(t), inputSchema: t.inputSchema }))
  }));
  const naiveTotal = perTool.reduce((a, p) => a + p.tokens, 0);

  // LEAN: name-only manifest (all N) + fixed describe_tool descriptor +
  // full describe payload for only the `used` tools.
  const manifestTokens = estimate(JSON.stringify(manifest(real)));
  const dt = describeTool(real);
  const describeToolDescriptor = estimate(JSON.stringify({ name: dt.name, description: dt.description, inputSchema: dt.inputSchema }));
  const describedTools = real.slice(0, used).map((t) => ({ name: t.name, tokens: estimate(describeText(t)) }));
  const onDemand = describedTools.reduce((a, d) => a + d.tokens, 0);
  const leanTotal = manifestTokens + describeToolDescriptor + onDemand;

  const saved = naiveTotal - leanTotal;
  const savedPct = naiveTotal === 0 ? 0 : Math.round((saved / naiveTotal) * 100);
  return {
    tools: N, used, gauge: estimate.name || "custom",
    naive: { total: naiveTotal, perTool },
    lean: { total: leanTotal, manifest: manifestTokens, describeToolDescriptor, onDemand, describedTools },
    saved, savedPct, leanWins: saved > 0
  };
}

/**
 * The honest few-tools caveat, COMPUTED not asserted. Evaluates discoveryCost
 * on prefixes tools.slice(0,n) for n=1..N and returns the smallest n where
 * lean first wins, plus the full curve — the reproducible "where the line is"
 * number. Lean loses at few tools (the describe_tool round-trip costs more
 * than it saves); this reports exactly where it flips for a given set.
 * @returns {{n:number|null, saved:number, perN:Array<{n:number,naive:number,lean:number,saved:number,leanWins:boolean}>}}
 */
export function discoveryBreakEven(tools, opts = {}) {
  const real = (tools || []).filter((t) => t && t.name !== "describe_tool");
  const N = real.length;
  const perN = [];
  let firstWin = null;
  for (let n = 1; n <= N; n++) {
    const c = discoveryCost(real.slice(0, n), opts);  // used clamps to n inside
    perN.push({ n, naive: c.naive.total, lean: c.lean.total, saved: c.saved, leanWins: c.leanWins });
    if (firstWin === null && c.leanWins) firstWin = n;
  }
  const saved = firstWin !== null ? perN[firstWin - 1].saved : (perN.length ? perN[perN.length - 1].saved : 0);
  return { n: firstWin, saved, perN };
}

/** Register tools with a WebMCP host (document.modelContext) or any registerTool host. */
export function mount(host, tools, opts = {}) {
  assert(host && typeof host.registerTool === "function", "mount: host must expose registerTool");
  const handles = tools.map((t) => host.registerTool(t, opts));
  return { count: tools.length, metrics: tools[0] && tools[0]._metrics, unregister() { for (const h of handles) if (h && h.unregister) h.unregister(); } };
}

export const version = "0.6.0";
