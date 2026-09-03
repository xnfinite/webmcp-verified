/**
 * discovery.mjs — meter the DISCOVERY token axis on a realistic tool surface.
 * Run: node scripts/discovery.mjs
 *
 * Builds an illustrative ~12-tool surface with real defineTool tools (each a
 * multi-sentence `help` + a real inputSchema), then prints the DISCOVERY cost
 * of the lean progressive-disclosure path vs the naive full-descriptor path,
 * plus the break-even N — in BOTH list modes, served first:
 *
 *   served   — the list carries name + one-line + inputSchema. That is what
 *              defineTool() returns and mount() registers, so it is what an
 *              MCP tools/list or WebMCP getTools() host shows the agent. Only
 *              the long-form help is deferred. This is the mode to quote.
 *   deferred — the list is name + one-line with NO schema. An upper bound,
 *              valid only on a host that lets you omit inputSchema from the
 *              list and fetch it on demand; standard hosts do not.
 *
 * Prints MEASURED numbers only — asserts nothing by hand. The set is
 * illustrative, not universal: the win scales with (N − used) and with how
 * much long-form help each tool carries, and the composition is inspectable
 * (perTool below).
 *
 * Numbers are estimateTokens (~4 chars/token) gauge estimates, so treat the
 * ABSOLUTE counts as approximate; savedPct and break-even are the robust
 * figures (both paths use the same gauge, so the factor cancels).
 */
import { discoveryCost, discoveryBreakEven } from "../src/index.js";
import { buildSurface } from "./_surface.mjs";

// The realistic customer-facing surface (auto shop + retail) lives in
// _surface.mjs so benchmark.mjs and this script measure the SAME 12 tools —
// one source of truth for the discovery numbers, no divergent headlines.
const tools = buildSurface();

// Served is printed first and is the headline; deferred is the labelled upper
// bound. The deferred headline line carries a prefix so nothing that scrapes
// the bare "N tools cost …" line can mistake it for the served figure.
const MODES = [
  ["served", "served: schema in the list (what mount() registers on an MCP/WebMCP host)", ""],
  ["deferred", "schema-deferred: only if your host lets you omit inputSchema from the list", "schema-deferred: "]
];

for (const [list, label, prefix] of MODES) {
  const cost = discoveryCost(tools, { list });            // default used=1
  const be = discoveryBreakEven(tools, { list });         // default used=1
  console.log(`DISCOVERY COST — ${cost.tools} tools, used=${cost.used}, gauge=${cost.gauge}, list=${cost.list}`);
  console.log(`  ${label}`);
  console.log(
    `${prefix}${cost.tools} tools cost ${cost.lean.total} tokens to discover the lean way ` +
    `vs ${cost.naive.total} naive — saved ${cost.saved} (${cost.savedPct}%); ` +
    `lean overtakes naive at n=${be.n} tools.`
  );
  console.log("");
  console.log("Lean breakdown:", JSON.stringify(cost.lean, null, 2));
  console.log("");
  console.log("Break-even curve (per prefix length n):");
  for (const row of be.perN) {
    console.log(`  n=${String(row.n).padStart(2)}  naive=${String(row.naive).padStart(5)}  lean=${String(row.lean).padStart(5)}  saved=${String(row.saved).padStart(5)}  leanWins=${row.leanWins}`);
  }
  console.log("");
}

// The naive side does not depend on the list mode; print it once.
console.log("Naive per-tool (identical in both modes):", JSON.stringify(discoveryCost(tools).naive.perTool, null, 2));
console.log("");
console.log("(estimateTokens is a ~4-char gauge; absolute counts are approximate. savedPct and break-even are the robust figures. Per discovery = per context-load of the tool list, not per tool call. served − deferred is exactly the schema payload in the list; nothing else differs between the modes.)");
