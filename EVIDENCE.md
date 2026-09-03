# Evidence — auto-generated

_Regenerated 2026-09-03 04:56 UTC by `node scripts/evidence.mjs`. Reproducible: clone,
run the command, get this file. Nothing here is asserted by hand._

## Guarantees, tested live

- **Smoke tests:** ALL PASS — 71 passed.
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
    "avgMs": 7.8,
    "maxMs": 22.8,
    "totalTokens": 136,
    "avgTokens": 45
  }
```

  `avgTokens` is the measured cost of a call — the reason an agent prefers
  these tools. `grounded` vs `fallback` shows the no-guess rule firing.

- **Discovery axis (the headline):** measured by
  `node scripts/benchmark.mjs` on an illustrative 12-tool store/service
  surface (`scripts/_surface.mjs`). The list an agent reads carries name +
  one-line description + inputSchema — that is what `mount()` registers on an
  MCP/WebMCP host — and only the long-form help is deferred behind
  `describe_tool`.

  served: schema in the list (what mount() registers on an MCP/WebMCP host)

  > 12 tools cost 882 tokens to discover the lean way vs 1340 naive — saved 458 (34%); lean overtakes naive at n=4 tools. [served: schema in the list]

  schema-deferred: only if your host lets you omit inputSchema from the list
  (an upper bound, not what a standard host serves)

  > 12 tools cost 443 tokens to discover the lean way vs 1340 naive — saved 897 (67%); lean overtakes naive at n=2 tools. [upper bound: schema omitted from the list]

  This is the cost an agent pays to CHOOSE among tools (descriptions + schemas),
  per context-load of the tool list. `estimateTokens` is a ~4-char gauge, so
  absolute counts are approximate; `savedPct` and the break-even n are the
  robust figures (both paths use the same gauge, so the factor cancels). It
  counts tokens, not reasoning quality. The exact numbers in both modes are
  pinned by smoke test T38, so these lines cannot silently drift from the code.

- **Real MCP surface (the number to quote):** measured by
  `npm run real-mcp` on 14 real tools from 5 official MCP servers
  (filesystem, github, git, fetch, memory — `scripts/_real-mcp-surface.mjs`).

  served: schema in the list (what mount() registers on an MCP/WebMCP host)

  > naive 1217 tokens → lean 1112 tokens — 9% saved, break-even n=4

  schema-deferred: only if your host lets you omit inputSchema from the list

  > naive 1217 tokens → lean 536 tokens — 56% saved, break-even n=3

  Lower than the illustrative surface: on real servers the schema payload
  outweighs the long-form help text, so deferring help alone saves little, and
  the schema-deferred figure is reachable only on a host that lets you omit
  inputSchema from the list. Both modes are pinned by smoke test T46. Same
  caveat: this is a COST axis; it says nothing about whether the agent picks
  the right tool.

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
PASS T27 naive loads full text + schema per tool (heavier than the one-line list entry)
PASS T28 lean.total = list + describeToolDescriptor + onDemand (structural honesty; lean.manifest aliases lean.list)
PASS T29 lean wins at 12 tools under the served default (saved 431, 35%)
PASS T30 lean loses at N=1 under the served default (describe_tool round-trip costs more than it saves)
PASS T31 break-even computed under the served default (lean overtakes naive at n=4)
PASS T32 discoveryCost is deterministic in both list modes (EVIDENCE numbers reproduce)
PASS T33 savedPct = round(saved/naive*100)
PASS T33 empty set: no divide-by-zero (savedPct 0, no NaN/Infinity)
PASS T34 used scales lean cost, clamps to N, describe_tool filtered (not double-counted)
PASS T37 realistic surface is 12 distinct tools with real schemas (max 4 props)
PASS T38 served headline pinned (schema in the list, the default): 12 tools, naive 1340, lean 882, saved 458 (34%), break-even n=4
PASS T38 schema-deferred upper bound pinned (list:"deferred" passed explicitly): naive 1340, lean 443, saved 897 (67%), break-even n=2
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
PASS T39 schemaCollisions flags the two identical-schema tools, not the distinct one
PASS T39 no collision reported when every schema is distinct
PASS T40 FP control: 0 families on the 14 real MCP tools (strict + default) and on the 12-tool surface
PASS T41 flags the mergeable family: get_reviews(days, sentiment, version) from 3 variants
PASS T42 conjunction holds: name-nesting alone (maps_geocode) and schema-nesting alone (git_status) both stay silent
PASS T43 checks partition (1 collision group, 0 variation families); deterministic; describe_tool filtered; empty/null safe
PASS T44 strict drops the near-superset (2 variants -> 1 exact superset), and echoes the gate it ran under
PASS T45 required-core guard: a dropped REQUIRED prop disqualifies; the same shape with it optional is offered (documented weak case)
PASS T46 real 14-tool served headline pinned (schema in the list, the default): naive 1217, lean 1112, saved 105 (9%), break-even n=4
PASS T46 real 14-tool schema-deferred upper bound pinned (list:"deferred" passed explicitly): naive 1217, lean 536, saved 681 (56%), break-even n=3
PASS T47 mode invariants hold on both surfaces (served >= deferred; served − deferred = the schema payload in the list layout; default is served; used=0 accepted — real-surface served used=0 saves 21%; bad mode throws)
PASS T48 (a) cache model turn 1 re-derived from raw expressions: lean 1911.25 = 960×cacheWrite + 3×(20×output + describe×cacheWrite); naive 1521.25; turn 2+ = cacheRead of the prefix + describe results
PASS T48 (b) cumulative totals are running sums, non-decreasing, total = last row; savedPct integer; turns=1 and an empty set are safe
PASS T48 (c) real 14-tool session pinned (turns=10, used=1, default prices): served 5% (turn 1: 2%), deferred 52% (turn 1: 49%), crossover none in either; illustrative 31% / 63%
PASS T48 (d) rebuildListEveryTurn=true never lowers either side's total (turn 1 unchanged; every later turn priced at cacheWrite on both paths)
PASS T48 (e) custom prices respected (echoed and applied), partial prices merge over defaults, describeCallTokens moves exactly used×tokens×output, bad turns/prices throw
PASS T49 default manifest is byte-identical to the fixture (no opts, {}, and signatures:false)
PASS T49 signatures format exact: "Find a thing by id or name. (args: id, name?, limit?)" (declaration order, "?" = optional; no-property tool unchanged; source tools untouched)
PASS T49 signatures cost on the real 14-tool deferred list pinned: 321 → 444 tokens (+123), savedPct 56% → 46%; served ignores it; discoveryCostOverTurns passes it through
PASS T50 tools/list stays static: after describing all 14 tools (+1 miss), registerTool count 15 unchanged, same 15 object references, served list + manifest byte-identical, no tool mutated
PASS TD1 src/index.d.ts value exports match runtime (16 exports, no drift)
PASS TD2 src/harness.d.ts value exports match runtime (3 exports, no drift)
PASS TD3 package.json "types" resolves (./src/index.d.ts) and ./harness has a co-located .d.ts

ALL SMOKE TESTS PASSED
```

---

_Local automation only. This file is committed locally; publishing it to a
public repo is a deliberate human step (machine builds, human publishes)._
