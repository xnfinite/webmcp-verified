/**
 * overlap.mjs — does the discovery saving depend on schema DISTINCTNESS?
 *
 * Answering a real r/mcp question: a practitioner noted the tool-selection drop
 * is driven by OVERLAP, not count — two tools that both take {query:string} are
 * indistinguishable at call time — and asked whether the headline saving held
 * when the schemas were genuinely distinct.
 *
 * Controlled test: the SAME 12 tools (same names, one-line descriptions, and
 * long-form help), measured twice, with the ONLY variable being the input
 * schema:
 *   A) DISTINCT   — each tool's real 2–4 property schema (the shipped surface)
 *   B) OVERLAPPING — every schema replaced by an identical { query: string }
 *
 * Each is printed in both list modes, served first: served is the list
 * mount() registers (schema in the list, only the help deferred); schema-
 * deferred is the upper bound for a host that lets you omit inputSchema from
 * the list. Because the schema sits in the served list on both sides, schema
 * distinctness moves the served numbers through the naive side and the list
 * alike.
 *
 * This measures the TOKEN axis (discoveryCost), not pick accuracy. Token cost
 * and disambiguation are different problems; progressive disclosure only
 * touches the first. Run: node scripts/overlap.mjs
 */
import { defineTool, discoveryCost, discoveryBreakEven, schemaCollisions, variationCandidates } from "../src/index.js";
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

const MODES = [
  ["served", "served: schema in the list (what mount() registers on an MCP/WebMCP host)"],
  ["deferred", "schema-deferred: only if your host lets you omit inputSchema from the list"]
];

console.log("DISCOVERY TOKEN COST — schema distinctness held as the only variable\n");
for (const [label, tools] of rows) {
  console.log(label);
  for (const [list, modeLabel] of MODES) {
    const c = discoveryCost(tools, { list });
    const be = discoveryBreakEven(tools, { list });
    console.log(`  ${modeLabel}`);
    console.log(`    naive ${String(c.naive.total).padStart(5)}   lean ${String(c.lean.total).padStart(4)}   saved ${String(c.saved).padStart(4)} (${c.savedPct}%)   break-even n=${be.n}`);
  }
}
// The disambiguation axis: which tools an agent literally cannot tell apart.
const oc = schemaCollisions(overlapping);
console.log("\nschemaCollisions — the disambiguation axis (a design check, not tokens):");
console.log(`  DISTINCT surface:    ${schemaCollisions(distinct).length} collision group(s) — all tools tell apart`);
console.log(`  OVERLAPPING surface: ${oc.length} group of ${oc[0] ? oc[0].tools.length : 0} indistinguishable tools`);

// The other half of the disambiguation axis: not "identical at call time" but
// "this looks like one tool with a parameter." Answers the rule a practitioner
// on r/mcp who runs a production MCP server stated directly — a variation on
// the same question should have been a parameter.
const appbot = [
  ["get_reviews", { app_id: "string", page: "number" }, ["app_id"]],
  ["get_reviews_by_version", { app_id: "string", page: "number", version: "string" }, ["app_id"]],
  ["get_reviews_by_sentiment", { app_id: "string", sentiment: "string" }, ["app_id"]],
  ["get_recent_reviews", { app_id: "string", days: "number" }, ["app_id"]]
].map(([name, props, required]) => defineTool({
  name, description: `Fixture: ${name.replace(/_/g, " ")} — a variation on one question.`,
  inputSchema: { type: "object", properties: Object.fromEntries(Object.entries(props).map(([k, t]) => [k, { type: t }])), required },
  source: () => ({}), resolve: () => ({ lines: [["ok", 1]] })
}));

console.log("\nvariationCandidates — [HEURISTIC] tools that LOOK like one tool plus a parameter.");
console.log("It suggests questions for a human; it never detects duplication or decides a merge.");
for (const [label, tools] of [...rows, ["FOUR TOOLS THAT SHOULD BE ONE (fixture)", appbot]]) {
  const v = variationCandidates(tools);
  console.log(`  ${label.padEnd(39)} ${v.families.length} famil${v.families.length === 1 ? "y " : "ies"}  (${v.involved.length} of ${v.tools} tools involved)`);
  for (const f of v.families) {
    console.log(`      -> could be ONE tool: ${f.base}(${f.candidateParams.join(", ")})`);
    for (const x of f.variants) console.log(`         ~ ${x.name} [${x.relation}] adds {${x.addedProps.join(",")}} drops {${x.missingProps.join(",")}}`);
  }
}
console.log("\n  Note the two checks PARTITION the problem rather than double-report: the");
console.log("  OVERLAPPING surface is 1 collision group and 0 variation families (identical");
console.log("  at call time, but no name nests inside another), while the fixture is the");
console.log("  reverse. Zero families never means a surface is clean — only that these");
console.log("  signals did not fire on these names and schemas.");

console.log("\nNote: the saving above is the token axis only. Overlap's real cost is pick");
console.log("ACCURACY at call time — a different problem progressive disclosure does NOT");
console.log("solve. Two {query:string} tools stay indistinguishable no matter how cheaply");
console.log("they load. This is the point two r/mcp practitioners made, and they are right:");
console.log("the accuracy fix is FEWER, GENUINELY DISTINCT TOOLS — merge variations into");
console.log("parameters. variationCandidates helps you FIND those; you make the call.");
