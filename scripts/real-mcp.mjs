/**
 * real-mcp.mjs — the discovery measurement on a REAL surface.
 *
 * Instead of the illustrative surface in _surface.mjs, this runs discoveryCost
 * on 14 actual tools from 5 official MCP servers (filesystem, github, git,
 * fetch, memory) — real names, real descriptions, real input schemas. The tool
 * definitions live in _real-mcp-surface.mjs so this script and the live demo
 * measure the SAME surface and can never print divergent headlines.
 *
 * Both list modes are printed, served first:
 *   served   — the list carries name + one-line + inputSchema, which is what
 *              mount() registers and what an MCP/WebMCP host shows the agent;
 *              only the long-form help is deferred. On a real surface the
 *              schema payload outweighs the help text, so deferring help
 *              alone saves little. This is the number to quote.
 *   deferred — the list omits inputSchema. An upper bound that holds only on
 *              a host that lets you omit the schema from the list; standard
 *              hosts do not.
 *
 * evidence.mjs scrapes the FIRST "discover naive … lean …" and "saved … break-
 * even …" lines, so the served block must stay first. Run: npm run real-mcp
 */
import { discoveryCost, discoveryBreakEven, schemaCollisions, variationCandidates } from "../src/index.js";
import { buildRealSurface, realServers } from "./_real-mcp-surface.mjs";

const tools = buildRealSurface();
const collisions = schemaCollisions(tools);
const variations = variationCandidates(tools);

const MODES = [
  ["served", "served: schema in the list (what mount() registers on an MCP/WebMCP host)"],
  ["deferred", "schema-deferred: only if your host lets you omit inputSchema from the list"]
];

const servers = [...new Set(realServers)];
console.log(`REAL MCP SURFACE — ${tools.length} tools from ${servers.length} official servers`);
console.log(`  (${servers.join(", ")})\n`);
for (const [list, label] of MODES) {
  const cost = discoveryCost(tools, { list });
  const be = discoveryBreakEven(tools, { list });
  console.log(`  ${label}`);
  console.log(`  discover naive: ${cost.naive.total} tokens   lean: ${cost.lean.total} tokens`);
  console.log(`  saved ${cost.saved} (${cost.savedPct}%)   break-even n=${be.n}\n`);
}
console.log("  DISAMBIGUATION AXIS — design checks. Not tokens, and no claim about pick accuracy.\n");
console.log(`  schemaCollisions (tools an agent can't tell apart): ${collisions.length} group(s)`);
for (const g of collisions) console.log(`    ${g.tools.join(", ")}  — same shape ${g.signature}`);

// The false-positive control, printed. These 14 are a well-designed real
// surface, so a heuristic that suggests merges should be nearly silent on them.
console.log(`\n  variationCandidates [HEURISTIC — suggests, never detects or decides]:`);
console.log(`    ${variations.families.length} famil${variations.families.length === 1 ? "y" : "ies"}, ${variations.involved.length} of ${variations.tools} tools involved`);
for (const f of variations.families) {
  console.log(`    base ${f.base}  ->  one tool taking [${f.candidateParams.join(", ")}]?`);
  for (const v of f.variants) console.log(`      ~ ${v.name} [${v.relation}] adds {${v.addedProps.join(",")}} drops {${v.missingProps.join(",")}}`);
}
console.log("\n  This surface is the FALSE-POSITIVE CONTROL, and it is pinned by smoke test T40:");
console.log("  a well-designed surface should raise few or no merge questions. Zero is NOT a");
console.log("  clean bill of health — it means these signals did not fire on these names and");
console.log("  schemas. The heuristic reads names + input shapes only. It cannot read meaning,");
console.log("  cannot see what a tool returns, and never decides a merge. That is a human call.");

console.log("\n  (~4-char gauge; savedPct + break-even are the robust figures. served − deferred");
console.log("   is exactly the schema payload in the list; the naive side is the same in both.");
console.log("   Descriptions verbatim from server source; GitHub prop types README-derived.)");
