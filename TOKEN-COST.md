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
   meter it. On **14 real tools from 5 official MCP servers**: **536 lean vs
   1217 naive to discover a tool — 56% saved, break-even n=3**
   (`npm run real-mcp`). On the illustrative 12-tool surface: 443 vs 1340,
   67%, break-even n=2 (`npm run discovery`, pinned by smoke test T38). A real
   BPE tokenizer gives 66% vs the gauge's 67%, so the % is not a gauge artifact
   (`npm run tokenizer`). The eval's original catch — `Metrics` only counting
   output tokens — is closed.
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
- [x] Measures the DISCOVERY saving: `discoveryCost(tools)` (lean vs the
  full-schema cost the agent would otherwise load) on an illustrative 12-tool
  set AND on 14 real MCP-server tools, plus `discoveryBreakEven(tools)` for
  the computed flip point.
- [x] Leads with the REAL number — "14 real tools: 536 lean vs 1217 naive,
  56% saved" — reproducible via `npm run real-mcp`; the illustrative 67% is
  labelled illustrative and pinned by smoke test T38.
- Keeps every honesty rule the eval enforced: measured not claimed,
  scoped claims, no "can't be wrong," structuredContent so the agent
  reads data not prose.

## The honest edges (say them)

- Progressive disclosure is a net win at MANY tools; at 1 tool the
  `describe_tool` round-trip costs more than it saves (measured: lean 191
  vs naive 113, a net loss of 78). It breaks even and starts winning at
  n=2 (lean 217 vs naive 227). Say where the line is — the code computes it.
- Grounding stops invention; it doesn't make your data correct.
- We measure token counts (deterministic). **This is a cost lever, not an
  accuracy fix**: it does not make the agent pick the right tool, and when two
  one-line summaries look alike it can make picking *worse*, because the
  disambiguating schema is exactly what got deferred. The accuracy fix is
  fewer, genuinely distinct tools (r/mcp practitioner feedback, 2026-09-01).
- Raw tokens are not cost under **prompt caching**. A static full tool list
  sits in the cached prefix from turn 2 and is cheap; a deferred schema arrives
  as fresh input. Our lean path keeps `tools/list` static (`describe_tool`
  returns a result, it never re-registers), so the prefix survives — but the
  describe result may not be cached, and over a long session the margin
  shrinks. Not yet modelled; say so until it is.
