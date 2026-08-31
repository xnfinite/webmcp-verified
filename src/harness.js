/**
 * webmcp-verified/harness — the test + performance harness.
 *
 * Acts like a visiting agent: runs a battery of real journeys against a set
 * of tools and reports where an agent would fail (leaks, wrong answers, thin
 * schemas, errors) plus timing. Two entry points:
 *   - runJourneys(tools, journeys)   : direct, for unit-style tests
 *   - runOnHost(hostSetupFn, ...)     : installs a capturing modelContext,
 *                                       invokes the page's registration, runs.
 *
 * A journey: { tool, args, expect?: string[], denyMargin?: boolean }
 *   expect     — substrings that MUST appear (engine-consistent numbers)
 *   denyMargin — default true; fail if internal pricing leaks to a customer surface
 */

/**
 * Heuristic tripwire for internal-pricing terms appearing on a customer
 * surface. IMPORTANT: this is a double-check for developer error, NOT the
 * security boundary. The real redaction guarantee is the structural surface
 * split (a customer surface never even receives internal rows — see
 * src/index.js render()/execute()); avoiding leaks depends on marking rows
 * `internal`, not on this regex.
 *
 * Known limits (stated, not hidden):
 *  - False-positives it still trips on: legitimate "profit margin"/"profit"
 *    in honest marketing copy. (Bare `margin` was removed because it hit
 *    "margin of error", CSS "margin", "safety margin".)
 *  - Known misses (synonyms/localization it does NOT catch): "cost basis"
 *    handled below, but also "our cost", "vendor/supplier price", "markdown",
 *    "unit/landed cost", "MSRP" — a substring net cannot be exhaustive.
 * Exported so callers can inspect/reuse it; the pattern is a heuristic.
 */
export const LEAK = /\bwholesale\b|\bmark-?up\b|\bgross margin\b|\bprofit margin\b|\bmargin\s*[:=]|margin \$|\/\s*h\b|\blabor rate\b|\bcost basis\b|\bCOGS\b|\bprofit\b/i;

async function runOne(tool, j) {
  const issues = [];
  if (!tool) return { tool: j.tool, pass: false, issues: ["tool not registered"] };
  if (!tool.inputSchema || tool.inputSchema.type !== "object") issues.push("inputSchema not a typed object");
  if (!tool.description || tool.description.length < 10) issues.push("thin/absent description");
  let text = "", ms = 0;
  const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
  try {
    const out = await tool.execute(j.args || {});
    text = (out && out.content && out.content[0] && out.content[0].text) || "";
    // A readable error result (isError:true) is still a journey failure — the
    // tool couldn't answer. Kept coupled to the throw→return change in
    // execute() so the harness keeps detecting errors. The catch below stays
    // as a backstop for a tool that still throws.
    if (out && out.isError) issues.push("tool returned an error result: " + text);
  } catch (e) {
    return { tool: j.tool, pass: false, issues: ["threw: " + e.message] };
  }
  ms = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
  if (j.denyMargin !== false && LEAK.test(text)) issues.push("MARGIN LEAK on customer surface");
  for (const e of j.expect || []) if (!text.includes(e)) issues.push("missing: " + e);
  return { tool: j.tool, args: j.args, pass: issues.length === 0, issues, ms: +ms.toFixed(1), snippet: text.slice(0, 140).replace(/\n/g, " | ") };
}

/** Run journeys against an array of tool objects (each with name + execute). */
export async function runJourneys(tools, journeys) {
  const byName = new Map(tools.map((t) => [t.name, t]));
  const results = [];
  for (const j of journeys) results.push(await runOne(byName.get(j.tool), j));
  const passed = results.filter((r) => r.pass).length;
  return { toolCount: tools.length, tools: tools.map((t) => t.name), passed, total: results.length, allPass: passed === results.length, results };
}

/**
 * Browser use: install a spec-shaped capturing modelContext, run the page's
 * registration hook, then the journeys. `setup` receives the capturing host
 * and should trigger registration (e.g. () => window.__registerAgentTools()).
 */
export async function runOnHost(doc, setup, journeys) {
  const registered = [];
  const prev = "modelContext" in doc ? doc.modelContext : undefined;
  doc.modelContext = {
    registerTool: (t) => { registered.push(t); return { unregister() {} }; },
    getTools: async () => registered,
    executeTool: async (t, args) => t.execute(args)
  };
  let reg = "no-hook";
  try { reg = await setup(doc.modelContext); } finally { /* keep tools for the run */ }
  const report = await runJourneys(registered, journeys);
  if (prev === undefined) delete doc.modelContext; else doc.modelContext = prev;
  return { registration: reg, ...report };
}
