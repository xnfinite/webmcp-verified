/**
 * _surface.mjs — the ONE realistic tool surface used by every discovery-axis
 * script (benchmark.mjs, discovery.mjs) and the discovery smoke tests.
 *
 * Shared on purpose: the DISCOVERY numbers in EVIDENCE.md must have a single
 * source of truth. If benchmark.mjs and discovery.mjs each defined their own
 * 12 tools, they could print two different "headline" savings — an honesty
 * hole. They import this instead, so the number is the same everywhere or the
 * change is made in one place.
 *
 * A realistic customer-facing surface for an auto shop + retail site. Each
 * tool has: a lean one-line `description` (the manifest line an agent reads to
 * route), a multi-sentence `help` (the long-form a developer would otherwise
 * cram into `description` and pay for on every page load), and a real 2–4
 * property JSON schema. Diverse verbs, diverse schemas — not 12 clones.
 */
import { defineTool } from "../src/index.js";

const CATALOG = { any: { label: "x", value: 1 } };

/**
 * [name, one-line description, multi-sentence help, schema properties, required[]]
 * Exported raw so a reader can inspect exactly what is being measured.
 */
export const specs = [
  ["get_quote", "Get an itemized repair quote for a vehicle and issue.",
    "Returns parts, labor, tax and a total for a known service, itemized. Jobs not on the rate card return a diagnostic recommendation instead of a guessed price. Every figure derives from the shop's rate card; the agent never authors a number.",
    { make: { type: "string" }, model: { type: "string" }, issue: { type: "string" }, vin: { type: "string" } }, ["make", "issue"]],
  ["check_availability", "Check whether a service can be booked on a given date.",
    "Looks up the shop's calendar for open bays and technician hours on the requested date and returns the earliest available slot. Does not hold or reserve the slot; call book_appointment to commit. Availability reflects the live schedule at call time.",
    { date: { type: "string" }, service: { type: "string" }, duration: { type: "integer" } }, ["date", "service"]],
  ["book_appointment", "Book a confirmed appointment for a service and time.",
    "Commits a chosen slot to the calendar and returns a confirmation code. This mutates the schedule and is flagged for human-in-the-loop confirmation by the host. Requires a customer name and a slot previously returned by check_availability.",
    { name: { type: "string" }, slot: { type: "string" }, service: { type: "string" } }, ["name", "slot", "service"]],
  ["lookup_part", "Look up a part's price and stock by number or name.",
    "Resolves a catalog part by SKU or free-text name and returns its retail price and on-hand quantity. Prices come from the parts catalog, not the model. Ambiguous names return the closest match with its SKU so the agent can disambiguate.",
    { sku: { type: "string" }, name: { type: "string" } }, []],
  ["estimate_delivery", "Estimate delivery date for an order to a ZIP code.",
    "Computes an estimated delivery window from the carrier's posted transit times for the destination ZIP and the order's ship-from warehouse. It is an estimate from posted times, not a guarantee, and excludes carrier delays. Weekend and holiday handling follows the carrier calendar.",
    { zip: { type: "string" }, weight: { type: "number" }, expedited: { type: "boolean" } }, ["zip"]],
  ["order_status", "Get the current status of an existing order.",
    "Returns the latest tracked status for an order id — placed, packed, shipped, or delivered — with the last scan timestamp. Reads the order system of record; it does not modify anything. Unknown ids return a not-found result, never a fabricated status.",
    { orderId: { type: "string" }, email: { type: "string" } }, ["orderId"]],
  ["price_match", "Check if a competitor price qualifies for a match.",
    "Compares a competitor's advertised price against the price-match policy and returns whether it qualifies and the adjusted price. The policy thresholds live in the policy source; the tool applies them, it does not invent exceptions. Returns the specific policy reason when a request does not qualify.",
    { item: { type: "string" }, competitorPrice: { type: "number" }, url: { type: "string" } }, ["item", "competitorPrice"]],
  ["warranty_check", "Check warranty coverage for a product and purchase date.",
    "Determines remaining warranty coverage from the product's warranty term and the purchase date, returning the expiry date and what is covered. Coverage terms come from the warranty table. Out-of-term products return an explicit not-covered result rather than a hopeful guess.",
    { product: { type: "string" }, purchaseDate: { type: "string" }, serial: { type: "string" } }, ["product", "purchaseDate"]],
  ["find_store", "Find the nearest store to a ZIP with its hours.",
    "Returns the closest store location to a ZIP code with its address, phone, and today's hours. Distances and hours come from the store directory. If no store is within the serviceable radius it says so instead of returning a far-away store as if local.",
    { zip: { type: "string" }, radius: { type: "integer" } }, ["zip"]],
  ["calc_tax", "Calculate sales tax for an amount and destination.",
    "Applies the destination jurisdiction's posted sales-tax rate to a pre-tax amount and returns the tax and grand total. Rates come from the tax table keyed by ZIP; the tool never estimates a rate for an unlisted jurisdiction, it reports the gap. Rounding follows standard half-up to the cent.",
    { amount: { type: "number" }, zip: { type: "string" } }, ["amount", "zip"]],
  ["loyalty_balance", "Look up a member's loyalty point balance.",
    "Returns the current points balance and tier for a loyalty member id, plus points needed for the next tier. Reads the loyalty ledger; it does not redeem or adjust points. Unknown or inactive members return a clear status, never a made-up balance.",
    { memberId: { type: "string" }, email: { type: "string" } }, ["memberId"]],
  ["return_policy", "Explain the return window and rules for an item.",
    "Returns the return window in days and any conditions (restocking fee, final-sale flags) for a purchased item category. Rules come from the returns policy source. Categories with no stated policy return the default policy explicitly, not a guessed one.",
    { category: { type: "string" }, purchaseDate: { type: "string" }, opened: { type: "boolean" } }, ["category"]]
];

/** Build the realistic surface as real defineTool tools. Deterministic. */
export function buildSurface() {
  return specs.map(([name, description, help, properties, required]) =>
    defineTool({
      name, description, help,
      inputSchema: { type: "object", properties, required },
      source: () => CATALOG,
      resolve: () => ({ lines: [["ok", 1]] })
    })
  );
}
