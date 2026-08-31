/**
 * evidence.mjs — regenerate EVIDENCE.md from a live test run.
 *
 * Runs the smoke tests and the worked example, captures the real results
 * and token metrics, and writes a dated, reproducible EVIDENCE.md at the
 * repo root. This is proof anyone can re-run: `node scripts/evidence.mjs`.
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

const passLines = (smoke.out.match(/^PASS /gm) || []).length;
const failLines = (smoke.out.match(/^FAIL /gm) || []).length;
const allPass = /ALL SMOKE TESTS PASSED/.test(smoke.out);
const metrics = (example.out.match(/"get_quote":\s*\{[^}]*\}/) || ["(not captured)"])[0];
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

## Raw smoke output

\`\`\`
${smoke.out.trim()}
\`\`\`

---

_Local automation only. This file is committed locally; publishing it to a
public repo is a deliberate human step (machine builds, human publishes)._
`;

writeFileSync(join(root, "EVIDENCE.md"), md, "utf8");
console.log(`EVIDENCE.md written — smoke ${allPass ? "PASS" : "FAIL"} (${passLines} passed), example ${example.ok ? "ok" : "err"}.`);
process.exit(allPass && example.ok ? 0 : 1);
