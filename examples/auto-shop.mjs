/**
 * Worked example: an auto shop's quoting tools, built with webmcp-verified.
 * Run: node examples/auto-shop.mjs
 *
 * Note every price comes from RATE_CARD via resolve(); the model never
 * authors a number. Ask for something off the card and it offers a
 * diagnostic instead of inventing a price.
 */
import { defineTool, mount, Metrics } from "../src/index.js";
import { runJourneys } from "../src/harness.js";

// --- the ground truth (a client's real rate card would replace this) ---
const RATE_CARD = {
  laborRate: 135, markupPct: 0.35, taxRate: 0.0725, validDays: 14,
  services: {
    brakes_front: { label: "Front brake pads & rotors", wholesale: 190, hours: 1.8, kw: ["brake", "grind", "squeak", "rotor", "pad"] },
    battery: { label: "Battery replacement", wholesale: 150, hours: 0.5, kw: ["battery", "won't start", "dead", "click"] },
    tires: { label: "Tires — set of four", wholesale: 420, hours: 1.2, kw: ["tire", "tread", "flat"] },
    diag: { label: "Diagnostic inspection", wholesale: 0, hours: 1.0, kw: [] }
  }
};
const source = () => RATE_CARD;
const match = (issue, card) => {
  const low = (issue || "").toLowerCase(); let best = null, score = 0;
  for (const [key, s] of Object.entries(card.services)) {
    const sc = s.kw.reduce((a, k) => a + (low.includes(k) ? k.length : 0), 0);
    if (sc > score) { score = sc; best = key; }
  }
  return best;
};
const price = (s, card) => {
  const parts = +(s.wholesale * (1 + card.markupPct)).toFixed(2);
  const labor = +(s.hours * card.laborRate).toFixed(2);
  const tax = +((parts) * card.taxRate).toFixed(2);
  return { parts, labor, tax, total: +(parts + labor + tax).toFixed(2), margin: +(s.wholesale * card.markupPct).toFixed(2) };
};

const metrics = new Metrics();

const getQuote = defineTool({
  name: "get_quote",
  description: "Get an itemized repair quote for a vehicle and issue. Never invents prices: jobs not on the rate card return a diagnostic instead of a guess.",
  inputSchema: { type: "object", properties: {
    make: { type: "string" }, model: { type: "string" }, issue: { type: "string" }
  }, required: ["make", "issue"] },
  source, sourceName: "the shop's rate card", metrics, surface: "customer",
  resolve(a, card) {
    const key = match(a.issue, card);
    if (!key || key === "diag") return null;             // off-card → fallback, not a guess
    const s = card.services[key], p = price(s, card);
    return {
      summary: `${a.make} ${a.model || ""} — ${s.label}`.trim(),
      lines: [["Parts (estimated)", p.parts], ["Labor", p.labor], ["Tax", p.tax], ["Total", p.total], ["Honored", card.validDays + " days"]],
      internal: [["Parts wholesale", s.wholesale], ["Markup", (card.markupPct * 100) + "% → margin $" + p.margin], ["Labor detail", s.hours + " h × $" + card.laborRate + "/h"]]
    };
  },
  onUnknown(a, card) {
    const p = price(card.services.diag, card);
    return { summary: `${a.make} ${a.model || ""} — that isn't on our rate card`.trim(),
      lines: [["Recommended", "Diagnostic inspection (credited toward repair)"], ["Diagnostic", p.total]] };
  }
});

// --- register with a mock host (a browser would pass document.modelContext) ---
const host = { registerTool: (t) => ({ unregister() {} }) };
const m = mount(host, [getQuote]);

// --- run the harness (the shipped test/perf tool) ---
const report = await runJourneys([getQuote], [
  { tool: "get_quote", args: { make: "Volkswagen", model: "Passat", issue: "front brakes grinding" }, expect: ["Total"] },
  { tool: "get_quote", args: { make: "Toyota", issue: "sunroof leaking" }, expect: ["Diagnostic"] }   // off-card, must not guess
]);

console.log("JOURNEYS:", report.allPass ? "ALL PASS" : "FAIL", `(${report.passed}/${report.total})`);
console.log("Customer quote:\n" + (await getQuote.execute({ make: "Volkswagen", model: "Passat", issue: "front brakes grinding" })).content[0].text);
console.log("\nPERFORMANCE:", JSON.stringify(metrics.report(), null, 2));
