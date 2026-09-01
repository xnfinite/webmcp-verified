/**
 * used-curve.mjs — the honest "when does progressive disclosure stop paying?"
 *
 * The headline savedPct assumes the agent describes+calls ONE tool per visit
 * (discoveryCost default used=1). This prints savedPct for used=1..N: the win
 * shrinks as the agent uses more of the surface, and goes NEGATIVE once it uses
 * most of it (you then pay the manifest + describe_tool overhead for tools you'd
 * have loaded up front anyway). Progressive disclosure wins when an agent
 * touches a SMALL FRACTION of the tools it can see — the realistic case — and
 * loses when it touches most. Run: npm run used-curve
 */
import { discoveryCost } from "../src/index.js";
import { buildSurface } from "./_surface.mjs";

const tools = buildSurface();
console.log(`savedPct as 'used' grows (${tools.length}-tool surface, naive is constant):\n`);
for (let used = 1; used <= tools.length; used++) {
  const c = discoveryCost(tools, { used });
  const n = Math.round(Math.abs(c.savedPct) / 3);
  const bar = (c.savedPct >= 0 ? "+" : "-").repeat(Math.max(0, n));
  console.log(`  used=${String(used).padStart(2)}  saved ${String(c.savedPct).padStart(4)}%  ${bar}${c.leanWins ? "" : "  ← lean loses"}`);
}
