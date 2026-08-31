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
   saving and it is currently claimed but NOT measured** (the eval
   caught this: `Metrics` only counts output tokens).
2. **Result** (the small one): the tokens in each answer. Compact
   provenance attacks this (~8 vs ~26 whole-output on the example).

## The north star for the "best version"

Make it the **most token-efficient way to expose agent tools, and prove
it** — because we can measure what the ICM paper honestly could not
(its own caveat: "effect sizes are not measured, treat as a
well-reasoned pattern"). We can measure ours deterministically. That is
a real advantage — lead with the measurement, never a bare claim.

Concretely the best version:
- Measures the DISCOVERY saving: `manifestCost(tools)` vs the full-schema
  cost the agent would otherwise load, across a realistic N-tool set.
- Puts that number — "N tools cost X tokens to discover the lean way vs
  Y the naive way" — as the headline, with a reproducible script.
- Keeps every honesty rule the eval enforced: measured not claimed,
  scoped claims, no "can't be wrong," structuredContent so the agent
  reads data not prose.

## The honest edges (say them)

- Progressive disclosure is a net win at MANY tools; at 1–2 tools the
  `describe_tool` round-trip can cost more than it saves. Say where the
  line is.
- Grounding stops invention; it doesn't make your data correct.
- We measure token counts (deterministic); we do not claim it makes the
  agent's reasoning better — only that it costs less context, which the
  literature associates with less "lost in the middle" degradation.
