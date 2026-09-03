/**
 * evidence.mjs — regenerate EVIDENCE.md from a live test run.
 *
 * Runs the smoke tests, the worked example, and both discovery benchmarks
 * (illustrative 12-tool surface + 14 real MCP-server tools), captures the
 * real results and token metrics, and writes a dated, reproducible
 * EVIDENCE.md at the repo root. Proof anyone can re-run: `node scripts/evidence.mjs`.
 *
 * It writes and commits LOCALLY only. Pushing to a public repo is a human
 * step on purpose (see the note it writes into EVIDENCE.md) — unattended
 * public posting is a line we don't cross.
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = (cmd) => { try { return { ok: true, out: execSync(cmd, { cwd: root, encoding: "utf8" }) }; }
                       catch (e) { return { ok: false, out: (e.stdout || "") + (e.stderr || "") }; } };

const smoke = run("node test/smoke.mjs");
const example = run("node examples/auto-shop.mjs");
const benchmark = run("node scripts/benchmark.mjs");
const realMcp = run("node scripts/real-mcp.mjs");

const passLines = (smoke.out.match(/^PASS /gm) || []).length;
const failLines = (smoke.out.match(/^FAIL /gm) || []).length;
const allPass = /ALL SMOKE TESTS PASSED/.test(smoke.out);
const metrics = (example.out.match(/"get_quote":\s*\{[^}]*\}/) || ["(not captured)"])[0];
// The measured DISCOVERY headline line, verbatim from the benchmark (not hand-typed).
// The bare "N tools cost …" line is the SERVED figure (schema in the list — what
// mount() registers); benchmark.mjs prints the schema-deferred upper bound on
// its own prefixed line so it can never be scraped as the headline.
const discoveryHeadline = ((benchmark.out.match(/^\d+ tools cost .*$/m) || ["(not captured)"])[0]).trim();
const discoveryDeferred = ((benchmark.out.match(/^schema-deferred: (\d+ tools cost .*)$/m) || [null, "(not captured)"])[1]).trim();
// The REAL-surface figures, pulled from scripts/real-mcp.mjs output (14 tools, 5 official servers).
// real-mcp.mjs prints the SERVED block first, then the schema-deferred block:
// match index 0 is served, index 1 is deferred.
const rm = (re, i = 0) => { const all = [...realMcp.out.matchAll(re)].map((m) => m[1]); return all[i] == null ? "?" : all[i]; };
const realNaive = rm(/naive:?\s*(\d+)/gi), realLean = rm(/lean:?\s*(\d+)/gi);
const realPct = rm(/\((\d+)%\)/g), realBreakEven = rm(/break-even\s*n\s*=\s*(\d+)/gi);
const realLeanD = rm(/lean:?\s*(\d+)/gi, 1), realPctD = rm(/\((\d+)%\)/g, 1), realBreakEvenD = rm(/break-even\s*n\s*=\s*(\d+)/gi, 1);
const stamp = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";

const md = `# Evidence — auto-generated

_Regenerated ${stamp} by \`node scripts/evidence.mjs\`. Reproducible: clone,
run the command, get this file. Nothing here is asserted by hand._

## Guarantees, tested live

- **Smoke tests:** ${allPass ? "ALL PASS" : "FAILURES PRESENT"} — ${passLines} passed${failLines ? `, ${failLines} FAILED` : ""}.
  Covers: values derive from source, off-source returns a fallback (no
  invented number), customer/internal surface split, injected/unknown
  args dropped before resolve, out-of-enum rejected, read-only default,
  structural redaction, audit receipt + tamper-detection, token metering.
- **Worked example:** ${example.ok ? "ran clean" : "ERROR"}. Live per-call
  metrics from a real run:

\`\`\`json
${metrics}
\`\`\`

  \`avgTokens\` is the measured cost of a call — the reason an agent prefers
  these tools. \`grounded\` vs \`fallback\` shows the no-guess rule firing.

- **Discovery axis (the headline):** ${benchmark.ok ? "measured" : "ERROR"} by
  \`node scripts/benchmark.mjs\` on an illustrative 12-tool store/service
  surface (\`scripts/_surface.mjs\`). The list an agent reads carries name +
  one-line description + inputSchema — that is what \`mount()\` registers on an
  MCP/WebMCP host — and only the long-form help is deferred behind
  \`describe_tool\`.

  served: schema in the list (what mount() registers on an MCP/WebMCP host)

  > ${discoveryHeadline}

  schema-deferred: only if your host lets you omit inputSchema from the list
  (an upper bound, not what a standard host serves)

  > ${discoveryDeferred}

  This is the cost an agent pays to CHOOSE among tools (descriptions + schemas),
  per context-load of the tool list. \`estimateTokens\` is a ~4-char gauge, so
  absolute counts are approximate; \`savedPct\` and the break-even n are the
  robust figures (both paths use the same gauge, so the factor cancels). It
  counts tokens, not reasoning quality. The exact numbers in both modes are
  pinned by smoke test T38, so these lines cannot silently drift from the code.

- **Real MCP surface (the number to quote):** ${realMcp.ok ? "measured" : "ERROR"} by
  \`npm run real-mcp\` on 14 real tools from 5 official MCP servers
  (filesystem, github, git, fetch, memory — \`scripts/_real-mcp-surface.mjs\`).

  served: schema in the list (what mount() registers on an MCP/WebMCP host)

  > naive ${realNaive} tokens → lean ${realLean} tokens — ${realPct}% saved, break-even n=${realBreakEven}

  schema-deferred: only if your host lets you omit inputSchema from the list

  > naive ${realNaive} tokens → lean ${realLeanD} tokens — ${realPctD}% saved, break-even n=${realBreakEvenD}

  Lower than the illustrative surface: on real servers the schema payload
  outweighs the long-form help text, so deferring help alone saves little, and
  the schema-deferred figure is reachable only on a host that lets you omit
  inputSchema from the list. Both modes are pinned by smoke test T46. Same
  caveat: this is a COST axis; it says nothing about whether the agent picks
  the right tool.

## Raw smoke output

\`\`\`
${smoke.out.trim()}
\`\`\`

---

_Local automation only. This file is committed locally; publishing it to a
public repo is a deliberate human step (machine builds, human publishes)._
`;

writeFileSync(join(root, "EVIDENCE.md"), md, "utf8");
console.log(`EVIDENCE.md written — smoke ${allPass ? "PASS" : "FAIL"} (${passLines} passed), example ${example.ok ? "ok" : "err"}, benchmark ${benchmark.ok ? "ok" : "err"}, real-mcp ${realMcp.ok ? "ok" : "err"}.`);
process.exit(allPass && example.ok && benchmark.ok && realMcp.ok ? 0 : 1);
