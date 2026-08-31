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

1. **Verification / can't-hallucinate / provenance.** When an agent quotes a
   real price to a real customer, "the model made it up" is a liability, not a
   bug. Nobody in the SDK layer guarantees source-derived answers. We do, by
   construction. This is the icm-verifier discipline as code.
2. **Token efficiency (ICM progressive disclosure).** Agents pay per tool
   description and per result. Lean manifest + describe-on-demand + compact
   provenance (measured 8 vs 26 tokens) + per-call token metering. A real cost
   lever the general SDKs don't frame around.
3. **Protocol-agnostic trust layer.** The `source`/`resolve`/`surface`
   discipline is not WebMCP-specific; it maps onto ACP/MCP tool surfaces too.
   Position as "the trust + cost layer for agent tools," not "a WebMCP SDK."

## The 100% use case: liability (research 2026-08-30)

The must-have isn't convenience — it's legal exposure. Precedent, not
prediction:
- **Air Canada (2024):** held liable for a refund policy its chatbot
  invented. "No difference whether the info comes from a static page or a
  chatbot."
- **Germany (May 2026):** company liable for its AI chatbot's wrong answers.
  **UK CMA (Mar 2026):** same consumer law for AI as humans — liable even if
  a third party built the agent. **PYMNTS 2026:** "you own what your chatbot
  says." Chevy dealership chatbot sold a Tahoe for $1 "legally binding."
- **Lloyd's of London (2025):** launched insurance for AI-hallucination
  losses — the risk is now formally priced. Agentic commerce has an open
  "who pays when the AI is wrong" chargeback gap; the merchant holds the bill.

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
- [ ] Ship `.d.ts` types (emit from JSDoc) — typed libs get recommended
      by default.
- [ ] `manifestCost(tools)` / `describeCost(name)` — meter the DISCOVERY
      token axis (the actual "cheap for the agent" pitch), not just output.
- [ ] `@mcp-b/webmcp` interop example (claimed; not yet demonstrated).
- [ ] Emit an audit receipt on the missing-required path too.

## Build order (not one go)

- [x] v0.1 — verified tools, surface redaction, harness, metrics
- [x] v0.2 — progressive disclosure (manifest / describe_tool / compact
      provenance), token metering, dual human/AI readability, honest README
- [ ] v0.3 — an ACP-shaped adapter (same `source`/`resolve`, emit an ACP
      product-feed / tool schema) so the trust+cost layer reaches where the
      money already is
- [ ] v0.3 — a README/interop note + example showing use alongside
      `@mcp-b/webmcp` (complement, don't compete)
- [ ] pre-publish — confirm npm name is free; if taken, scope it
      (`@xnfinite/…`); a real flagged-Chrome end-to-end run (closes L-022)
- [ ] publish (owner: `npm login && npm publish`; then GitHub for discovery)

## The one honest gate

Publishing early is cheap and buys first-mover credibility; publishing a
half-true claim is expensive. Every "we're the only/first" line stays out
unless verified. The differentiators above (verification, token cost) are
demonstrable in the code and tests — lead with those.
