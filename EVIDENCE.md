# Evidence — auto-generated

_Regenerated 2026-08-31 20:29 UTC by `node scripts/evidence.mjs`. Reproducible: clone,
run the command, get this file. Nothing here is asserted by hand._

## Guarantees, tested live

- **Smoke tests:** ALL PASS — 50 passed.
  Covers: values derive from source, off-source returns a fallback (no
  invented number), customer/internal surface split, injected/unknown
  args dropped before resolve, out-of-enum rejected, read-only default,
  structural redaction, audit receipt + tamper-detection, token metering.
- **Worked example:** ran clean. Live per-call
  metrics from a real run:

```json
"get_quote": {
    "calls": 3,
    "grounded": 2,
    "fallback": 1,
    "error": 0,
    "avgMs": 5.2,
    "maxMs": 15.2,
    "totalTokens": 136,
    "avgTokens": 45
  }
```

  `avgTokens` is the measured cost of a call — the reason an agent prefers
  these tools. `grounded` vs `fallback` shows the no-guess rule firing.

- **Discovery axis (the headline):** measured by
  `node scripts/benchmark.mjs` on an illustrative 12-tool store/service
  surface (`scripts/_surface.mjs`) —

  > 12 tools cost 443 tokens to discover the lean way vs 1340 naive — saved 897 (67%); lean overtakes naive at n=2 tools.

  This is the cost an agent pays to CHOOSE among tools (descriptions + schemas),
  per context-load of the tool list. `estimateTokens` is a ~4-char gauge, so
  absolute counts are approximate; `savedPct` and the break-even n are the
  robust figures (both paths use the same gauge, so the factor cancels). It
  counts tokens, not reasoning quality. The exact numbers are pinned by smoke
  test T38, so this line cannot silently drift from the code.

## Raw smoke output

```
PASS rejects thin description
PASS grounded price derived from source ($20)
PASS customer surface hides internal rows
PASS stamps provenance
PASS unknown returns fallback with no invented price
PASS internal surface shows internal rows
PASS metrics record grounded + fallback
PASS metrics record token cost (24 avg)
PASS manifest line is lean (first sentence only)
PASS describe_tool serves full detail on demand
PASS compact provenance costs fewer tokens (8 < 15)
PASS harness flags a margin leak
PASS unknown/injected args are dropped (only schema props reach resolve)
PASS missing required field reported, no value invented
PASS out-of-enum value rejected (treated as absent)
PASS tools are read-only by default (least privilege)
PASS mutating tool is flagged for human-in-the-loop
PASS customer surface structurally cannot render internal rows
PASS each answer emits a receipt (tool + outcome)
PASS receipt carries result+source fingerprint and timestamp
PASS fingerprint is deterministic and content-sensitive
PASS a receipt verifies against the exact answer it recorded
PASS a tampered answer fails receipt verification
PASS grounded call returns structuredContent with values as data
PASS fallback call marks structuredContent.sourced = false
PASS T26 describeText equals real describe_tool output (no format drift)
PASS T27 naive loads full text + schema per tool (heavier than the lean manifest line)
PASS T28 lean.total = manifest + describeToolDescriptor + onDemand (structural honesty)
PASS T29 lean wins at 12 tools (saved 824, 66%)
PASS T30 lean loses at N=1 (describe_tool round-trip costs more than it saves)
PASS T31 break-even computed (lean overtakes naive at n=2)
PASS T32 discoveryCost is deterministic (EVIDENCE numbers reproduce)
PASS T33 savedPct = round(saved/naive*100)
PASS T33 empty set: no divide-by-zero (savedPct 0, no NaN/Infinity)
PASS T34 used scales lean cost, clamps to N, describe_tool filtered (not double-counted)
PASS T37 realistic surface is 12 distinct tools with real schemas (max 4 props)
PASS T38 benchmark headline pinned: 12 tools, naive 1340, lean 443, saved 897 (67%), break-even n=2
PASS Fix1 missing-required emits a receipt (fallback, hashed result, null sourceHash — source not consulted)
PASS Fix1 missing-required meters tokens + structuredContent, text unchanged (no invented value)
PASS Fix2 no-metrics tools get separate meters (no cross-tool bleed)
PASS Fix5 thrown source returns a readable isError result (metered 'error' + receipt), nothing invented
PASS Fix5 harness flags the isError result as a journey failure
PASS LEAK regex: bare-margin false-positive fixed; still catches markup/gross margin/COGS
PASS Fix3 package.json files[] ships proof assets (EVIDENCE.md, examples) and every listed path exists
PASS T35 verified tool mounts onto an @mcp-b-style host; getTools exposes the lean descriptor
PASS T35 agent drives discover/call/fallback/describe entirely through the host surface
PASS T36 examples/mcp-b-interop.mjs runs via node and grounds a real value through the host
PASS TD1 src/index.d.ts value exports match runtime (12 exports, no drift)
PASS TD2 src/harness.d.ts value exports match runtime (3 exports, no drift)
PASS TD3 package.json "types" resolves (./src/index.d.ts) and ./harness has a co-located .d.ts

ALL SMOKE TESTS PASSED
```

---

_Local automation only. This file is committed locally; publishing it to a
public repo is a deliberate human step (machine builds, human publishes)._
