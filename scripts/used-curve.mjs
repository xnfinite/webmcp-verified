/**
 * used-curve.mjs — the honest "when does progressive disclosure stop paying?"
 *
 * The headline savedPct assumes the agent describes+calls ONE tool per visit
 * (discoveryCost default used=1). This prints savedPct for used=1..N: the win
 * shrinks as the agent uses more of the surface, and goes NEGATIVE once it uses
 * most of it (you then pay the list + describe_tool overhead for tools you'd
 * have loaded up front anyway). Progressive disclosure wins when an agent
 * touches a SMALL FRACTION of the tools it can see — the realistic case — and
 * loses when it touches most.
 *
 * Printed for both list modes, served first: served is the list mount()
 * registers (schema in the list, only the help deferred); schema-deferred is
 * the upper bound for a host that lets you omit inputSchema from the list.
 * Run: npm run used-curve
 */
import { discoveryCost } from "../src/index.js";
import { buildSurface } from "./_surface.mjs";

const tools = buildSurface();

const MODES = [
  ["served", "served: schema in the list (what mount() registers on an MCP/WebMCP host)"],
  ["deferred", "schema-deferred: only if your host lets you omit inputSchema from the list"]
];

for (const [list, label] of MODES) {
  console.log(label);
  console.log(`savedPct as 'used' grows (${tools.length}-tool surface, naive is constant, list=${list}):\n`);
  for (let used = 1; used <= tools.length; used++) {
    const c = discoveryCost(tools, { list, used });
    const n = Math.round(Math.abs(c.savedPct) / 3);
    const bar = (c.savedPct >= 0 ? "+" : "-").repeat(Math.max(0, n));
    console.log(`  used=${String(used).padStart(2)}  saved ${String(c.savedPct).padStart(4)}%  ${bar}${c.leanWins ? "" : "  ← lean loses"}`);
  }
  console.log("");
}
