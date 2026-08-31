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
 *     you can prove the cost — counts, not rounded rates.
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
  const metrics = def.metrics || defineTool._m || (defineTool._m = new Metrics());
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
      try {
        // hard input boundary BEFORE any source/resolve runs
        const { clean, missing } = validateArgs(rawArgs, def.inputSchema);
        if (missing.length) {
          metrics.record(def.name, "fallback", metrics.now() - t0, 0);
          return { content: [{ type: "text", text: `Missing required field(s): ${missing.join(", ")}. No value returned.` }] };
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
        return { content: [{ type: "text", text }] };
      } catch (e) { metrics.record(def.name, "error", metrics.now() - t0, 0); throw e; }
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
      const text = t ? `${t.name}\n${t.help}\nInput: ${JSON.stringify(t.inputSchema)}` : `No tool named "${name}". Available: ${[...byName.keys()].join(", ")}.`;
      return { content: [{ type: "text", text }] };
    }
  };
}

/** Register tools with a WebMCP host (document.modelContext) or any registerTool host. */
export function mount(host, tools, opts = {}) {
  assert(host && typeof host.registerTool === "function", "mount: host must expose registerTool");
  const handles = tools.map((t) => host.registerTool(t, opts));
  return { count: tools.length, metrics: tools[0] && tools[0]._metrics, unregister() { for (const h of handles) if (h && h.unregister) h.unregister(); } };
}

export const version = "0.4.0";
