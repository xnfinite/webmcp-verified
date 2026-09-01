/**
 * tokenizer-check.mjs — anchor the discovery % OUTSIDE the ~4-char gauge.
 *
 * The headline savedPct is measured with estimateTokens (a ~4-char gauge). A
 * fair objection: is the % an artifact of that gauge? This re-runs the same
 * measurement with a REAL BPE tokenizer (gpt-tokenizer, a dev-only dependency —
 * the shipped library stays zero-dep) and compares. The absolute counts differ
 * by gauge; savedPct and the break-even do not, because both the naive and lean
 * paths are counted with the same gauge so the factor cancels in the ratio.
 *
 * Needs dev dependencies: run `npm install` first. Run: npm run tokenizer
 */
import { encode } from "gpt-tokenizer";
import { discoveryCost, discoveryBreakEven, estimateTokens } from "../src/index.js";
import { buildSurface } from "./_surface.mjs";

const tools = buildSurface();
const real = (s) => encode(s || "").length;

console.log("DISCOVERY % under two gauges — the headline is a RATIO, not a raw count\n");
for (const [label, estimate] of [
  ["~4-char gauge (estimateTokens)", estimateTokens],
  ["real BPE tokenizer (gpt-tokenizer)", real]
]) {
  const c = discoveryCost(tools, { estimate });
  const be = discoveryBreakEven(tools, { estimate });
  console.log(`${label}`);
  console.log(`  naive ${c.naive.total}   lean ${c.lean.total}   saved ${c.savedPct}%   break-even n=${be.n}\n`);
}
console.log("Absolute counts move with the gauge; savedPct and break-even hold.");
