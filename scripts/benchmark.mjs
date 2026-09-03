/**
 * benchmark.mjs — THE discovery-axis benchmark. The headline proof.
 * Run: node scripts/benchmark.mjs
 *
 * This script measures the DISCOVERY axis — the tokens an agent must load to
 * CHOOSE a tool (every tool's description + JSON schema), paid on every
 * page/session load, before it calls anything.
 *
 * It builds the realistic ~12-tool store/service surface from _surface.mjs
 * (diverse descriptions + schemas, not clones) and prints, in real measured
 * tokens, for EACH list mode (served first):
 *   (a) NAIVE  — every tool's full description + full JSON schema, up front
 *                (what tools/list / navigator.modelContext.getTools() forces
 *                when the long-form text is the description).
 *   (b) LEAN   — the tool list for ALL tools + the describe_tool descriptor
 *                + one describe_tool payload for the single tool actually used.
 *   (c) SAVING — absolute tokens and percentage.
 *   (d) CROSSOVER — the honest caveat: at how few tools the lean path stops
 *                winning (below break-even the describe_tool round-trip costs
 *                more than it saves).
 *
 * The two list modes differ ONLY in what the list carries:
 *   served   — name + one-line + inputSchema per tool. This is what defineTool()
 *              returns and mount() registers, so it is what an MCP/WebMCP host
 *              actually shows the agent; only the long-form help is deferred.
 *              This is the headline to quote.
 *   deferred — name + one-line, NO schema. An upper bound that holds only on a
 *              host that lets you omit inputSchema from the list. Printed
 *              second, labelled, never as the bare headline line.
 *
 * Everything is MEASURED by the src/index.js discovery API — nothing is
 * asserted by hand. estimateTokens is a ~4-char gauge, so ABSOLUTE counts are
 * approximate; the percentage and break-even are the robust figures (both
 * paths use the same gauge, so the constant cancels in the ratio). It counts
 * tokens, not reasoning quality, and is per-discovery (per context-load of the
 * tool list), not per tool call. Deterministic: same input -> same output.
 */
import { discoveryCost, discoveryBreakEven } from "../src/index.js";
import { buildSurface } from "./_surface.mjs";

const tools = buildSurface();
const bar = "─".repeat(64);

const MODES = [
  ["served", "served: schema in the list (what mount() registers on an MCP/WebMCP host)", "name + one-line + inputSchema list for all"],
  ["deferred", "schema-deferred: only if your host lets you omit inputSchema from the list", "name + one-line list (NO schema) for all"]
];

const results = {};

for (const [list, label, listDesc] of MODES) {
  // Headline case: the agent lands, loads the surface, and uses ONE tool (used=1).
  const cost = discoveryCost(tools, { list });       // default used=1
  const be = discoveryBreakEven(tools, { list });    // full break-even curve
  results[list] = { cost, be };
  const N = cost.tools;

  console.log(bar);
  console.log(`DISCOVERY-AXIS BENCHMARK — ${N} realistic tools, agent uses ${cost.used}`);
  console.log(label);
  console.log(`gauge: ${cost.gauge} (~4 chars/token); measured, not asserted`);
  console.log(bar);

  // (a) NAIVE
  console.log(`\n(a) NAIVE  — full description + full JSON schema for all ${N} tools, up front`);
  console.log(`    = ${cost.naive.total} tokens`);
  console.log(`      (what tools/list / getTools() loads on every visit when the long-form`);
  console.log(`       text is the description; identical in both modes)`);

  // (b) LEAN
  console.log(`\n(b) LEAN   — ${listDesc} ${N}  ${String(cost.lean.list).padStart(4)} tokens`);
  console.log(`             + describe_tool descriptor (once)     ${String(cost.lean.describeToolDescriptor).padStart(4)} tokens`);
  console.log(`             + describe_tool payload for ${cost.used} used tool  ${String(cost.lean.onDemand).padStart(4)} tokens`);
  console.log(`             ${"".padStart(38)}= ${cost.lean.total} tokens`);

  // (c) SAVING
  console.log(`\n(c) SAVING — ${cost.saved} tokens absolute, ${cost.savedPct}% of the naive cost`);
  console.log(`    the agent pays the long-form help for the ${cost.used} tool it uses, not the ${N - cost.used} it skips.`);

  // (d) CROSSOVER (honest caveat)
  const belowWin = be.n === null ? "never within this set" : (be.n <= 1 ? "always (even at 1 tool)" : `below ${be.n} tools`);
  console.log(`\n(d) CROSSOVER — lean overtakes naive at n=${be.n} tools.`);
  console.log(`    Where lean STOPS winning: ${belowWin}.`);
  if (be.n && be.n >= 2) {
    const one = be.perN[0];
    console.log(`    At n=1 the lean path costs ${one.lean} vs ${one.naive} naive (saved ${one.saved}) —`);
    console.log(`    the list + describe_tool round-trip is pure overhead when there`);
    console.log(`    is only one tool to choose. Progressive disclosure is a MANY-tool win.`);
  }

  // Supporting: break-even curve (every prefix length, measured)
  console.log(`\nBreak-even curve (measured at each prefix length n):`);
  console.log(`   n | naive | lean | saved | leanWins`);
  for (const r of be.perN) {
    console.log(`  ${String(r.n).padStart(2)} | ${String(r.naive).padStart(5)} | ${String(r.lean).padStart(4)} | ${String(r.saved).padStart(5)} | ${r.leanWins}`);
  }

  // Supporting: how the win shrinks as the agent pulls MORE tools (honest).
  console.log(`\nSensitivity — win shrinks as the agent describes more of the ${N} tools:`);
  for (const u of [1, 2, 3, 6]) {
    const c = discoveryCost(tools, { list, used: u });
    console.log(`  used=${u}: lean ${String(c.lean.total).padStart(4)} vs naive ${c.naive.total}  -> saved ${String(c.saved).padStart(4)} (${c.savedPct}%)  leanWins=${c.leanWins}`);
  }
  console.log("");
}

// The single machine-readable headline (kept in the exact shape EVIDENCE.md
// and evidence.mjs consume, so the proof line never drifts from this script).
// The bare "N tools cost …" line is the SERVED figure — what this library
// actually registers on a host. The schema-deferred line is prefixed so a
// scraper cannot take it for the headline.
const S = results.served, D = results.deferred;
const N = S.cost.tools;
console.log(`HEADLINE — served: schema in the list (what mount() registers on an MCP/WebMCP host)`);
console.log(
  `${N} tools cost ${S.cost.lean.total} tokens to discover the lean way ` +
  `vs ${S.cost.naive.total} naive — saved ${S.cost.saved} (${S.cost.savedPct}%); ` +
  `lean overtakes naive at n=${S.be.n} tools. [served: schema in the list]`
);
console.log(`\nschema-deferred: only if your host lets you omit inputSchema from the list`);
console.log(
  `schema-deferred: ${N} tools cost ${D.cost.lean.total} tokens to discover the lean way ` +
  `vs ${D.cost.naive.total} naive — saved ${D.cost.saved} (${D.cost.savedPct}%); ` +
  `lean overtakes naive at n=${D.be.n} tools. [upper bound: schema omitted from the list]`
);

console.log(`\n(estimateTokens ~4-char gauge: absolute counts approximate; % and break-even are robust. Per discovery = per context-load of the tool list, not per tool call. served − deferred is exactly the schema payload in the list.)`);
