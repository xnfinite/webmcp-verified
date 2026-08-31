/**
 * Interop example: a webmcp-verified tool registered through an @mcp-b/webmcp
 * -style host — proof this library COMPOSES WITH the incumbent WebMCP SDK
 * rather than replacing it.
 *
 * Run: node examples/mcp-b-interop.mjs
 *
 * The claim being demonstrated (README §"Where it fits"): webmcp-verified does
 * NOT ship its own host or transport. defineTool() produces a plain WebMCP tool
 * descriptor — { name, description, inputSchema, annotations, execute } — and
 * mount() installs it onto whatever host exposes registerTool. That host can be
 * the W3C navigator.modelContext, or the @mcp-b/webmcp implementation of it.
 * The trust + token layer (grounding, fallback, provenance, audit receipt,
 * per-call metering) rides ON TOP of the SDK's registration/transport; it does
 * not reimplement it. mount() couples to exactly one host method: registerTool.
 *
 * ── Why a mock, and what production looks like ─────────────────────────────
 * @mcp-b/webmcp is a real external package. This repo has a hard ZERO-DEPENDENCY
 * rule, so we do NOT install it. Instead we stand up a tiny local MOCK that
 * matches the host surface this repo documents as the WebMCP spec shape
 * (registerTool / getTools / executeTool — see the header of src/index.js and
 * runOnHost() in src/harness.js). In production you DELETE the mock and pass the
 * real host object straight to mount(), unchanged:
 *
 *     import { defineTool, mount, describeTool } from "webmcp-verified";
 *     // ...define getPlanQuote exactly as below...
 *     // Browser, real WebMCP (W3C draft) or the @mcp-b/webmcp polyfill of it:
 *     mount(navigator.modelContext, [getPlanQuote, describeTool([getPlanQuote])]);
 *
 * Honest scope: the exact method names/signatures of the real host can differ
 * across @mcp-b/webmcp versions and the evolving W3C draft. That does not change
 * the interop story, because the ONLY host method webmcp-verified calls is
 * registerTool (see mount() in src/index.js). getTools/executeTool below are the
 * host's job — modeled here so we can play the agent end-to-end in Node.
 */
import { defineTool, mount, describeTool, Metrics, AuditLog } from "../src/index.js";

// ── A tiny MOCK of the @mcp-b/webmcp host (stands in for document.modelContext /
//    navigator.modelContext). It matches the documented triad and nothing more.
//    In production this whole function is gone; you pass the real host to mount().
function createMcpBHostMock() {
  const registered = new Map();
  return {
    // registerTool(tool) -> a registration handle with unregister().
    // This is the ONLY method webmcp-verified's mount() actually calls.
    registerTool(tool) {
      registered.set(tool.name, tool);
      return { unregister() { registered.delete(tool.name); } };
    },
    // getTools() -> the descriptors an agent lists to CHOOSE a tool (the WebMCP
    // equivalent of MCP's tools/list). Note the descriptions are already the
    // lean one-line form: defineTool() reduced them, so the host surface an
    // agent pays to read is lean without the host doing anything.
    getTools() {
      return [...registered.values()].map((t) => ({
        name: t.name, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations
      }));
    },
    // executeTool(name, args) -> the host invokes the tool the agent picked and
    // returns its result verbatim ({ content, structuredContent, isError? }).
    async executeTool(name, args) {
      const t = registered.get(name);
      if (!t) throw new Error(`mcp-b host: no tool named "${name}"`);
      return t.execute(args);
    }
  };
}

// ── The ground truth. The only place a number lives. A client's real published
//    rate card would replace this object.
const RATE_CARD = {
  annualDiscountPct: 0.15,
  plans: {
    starter:  { label: "Starter",  base: 0,  perSeat: 0,  kw: ["starter", "free", "hobby"] },
    team:     { label: "Team",     base: 0,  perSeat: 12, kw: ["team", "standard", "pro"] },
    business: { label: "Business", base: 99, perSeat: 22, kw: ["business", "growth"] }
  }
};
const match = (query, card) => {
  const low = (query || "").toLowerCase();
  let best = null, score = 0;
  for (const [key, p] of Object.entries(card.plans)) {
    const sc = p.kw.reduce((a, k) => a + (low.includes(k) ? k.length : 0), 0);
    if (sc > score) { score = sc; best = key; }
  }
  return best;
};

// ── Shared trust instruments — the layer that rides on top of the host.
const metrics = new Metrics();
const audit = new AuditLog();

// ── A verified webmcp-verified tool. Identical to any other; nothing about it
//    is aware of, or coupled to, which host it will be mounted on.
const getPlanQuote = defineTool({
  name: "get_plan_quote",
  description: "Price a subscription plan for a given seat count. Plans not on the published rate card return a contact-sales fallback, never an invented price.",
  help: "Long-form detail served only via describe_tool (progressive disclosure), so agents don't pay for it on every tool-list load. Matches a free-text plan query against the rate card's keywords, then computes base + perSeat*seats, applying the annual discount when billing='annual'. Off-card queries return onUnknown (talk to sales) rather than guessing a figure.",
  inputSchema: {
    type: "object",
    properties: {
      plan: { type: "string" },
      seats: { type: "integer" },
      billing: { type: "string", enum: ["monthly", "annual"] }
    },
    required: ["plan", "seats"]
  },
  source: () => RATE_CARD,
  sourceName: "the published rate card",
  surface: "customer",
  metrics, audit,
  resolve(a, card) {
    const key = match(a.plan, card);
    if (!key) return null;                       // off-card -> fallback, not a guess
    const p = card.plans[key];
    const billing = a.billing || "monthly";
    const monthly = p.base + p.perSeat * a.seats;
    const total = billing === "annual"
      ? +(monthly * 12 * (1 - card.annualDiscountPct)).toFixed(2)
      : monthly;
    return {
      summary: `${p.label} plan — ${a.seats} seats, billed ${billing}`,
      lines: [[billing === "annual" ? "Annual total" : "Monthly total", total]]
    };
  },
  onUnknown(a) {
    return {
      summary: `No published price for "${a.plan}"`,
      lines: [["Recommended", "Talk to sales for a custom quote"]]
    };
  }
});

// ── COMPOSE: mount the verified tool (+ the progressive-disclosure meta-tool)
//    onto the @mcp-b-style host. This is the one line that would be identical
//    against the real navigator.modelContext / @mcp-b host.
const host = createMcpBHostMock();
const mounted = mount(host, [getPlanQuote, describeTool([getPlanQuote])]);
console.log(`Mounted ${mounted.count} tools onto the (mock) @mcp-b host.\n`);

// ── Now play the visiting AGENT, driving ONLY the host's public surface.

// 1) Discover: read the lean tool list the host exposes.
console.log("1. Agent lists tools via host.getTools() (the lean discovery surface):");
for (const t of host.getTools()) console.log(`   - ${t.name}: ${t.description}`);

// 2) Call a tool the agent chose, by name, through the host.
console.log("\n2. Agent calls get_plan_quote (on-card) via host.executeTool():");
const grounded = await host.executeTool("get_plan_quote", { plan: "team standard", seats: 20, billing: "annual" });
console.log(indent(grounded.content[0].text));
console.log("   structuredContent:", JSON.stringify(grounded.structuredContent));

// 3) Off-card question -> declared fallback, no invented number.
console.log("\n3. Agent asks for an off-card plan via host.executeTool():");
const fallback = await host.executeTool("get_plan_quote", { plan: "on-prem air-gapped deployment", seats: 500 });
console.log(indent(fallback.content[0].text));
console.log("   structuredContent:", JSON.stringify(fallback.structuredContent));

// 4) Progressive disclosure: the same host serves full detail on demand.
console.log("\n4. Agent pulls full detail via host.executeTool('describe_tool', ...):");
const detail = await host.executeTool("describe_tool", { name: "get_plan_quote" });
console.log(indent(detail.content[0].text));

// 5) The trust + cost layer survived the host boundary intact.
console.log("\n5. The verified layer rode along on top of the host:");
console.log("   Per-call metering (Metrics):", JSON.stringify(metrics.report().get_plan_quote));
console.log("   Audit receipts (one per answer):");
for (const r of audit.all()) {
  console.log(`     ${r.tool} · ${r.outcome} · result#${r.resultHash} · source#${r.sourceHash ?? "n/a"}`);
}

console.log(
  "\nComposition proven: one defineTool() tool, mounted through an @mcp-b-style " +
  "host by its registerTool alone, discovered/called/described entirely through " +
  "the host's own surface. Swap the mock for the real navigator.modelContext / " +
  "@mcp-b host and nothing above changes."
);

function indent(s) { return s.split("\n").map((l) => "   " + l).join("\n"); }
