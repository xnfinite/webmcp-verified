/**
 * cache-curve.mjs — the discovery cost over a SESSION, with prompt caching.
 *
 * Practitioners on r/mcp (2026-09-02) pointed out that a static tool list sits
 * in a cached prompt prefix from turn 2 on and is cheap to re-read, while each
 * deferred describe_tool result arrives once as new input and the describe
 * CALL itself is generated output. A single-load token count (npm run
 * discovery / npm run real-mcp) therefore OVERSTATES the lean win over a
 * session. This prints the session figure from discoveryCostOverTurns() for
 * both surfaces and both list modes, then:
 *   - the `used` sweep at turns=10, served: where the session win goes negative
 *   - what argument signatures cost in the schema-deferred list
 *   - why tools/list stays static on the lean path (smoke test T50 pins it)
 *
 * PRICE RATIOS ARE PARAMETERS, NOT FACTS. The defaults are one vendor's
 * published ratios at the time of writing, relative to fresh input = 1. Pass
 * your vendor's current ratios to override them (a partial object merges):
 *   discoveryCostOverTurns(tools, { prices: { input: 1, output: 4, cacheWrite: 1.25, cacheRead: 0.25 } })
 *
 * Costs are printed in fresh-input-token units (tokens × price ratio), to two
 * decimals for readability; the library itself rounds nothing but savedPct.
 * Run: npm run cache-curve
 */
import { discoveryCost, discoveryCostOverTurns, manifest } from "../src/index.js";
import { buildSurface } from "./_surface.mjs";
import { buildRealSurface, realServers } from "./_real-mcp-surface.mjs";

const TURNS = [1, 2, 5, 10, 20, 50];
const MODES = [
  ["served", "served: schema in the list (what mount() registers on an MCP/WebMCP host) — quote this"],
  ["deferred", "schema-deferred: only if your host lets you omit inputSchema from the list (an upper bound)"]
];
const real14 = buildRealSurface();
const illustrative12 = buildSurface();
const SURFACES = [
  ["REAL MCP SURFACE", real14, `${real14.length} tools from ${new Set(realServers).size} official servers (scripts/_real-mcp-surface.mjs)`],
  ["ILLUSTRATIVE SURFACE", illustrative12, `${illustrative12.length} store/service tools (scripts/_surface.mjs)`]
];
const f2 = (n) => n.toFixed(2);
const pct = (n) => `${String(n).padStart(4)}%`;

// The defaults are echoed FROM the library result, never retyped here.
const { prices, describeCallTokens } = discoveryCostOverTurns(real14);
console.log("CACHE CURVE — discovery cost over a session, with prompt caching\n");
console.log("Price ratios are PARAMETERS, not facts. Defaults, relative to fresh input = 1:");
console.log(`  input ${prices.input}   output ${prices.output}   cacheWrite ${prices.cacheWrite}   cacheRead ${prices.cacheRead}`);
console.log("  (one vendor's published ratios at the time of writing — check your vendor's current sheet)");
console.log("  override: discoveryCostOverTurns(tools, { prices: { input: 1, output: 4, cacheWrite: 1.25, cacheRead: 0.25 } })");
console.log(`  describeCallTokens ${describeCallTokens} = output tokens the agent generates to emit one describe_tool call; override the same way.\n`);
console.log("Model: the tool list sits in the cached prompt prefix on every turn. Naive pays cacheWrite for the");
console.log("full list on turn 1, then cacheRead per turn. Lean pays cacheWrite for its list and for each");
console.log("describe_tool result on turn 1, plus output tokens per describe_tool call, then cacheRead for all");
console.log("of it per turn. All describes are assumed on turn 1 — the conservative case for lean. Costs are in");
console.log("fresh-input-token units (tokens × ratio); savedPct is cumulative over the session.");

for (const [title, tools, sub] of SURFACES) {
  console.log(`\n${title} — ${sub}, used=1`);
  for (const [list, label] of MODES) {
    const single = discoveryCost(tools, { list });
    const r = discoveryCostOverTurns(tools, { list, turns: 50 });
    const cells = TURNS.map((t) => `t${t}=${discoveryCostOverTurns(tools, { list, turns: t }).total.savedPct}%`).join("  ");
    console.log(`  ${label}`);
    console.log(`    single-load (discoveryCost): ${single.savedPct}%   over a session: ${cells}   crossover: ${r.crossoverTurn === null ? "none" : "turn " + r.crossoverTurn}`);
    console.log(`    turn 1: naive ${f2(r.turn1.naive)} → lean ${f2(r.turn1.lean)}   from turn 2, per turn: naive ${f2(r.steadyState.naivePerTurn)} → lean ${f2(r.steadyState.leanPerTurn)}`);
    console.log(`    tokens fed in: naive list ${r.tokens.naiveList}, lean list ${r.tokens.leanList} (incl. the describe_tool descriptor), describe results ${r.tokens.describeResults}`);
  }
}

console.log("\nUSED SWEEP — served, turns=10, default prices: cumulative savedPct as the agent describes more tools");
for (const [title, tools] of SURFACES) {
  console.log(`  ${title} (${tools.length} tools)`);
  for (let used = 0; used <= tools.length; used++) {
    const r = discoveryCostOverTurns(tools, { used });
    console.log(`    used=${String(used).padStart(2)}  ${pct(r.total.savedPct)}${r.crossoverTurn === null ? "" : `   lean not cheaper from turn ${r.crossoverTurn}`}`);
  }
}
console.log("  Read: the session win shrinks as `used` grows and goes negative once the agent describes most of");
console.log("  the surface — the same shape as npm run used-curve, now with caching priced in.");

console.log("\nSIGNATURES — schema-deferred list, used=1: put the argument names into the one-liner");
console.log("  With the schema deferred, the one-liner does all the disambiguation work. manifest(tools,");
console.log('  { signatures: true }) appends " (args: a, b?)" — declaration order, "?" marks optional. The cost:');
for (const [title, tools] of SURFACES) {
  const without = discoveryCost(tools, { list: "deferred" });
  const withSig = discoveryCost(tools, { list: "deferred", signatures: true });
  const sample = manifest(tools, { signatures: true })[0];
  console.log(`  ${title}: list tokens ${without.lean.list} → ${withSig.lean.list} (+${withSig.lean.list - without.lean.list})   savedPct ${without.savedPct}% → ${withSig.savedPct}%`);
  console.log(`    e.g. ${sample.name}: ${sample.description}`);
}
console.log("  Served mode ignores signatures: the schema, argument names included, is already in the list.");

console.log("\nSTATIC LIST — why the lean path does not bust the cache prefix");
console.log("  Lazy-loading schemas changes tools/list between turns, which invalidates the cached prefix, and");
console.log("  some clients re-list on every tools/list_changed notification. This library's describe_tool");
console.log("  returns a RESULT: it never re-registers a tool and never mutates one, so tools/list is unchanged");
console.log("  across the session. Smoke test T50 mounts the real surface, describes every tool, and checks that");
console.log("  registerTool was not called again, the registered objects are the same references, and no tool");
console.log("  changed. To price a design that DOES rebuild the list, or a client that re-lists, pass");
console.log("  { rebuildListEveryTurn: true }: both sides then pay cacheWrite on every turn.");
