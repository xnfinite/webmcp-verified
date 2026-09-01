/**
 * overlap.mjs — does the discovery saving depend on schema DISTINCTNESS?
 *
 * Answering a real r/mcp question: a commenter noted the tool-selection drop is
 * driven by OVERLAP, not count — two tools that both take {query:string} are
 * indistinguishable at call time — and asked whether the 67% held when the
 * schemas were genuinely distinct.
 *
 * Controlled test: the SAME 12 tools (same names, one-line descriptions, and
 * long-form help), measured twice, with the ONLY variable being the input
 * schema:
 *   A) DISTINCT   — each tool's real 2–4 property schema (the shipped surface)
 *   B) OVERLAPPING — every schema replaced by an identical { query: string }
 *
 * This measures the TOKEN axis (discoveryCost), not pick accuracy. Token cost
 * and disambiguation are different problems; progressive disclosure only
 * touches the first. Run: node scripts/overlap.mjs
 */
import { defineTool, discoveryCost, discoveryBreakEven, schemaCollisions } from "../src/index.js";
import { specs, buildSurface } from "./_surface.mjs";

const distinct = buildSurface();

// Same names/descriptions/help — only the schema changes, to an identical shape.
const overlapping = specs.map(([name, description, help]) =>
  defineTool({
    name, description, help,
    inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    source: () => ({}), resolve: () => ({ lines: [["ok", 1]] })
  })
);

const rows = [
  ["DISTINCT   (real 2–4 prop schemas)", distinct],
  ["OVERLAPPING (all { query: string })", overlapping]
];

console.log("DISCOVERY TOKEN COST — schema distinctness held as the only variable\n");
for (const [label, tools] of rows) {
  const c = discoveryCost(tools);
  const be = discoveryBreakEven(tools);
  console.log(label);
  console.log(`  naive ${String(c.naive.total).padStart(5)}   lean ${String(c.lean.total).padStart(4)}   saved ${String(c.saved).padStart(4)} (${c.savedPct}%)   break-even n=${be.n}`);
}
// The disambiguation axis: which tools an agent literally cannot tell apart.
const oc = schemaCollisions(overlapping);
console.log("\nschemaCollisions — the disambiguation axis (a design check, not tokens):");
console.log(`  DISTINCT surface:    ${schemaCollisions(distinct).length} collision group(s) — all tools tell apart`);
console.log(`  OVERLAPPING surface: ${oc.length} group of ${oc[0] ? oc[0].tools.length : 0} indistinguishable tools`);

console.log("\nNote: this is the token axis only. Overlap's real cost is pick");
console.log("ACCURACY at call time — a different problem progressive disclosure");
console.log("does not solve. Two {query:string} tools stay indistinguishable no");
console.log("matter how cheaply they load.");
