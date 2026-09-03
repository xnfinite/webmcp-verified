# What this truly does for token cost (the north star)

Grounded in the ICM (Interpretable Context Methodology) paper's own
token thesis. This is the thing to get right — everything else is polish.

## The one idea

**webmcp-verified is progressive disclosure for agent tools — the ICM
catalog, one layer down.**

The ICM saves a *Claude session* tokens by not making it read the whole
workspace: a tiny catalog lets it skip to the 3 files it needs, not load
300. "Scoped context beats monolithic" — 2–8k focused tokens vs 40k+ of
mostly-irrelevant clutter, and models measurably degrade on long
cluttered context ("lost in the middle").

A visiting *AI agent* has the exact same problem one layer down. When it
lands on a page with tools, it must load every tool's description and
schema into its context just to decide which one to call. A verbose tool
surface is the agent's version of the 40k monolithic load — it pays for
it on every visit, and it reasons worse for it.

This library is the catalog for that agent:

- **Lean manifest** = the catalog (L1 routing). One line per tool
  (name + first sentence). The agent chooses from the cheap map.
- **`describe_tool` on demand** = progressive disclosure. The full
  detail (`help`, full schema) is pulled ONLY for the tool the agent
  actually uses — like reading the 3 files, not all 300.
- **Compact results** = scoped context. The answer is lean, not a blob.

**The saving is real and it's this: the agent pays for the context it
uses, not the context it doesn't.** Same mechanism the ICM proved on
sessions, applied to agents.

## Where the tokens actually are (don't measure the wrong axis)

Two axes, and the pitch is really about the first:

1. **Discovery** (the big one): the descriptions + schemas the agent
   loads to CHOOSE a tool, on every page visit, across ALL tools. Lean
   manifest + describe-on-demand attacks this. **This is the headline
   saving and it is now MEASURED** — `discoveryCost` / `discoveryBreakEven`
   meter it, and default to `list:"served"`: the schema sits IN the list,
   because MCP requires it there (`Tool.inputSchema` carries no `?` in the
   spec's schema.ts, MCP 2025-06-18 and 2026-07-28 —
   https://modelcontextprotocol.io/specification/2026-07-28/server/tools).
   `mount()` registers every tool's full `inputSchema` regardless of host,
   so this is the number a standard MCP or WebMCP host actually pays. On
   **14 real tools from 5 official MCP servers, served**: **1112 lean vs
   1217 naive — 9% saved, break-even n=4** (`npm run real-mcp`; used=0,
   i.e. before the agent describes anything, saves 21%). On the
   illustrative 12-tool surface, served: 882 vs 1340, **34% saved,
   break-even n=4** (`npm run discovery`; used=0 saves 42%; both surfaces
   pinned by smoke tests T38/T46/T47).

   `list:"deferred"` is an explicit, separate option that meters the upper
   bound: the list carries no schema at all, and `describe_tool` is the
   only place the agent ever sees one. That shape holds only on a host
   that lets a tool list omit `inputSchema` — the WebMCP Community Group's
   draft WebIDL (https://webmachinelearning.github.io/webmcp/) does list
   `object inputSchema;` with no `required` keyword, so a future WebMCP
   host could permit it, but this library registers the schema either way
   and no standard MCP host omits it today. Under that assumption: real 14
   tools, 536 lean vs 1217 naive — 56% saved, break-even n=3
   (`npm run real-mcp`); illustrative, 443 vs 1340, 67%, break-even n=2
   (`npm run discovery`).

   A real BPE tokenizer holds the ratio per mode, not as one universal
   number: served 29% (n=5) vs the ~4-char gauge's 34% (n=4) — 5 points
   apart, break-even off by one tool; deferred 66% (n=2) vs the gauge's
   67% (n=2) — 1 point apart, same break-even (`npm run tokenizer`). So
   gauge-independence is tight in deferred mode and only approximate in
   served mode — the schema's punctuation-heavy JSON is where the ~4-char
   gauge drifts from a real tokenizer. The eval's original catch —
   `Metrics` only counting output tokens — is closed.
2. **Result** (the small one): the tokens in each answer. Compact
   provenance attacks this (~8 vs ~26 whole-output on the example; the
   provenance line itself ~3 vs ~20).

## The north star for the "best version"

Make it the **most token-efficient way to expose agent tools, and prove
it** — because we can measure what the ICM paper honestly could not
(its own caveat: "effect sizes are not measured, treat as a
well-reasoned pattern"). We can measure ours deterministically. That is
a real advantage — lead with the measurement, never a bare claim.

Concretely the best version (status: the first two are now DONE):
- [x] Measures the DISCOVERY saving: `discoveryCost(tools, { list })` (lean
  vs naive) in both `list:"served"` (schema in the list — the default, and
  what a standard MCP/WebMCP host actually shows) and `list:"deferred"`
  (schema omitted — an explicit upper bound) on an illustrative 12-tool set
  AND on 14 real MCP-server tools, plus `discoveryBreakEven(tools)` for the
  computed flip point in each mode and `discoveryCostOverTurns(tools)` for
  the same saving priced over a session under prompt caching.
- [x] Leads with the REAL, SERVED number — "14 real tools: 1112 lean vs
  1217 naive, 9% saved, break-even n=4" — reproducible via `npm run
  real-mcp`; `list:"deferred"` on the same 14 tools is the labelled upper
  bound (536 lean, 56% saved). The illustrative surface (34% served / 67%
  deferred) is labelled illustrative; both modes on both surfaces are
  pinned by smoke tests T38/T46/T47. `npm run tokenizer` cross-checks
  against a real BPE tokenizer, `npm run used-curve` and `npm run
  cache-curve` show the saving decay as the agent describes more tools and
  as a session runs under caching, and `npm run overlap` isolates the
  disambiguation axis from the token axis.
- Keeps every honesty rule the eval enforced: measured not claimed,
  scoped claims, no "can't be wrong," structuredContent so the agent
  reads data not prose.

## The honest edges (say them)

- Progressive disclosure is a net win at MANY tools; at 1 tool the
  `describe_tool` round-trip costs more than it saves. On the schema-
  deferred list (measured: lean 191 vs naive 113, a net loss of 78) it
  breaks even at n=2 (lean 217 vs naive 227). On the served list — the
  default, schema included — the round-trip costs more for longer: real
  break-even is n=4, illustrative break-even is n=4 too (see the numbers
  above). Say where the line is for the mode you're actually running — the
  code computes it either way.
- On a served surface with short help text and a small schema, the
  discovery saving itself is small: real 14 tools save 9% at used=1 (one
  tool described), and a 10-turn session under caching is already
  negative by the time the agent describes a second tool (used=2: -6%,
  `npm run cache-curve`, USED SWEEP). Progressive disclosure earns the
  most where `help` text is long and schemas are large; on a lean,
  short-schema surface the win is thin and reverses fast.
- Grounding stops invention; it doesn't make your data correct.
- We measure token counts (deterministic). **This is a cost lever, not an
  accuracy fix**: it does not make the agent pick the right tool, and when two
  one-line summaries look alike it can make picking *worse*, because the
  disambiguating schema is exactly what got deferred. The accuracy fix is
  fewer, genuinely distinct tools (r/mcp practitioner feedback, 2026-09-01).
- Raw tokens are not cost under **prompt caching** — this is now MEASURED.
  `discoveryCostOverTurns(tools, opts)` prices a session: the tool list
  sits in the cached prefix from turn 2 on (cheap to re-read); each
  `describe_tool` result is metered as first-time input; every describe
  call is conservatively assumed to land on turn 1 (the worst case for
  lean). Price ratios — `input 1, output 5, cacheWrite 1.25, cacheRead
  0.1` — are one vendor's published numbers at the time of writing
  (https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching)
  and are PARAMETERS the caller overrides, not facts baked into the
  library. Real 14-tool surface, served, used=1: cumulative saved% by
  turn 1/2/5/10/20/50 = 2/3/4/5/6/7 — no crossover, steady state 121.7
  naive vs 111.2 lean tokens per turn (`npm run cache-curve`). Deferred:
  49% -> 55% over the same turns. Illustrative surface: served 28% -> 33%,
  deferred 61% -> 66%. This holds only because the list itself doesn't
  change turn to turn: `describe_tool` returns a result, it never
  re-registers or mutates a tool, so `tools/list` stays byte-identical
  across a session — smoke test T50 pins exactly that (mounts the real
  surface, describes every tool, checks the registered objects are
  unchanged). A client that rebuilds the list every turn anyway erases
  most of the win: real served at turns=10 drops to 8%
  (`{ rebuildListEveryTurn: true }`).
