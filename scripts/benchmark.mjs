/**
 * benchmark.mjs — THE discovery-axis benchmark. The headline proof.
 * Run: node scripts/benchmark.mjs
 *
 * The pitch of this library is that it is the cheapest way to expose agent
 * tools. This script measures that claim on the DISCOVERY axis — the tokens an
 * agent must load to CHOOSE a tool (every tool's description + JSON schema),
 * paid on every page/session load, before it calls anything.
 *
 * It builds the realistic ~12-tool store/service surface from _surface.mjs
 * (diverse descriptions + schemas, not clones) and prints, in real measured
 * tokens:
 *   (a) NAIVE  — every tool's full description + full JSON schema, up front
 *                (what tools/list / navigator.modelContext.getTools() forces).
 *   (b) LEAN   — one-line manifest for ALL tools + the describe_tool descriptor
 *                + one describe_tool payload for the single tool actually used.
 *   (c) SAVING — absolute tokens and percentage.
 *   (d) CROSSOVER — the honest caveat: at how few tools the lean path stops
 *                winning (below break-even the describe_tool round-trip costs
 *                more than it saves).
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

// Headline: the agent lands, loads the surface, and uses ONE tool (used=1).
const cost = discoveryCost(tools);            // default used=1
const be = discoveryBreakEven(tools);         // full break-even curve

const N = cost.tools;
const bar = "─".repeat(64);

console.log(bar);
console.log(`DISCOVERY-AXIS BENCHMARK — ${N} realistic tools, agent uses ${cost.used}`);
console.log(`gauge: ${cost.gauge} (~4 chars/token); measured, not asserted`);
console.log(bar);

// (a) NAIVE
console.log(`\n(a) NAIVE  — full description + full JSON schema for all ${N} tools, up front`);
console.log(`    = ${cost.naive.total} tokens`);
console.log(`      (this is what tools/list / getTools() loads on every visit)`);

// (b) LEAN
console.log(`\n(b) LEAN   — name+one-line manifest for all ${N}  ${String(cost.lean.manifest).padStart(4)} tokens`);
console.log(`             + describe_tool descriptor (once)     ${String(cost.lean.describeToolDescriptor).padStart(4)} tokens`);
console.log(`             + describe_tool payload for ${cost.used} used tool  ${String(cost.lean.onDemand).padStart(4)} tokens`);
console.log(`             ${"".padStart(38)}= ${cost.lean.total} tokens`);

// (c) SAVING
console.log(`\n(c) SAVING — ${cost.saved} tokens absolute, ${cost.savedPct}% of the naive cost`);
console.log(`    the agent pays for the ${cost.used} tool it uses, not the ${N - cost.used} it skips.`);

// (d) CROSSOVER (honest caveat)
const belowWin = be.n === null ? "never within this set" : (be.n <= 1 ? "always (even at 1 tool)" : `below ${be.n} tools`);
console.log(`\n(d) CROSSOVER — lean overtakes naive at n=${be.n} tools.`);
console.log(`    Where lean STOPS winning: ${belowWin}.`);
if (be.n && be.n >= 2) {
  const one = be.perN[0];
  console.log(`    At n=1 the lean path costs ${one.lean} vs ${one.naive} naive (saved ${one.saved}) —`);
  console.log(`    the manifest + describe_tool round-trip is pure overhead when there`);
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
  const c = discoveryCost(tools, { used: u });
  console.log(`  used=${u}: lean ${String(c.lean.total).padStart(4)} vs naive ${c.naive.total}  -> saved ${String(c.saved).padStart(4)} (${c.savedPct}%)  leanWins=${c.leanWins}`);
}

// The single machine-readable headline (kept in the exact shape EVIDENCE.md
// and evidence.mjs consume, so the proof line never drifts from this script).
console.log(`\nHEADLINE:`);
console.log(
  `${N} tools cost ${cost.lean.total} tokens to discover the lean way ` +
  `vs ${cost.naive.total} naive — saved ${cost.saved} (${cost.savedPct}%); ` +
  `lean overtakes naive at n=${be.n} tools.`
);

console.log(`\n(estimateTokens ~4-char gauge: absolute counts approximate; % and break-even are robust. Per discovery = per context-load of the tool list, not per tool call.)`);
