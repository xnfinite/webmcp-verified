/**
 * tokenizer-check.mjs — anchor the discovery % OUTSIDE the ~4-char gauge.
 *
 * The headline savedPct is measured with estimateTokens (a ~4-char gauge). A
 * fair objection: is the % an artifact of that gauge? This re-runs the same
 * measurement with a REAL BPE tokenizer (gpt-tokenizer, a dev-only dependency —
 * the shipped library stays zero-dep), prints both, and then prints the
 * measured DELTA between the gauges for each mode. The ~4-char factor cancels
 * in the ratio only to the extent the gauge scales prose and JSON schema
 * alike; the delta line is the measured answer to how far that holds, not an
 * assertion that it does.
 *
 * Both list modes are printed under each gauge, served first: served is the
 * list mount() registers (schema in the list, only the help deferred);
 * schema-deferred is the upper bound for a host that lets you omit inputSchema
 * from the list.
 *
 * Needs dev dependencies: run `npm install` first. Run: npm run tokenizer
 */
import { encode } from "gpt-tokenizer";
import { discoveryCost, discoveryBreakEven, estimateTokens } from "../src/index.js";
import { buildSurface } from "./_surface.mjs";

const tools = buildSurface();
const real = (s) => encode(s || "").length;

const MODES = [
  ["served", "served: schema in the list (what mount() registers on an MCP/WebMCP host)"],
  ["deferred", "schema-deferred: only if your host lets you omit inputSchema from the list"]
];
const GAUGES = [
  ["~4-char gauge (estimateTokens)", estimateTokens],
  ["real BPE tokenizer (gpt-tokenizer)", real]
];

const results = {};   // results[list][gaugeLabel] = { c, be }
console.log("DISCOVERY % under two gauges — the headline is a RATIO, not a raw count\n");
for (const [label, estimate] of GAUGES) {
  console.log(`${label}`);
  for (const [list, modeLabel] of MODES) {
    const c = discoveryCost(tools, { estimate, list });
    const be = discoveryBreakEven(tools, { estimate, list });
    if (!results[list]) results[list] = {};
    results[list][label] = { c, be };
    console.log(`  ${modeLabel}`);
    console.log(`    naive ${c.naive.total}   lean ${c.lean.total}   saved ${c.savedPct}%   break-even n=${be.n}`);
  }
  console.log("");
}

// Measured, per mode: absolute counts always move with the gauge; this is how
// far the % and the break-even move. Quote a % together with its gauge.
console.log("Delta between gauges, per mode (measured, not asserted):");
for (const [list] of MODES) {
  const g = results[list][GAUGES[0][0]], b = results[list][GAUGES[1][0]];
  console.log(`  ${list.padEnd(8)}  savedPct ${g.c.savedPct}% (gauge) vs ${b.c.savedPct}% (BPE) = ${Math.abs(g.c.savedPct - b.c.savedPct)} point(s) apart;   break-even n=${g.be.n} (gauge) vs n=${b.be.n} (BPE)`);
}
