# Roadmap & market read (webmcp-verified)

Research-anchored 2026-08-30. Sources are live web search; treat figures as
directional and re-check dates — the space moves monthly.

## When does "AI does this" actually happen? — it already started

- **ACP is live.** OpenAI + Stripe (+ Meta) Agentic Commerce Protocol powers
  "Buy it in ChatGPT" Instant Checkout, launched early 2026. Etsy merchants
  live; 1M+ Shopify (Glossier, SKIMS, Vuori…) and PayPal's tens of millions
  rolling out through 2026. Google's UCP announced NRF 2026.
- **Rails exist.** Visa Intelligent Commerce + Mastercard Agent Pay (2025).
- **Adoption curve (directional):** Deloitte ~25% of gen-AI enterprises
  deploy autonomous agents in 2025 → ~50% by 2027; protocols expected to
  mature/consolidate 2027–2028; ~50% of online shoppers using agents by 2030.
- **Honest split:** the money is already moving via **ACP feeds + checkout**
  (backend integration), NOT via WebMCP. **WebMCP** (in-browser tool exposure)
  is the earlier, flag-gated layer. So "agents transacting" = now; "agents
  using in-page WebMCP tools" = early. A correction on our part: the earlier
  "near-zero demand, 2027 position" read was too pessimistic — it anchored on
  WebMCP's flag status and missed ACP being live (ledger L-025/L-027).

## Who's already here (compete honestly)

- **MCP-B / WebMCP-org** — `@mcp-b/webmcp-ts-sdk`, `@mcp-b/react-webmcp`,
  `webmcp-sdk`, docs.mcp-b.ai. The established general-purpose "make your site
  agent-ready with WebMCP" SDK. Real incumbent. We are NOT another raw SDK.
- **ACP/UCP** — the commerce protocols themselves (OpenAI/Stripe, Google).
  Feeds + checkout + delegated payment. This is where merchant money flows now.

## Where we win (the layer they don't own)

1. **Verification / grounding / provenance.** When an agent quotes a
   real price to a real customer, "the model made it up" is a liability, not a
   bug. General SDKs register tools; they don't guarantee source-derived
   answers. This layer does, by construction. This is the icm-verifier discipline as code.
2. **Token efficiency (ICM progressive disclosure).** Agents pay per tool
   description (discovery) and per result. The headline is the DISCOVERY axis,
   now measured on a REAL surface — on the served list a standard MCP/WebMCP
   host actually shows (schema included in `tools/list`, the library's
   default): 14 tools from 5 official MCP servers cost 1112 lean tokens vs
   1217 naive to discover a tool — 9% fewer, break-even n=4 (`npm run
   real-mcp`). The illustrative 12-tool surface, served, is 882 vs 1340, 34%,
   break-even n=4 (`npm run discovery`, pinned by smoke tests T38/T46/T47).
   `list:"deferred"` — schema omitted from the list entirely, an explicit
   upper bound that only holds on a host that lets a tool list skip
   `inputSchema` — is 536 vs 1217 (56%) real and 443 vs 1340 (67%)
   illustrative; a real BPE tokenizer confirms the ratio per mode (`npm run
   tokenizer`). Priced over a session under prompt caching
   (`discoveryCostOverTurns`, `npm run cache-curve`): real served saved% by
   turn 1/2/5/10/20/50 is 2/3/4/5/6/7 (no crossover, steady state 121.7
   naive vs 111.2 lean tokens/turn); real deferred is 49% -> 55% over the
   same turns. A client that rebuilds the tool list every turn instead of
   trusting a cached prefix prices out differently — real served at turns=10
   is 8% under that assumption vs 5% with caching
   (`{ rebuildListEveryTurn: true }`). This is a COST axis only — it does not
   make an agent pick better (see the README correction). Plus compact
   provenance (measured 8 vs 26 tokens whole output; the provenance line
   itself ~3 vs ~20) and per-call token metering. A real cost lever the
   general SDKs don't frame around.
3. **Protocol-agnostic trust layer.** The `source`/`resolve`/`surface`
   discipline is not WebMCP-specific; it maps onto ACP/MCP tool surfaces too.
   Position as "the trust + cost layer for agent tools," not "a WebMCP SDK."

## The 100% use case: liability (research 2026-08-30)

The must-have isn't convenience — it's legal exposure. Precedent, not
prediction:
- **Air Canada (2024):** held liable for a refund policy its chatbot
  invented. "No difference whether the info comes from a static page or a
  chatbot."
- **Reported / unverified — re-check before citing publicly:** additional
  2026 rulings and regulator statements (e.g. a German court, the UK CMA) are
  reported to affirm the same principle even when a third party built the
  agent, and insurers (Lloyd's of London) are said to be pricing
  AI-hallucination risk. Treat these as directional market signal, NOT cited
  fact — only Air Canada above is a confirmed, linked precedent. (Cut a
  much-repeated "Chevy $1 Tahoe, legally binding" line: that 2023 event was a
  prompt-injection demo, never litigated or held binding — exactly the
  misinformation this project exists to stop, so it can't live in our docs.)

So the buyer is any business whose AI states prices/policies/eligibility a
customer acts on — and as agents move to checkout (ACP live), that's a huge,
growing, MUST-HAVE segment, not a nice-to-have. Positioning: **the
accountability layer for customer-facing AI**, not "a dev toolkit."
Differentiator the research demanded ("logging the LLM reply alone is
useless for forensics"): PROOF, not just prevention — the audit receipt
(v0.4). Honest scope: we prevent invention + prove what was said; we do NOT
guarantee the source data is correct (that stays the business's job) — never
oversell that.

## How a solo competes with an incumbent SDK (MCP-B)

You don't out-ship an established open-source SDK. You don't try. Instead:

1. **Attach, don't compete.** Ship as a layer that works WITH
   `@mcp-b/webmcp`, not against it (adapter + example). Their adoption
   becomes our distribution — every MCP-B user is a candidate for the
   trust+cost layer. Interop is the wedge.
2. **Own one narrow, high-stakes axis:** provenance / can't-misquote,
   framed for commerce/money/regulated where being wrong is a
   liability. Depth over breadth.
3. **Distribution = story + receipts,** the one edge a solo has and a
   funded team can't fake: the lived scar log / ledger discipline.
   Opinionated tools with a story get the stars (the repo-roundup rule).
4. **Flank to ACP** — the protocol already moving money — while they're
   camped on WebMCP.
5. **The package is the PROOF, not necessarily the business.** The
   revenue is likely the agent-readiness audit/service (harness pointed
   at any site); the open-source package is the credibility artifact
   that sells it. Success = cited + leads, not installs-vs-MCP-B.

## From the independent AI evaluation (2026-08-31)

A fresh AI reviewed the library for "would an agent call / an assistant
recommend this?" Applied the trust-gating honesty fixes immediately (they
were the exact overclaim/unverified-numeral class the ICM ledger warns
about): re-attributed the 8-vs-26 token claim (whole output, not the
provenance line; "✓ sourced" is ~3 tokens not 8), reconciled the version
(0.1.0 → 0.5.0 everywhere), softened "the AI physically can't state…" to
the tool-return boundary + "stops invention, not every mistake," marked
the German/CMA rulings "reported," flagged the pre-publish install line,
and added `structuredContent` (values as data, not prose). Still open,
tracked here:
- [x] Ship `.d.ts` types (emit from JSDoc) — typed libs get recommended
      by default. **Delivered** — `src/index.d.ts` + `src/harness.d.ts` ship,
      the `types` field resolves to them, and smoke tests TD1–TD3 assert the
      declared exports don't drift from the runtime (16 index + 3 harness).
- [x] `manifestCost(tools)` / `describeCost(name)` — meter the DISCOVERY
      token axis (the actual "cheap for the agent" pitch), not just output.
      **Delivered v0.6**, revised v0.7 — `discoveryCost(tools, { list })`
      (lean vs naive, saved, savedPct, leanWins) + `discoveryBreakEven(tools)`
      (the computed N where lean starts to win), now with an explicit
      `list:"served"|"deferred"` mode (see the dated 2026-09-02 entries
      below for why the v0.6 default changed). Measured on the illustrative
      12-tool set, served (the default, schema in the list): 882 vs 1340
      tokens, 34% saved, break-even n=4. `list:"deferred"` — an upper bound,
      not the standard-host number — is 443 vs 1340, 67% saved (897 tokens),
      break-even n=2. Headline reproduced by `node scripts/benchmark.mjs`
      (pinned by smoke test T38); the sibling `scripts/discovery.mjs` prints
      the per-tool composition. See `EVIDENCE.md`.
- [x] `@mcp-b/webmcp` interop example. **Delivered** —
      `examples/mcp-b-interop.mjs` mounts a verified tool onto an
      @mcp-b-style host by its `registerTool` alone and drives
      discover/call/fallback/describe through the host surface; runs under
      Node and grounds a real value. Covered by smoke tests T35–T36.
- [x] Emit an audit receipt on the missing-required path too. **Delivered
      v0.6** — the missing-required and error paths now meter tokens, emit a
      receipt (sourceHash null: source not consulted), and return
      `structuredContent`; errors return `isError:true`, not a thrown crash.
- [x] Surface-design checks, from r/mcp practitioner feedback (2026-09-01):
      `schemaCollisions` (a fact — tools identical at call time) and
      `variationCandidates` (a heuristic — tools that look like one tool plus a
      parameter). False-positive control pinned by smoke test T40: 0 families on
      the 14 real MCP tools. The same feedback produced the README correction
      that the lean manifest is a cost lever, not an accuracy fix.
- [x] `discoveryCost` served/deferred model (2026-09-02). The v0.6 number
      assumed the schema could be dropped from the tool list unconditionally;
      MCP requires `inputSchema` in `tools/list` (spec schema.ts, no `?`
      marker, MCP 2025-06-18 and 2026-07-28) and `mount()` registers it
      regardless of host, so that number was an upper bound dressed as the
      default. **Fixed** — `discoveryCost(tools, { list })` now defaults to
      `list:"served"` (schema in the list, what `mount()` actually
      registers) and treats `list:"deferred"` as an explicit, separately
      labelled option (permitted, not required, by the WebMCP CG's draft
      WebIDL — https://webmachinelearning.github.io/webmcp/ — which lists
      `object inputSchema;` with no `required` keyword). Real 14-tool
      surface: served 9% saved (break-even n=4), deferred 56% (break-even
      n=3); illustrative: served 34% (n=4), deferred 67% (n=2). Pinned by
      smoke tests T38/T46/T47 (`npm run real-mcp`, `npm run discovery`).
- [x] `discoveryCostOverTurns(tools, opts)` (2026-09-02). Raw discovery
      tokens are not session cost under prompt caching — a static tool list
      sits in the cached prefix from turn 2 on and is cheap to re-read.
      **Delivered** — prices a session with `prices` and
      `describeCallTokens` as overridable parameters, not hardcoded facts.
      Real 14-tool surface, served, used=1: cumulative saved% by turn
      1/2/5/10/20/50 = 2/3/4/5/6/7 (no crossover, steady state 121.7 naive
      vs 111.2 lean tokens/turn); deferred goes 49% -> 55% over the same
      turns. Pinned by smoke tests T48(a)-(e) (`npm run cache-curve`).
- [x] `manifest(tools, { signatures: true })` (2026-09-02) — on a
      `list:"deferred"` host the one-liner does all the disambiguation
      work, so this appends `(args: a, b?)` to each description (argument
      names in declaration order, "?" marks optional), a fix a r/mcp
      practitioner asked for directly. **Delivered with its cost measured,
      not just its benefit**: real 14-tool deferred list goes 321 -> 444
      tokens (+123), savedPct 56% -> 46%; illustrative 275 -> 364 (+89),
      67% -> 60%. Served mode ignores it (the schema already carries the
      argument names). Pinned by smoke test T49.
- [x] Static-list test (2026-09-02) — the lean path only keeps its cache-
      prefix advantage (see `discoveryCostOverTurns` above) if
      `describe_tool` never re-registers or mutates a tool, so `tools/list`
      stays byte-identical across a session. **Delivered and pinned** —
      smoke test T50 mounts the real 14-tool surface, describes every tool
      (plus one miss), and asserts the `registerTool` count, the registered
      object references, and the served list/manifest are all unchanged.

## Build order (not one go)

- [x] v0.1 — verified tools, surface redaction, harness, metrics
- [x] v0.2 — progressive disclosure (manifest / describe_tool / compact
      provenance), token metering, dual human/AI readability, honest README
- [ ] v0.3 — an ACP-shaped adapter (same `source`/`resolve`, emit an ACP
      product-feed / tool schema) so the trust+cost layer reaches where the
      money already is
- [x] v0.3 — a README/interop note + example showing use alongside
      `@mcp-b/webmcp` (complement, don't compete) — shipped as
      `examples/mcp-b-interop.mjs` + the README "Where it fits" note.
- [x] pre-publish — npm name `webmcp-verified` confirmed free (registry 404s)
- [ ] a real flagged-Chrome end-to-end run (closes L-022)
- [ ] publish (owner: `npm login && npm publish`; then GitHub for discovery)

## The one honest gate

Publishing early is cheap and buys first-mover credibility; publishing a
half-true claim is expensive. Every "we're the only/first" line stays out
unless verified. The differentiators above (verification, token cost) are
demonstrable in the code and tests — lead with those.
