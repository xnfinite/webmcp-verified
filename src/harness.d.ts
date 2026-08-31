/**
 * webmcp-verified/harness — the test + performance harness.
 *
 * Acts like a visiting agent: runs a battery of real journeys against a set of
 * tools and reports where an agent would fail (leaks, wrong answers, thin
 * schemas, errors) plus timing. Two entry points:
 *   - runJourneys(tools, journeys) : direct, for unit-style tests
 *   - runOnHost(doc, setup, ...)   : installs a capturing modelContext,
 *                                    invokes the page's registration, runs.
 *
 * Hand-authored declarations for the public API of src/harness.js (v0.6.0),
 * backed by the runtime behaviour test/smoke.mjs exercises.
 */

import type { JSONSchema } from "./index.js";

/**
 * Heuristic tripwire for internal-pricing terms appearing on a customer
 * surface. A double-check for developer error, NOT the security boundary — the
 * real redaction guarantee is the structural surface split. Exported so callers
 * can inspect/reuse it; the pattern is a heuristic (known false-positives and
 * misses are documented at the definition).
 */
export const LEAK: RegExp;

/** The minimum a tool needs to be run by the harness. Every Tool satisfies it. */
export interface HarnessTool {
  name: string;
  execute(args?: any): Promise<any>;
  inputSchema?: JSONSchema;
  description?: string;
}

/**
 * One journey the harness runs against a tool.
 *   expect     — substrings that MUST appear in the answer text
 *   denyMargin — default true; fail if internal pricing leaks to a customer surface
 */
export interface Journey {
  tool: string;
  args?: Record<string, unknown>;
  expect?: string[];
  denyMargin?: boolean;
}

/** The outcome of one journey. `args`/`ms`/`snippet` are absent when the tool was not registered. */
export interface JourneyResult {
  tool: string;
  args?: Record<string, unknown>;
  pass: boolean;
  issues: string[];
  ms?: number;
  snippet?: string;
}

/** The report runJourneys() resolves to. */
export interface JourneyReport {
  toolCount: number;
  tools: string[];
  passed: number;
  total: number;
  allPass: boolean;
  results: JourneyResult[];
}

/** The spec-shaped capturing host installed by runOnHost() and passed to `setup`. */
export interface ModelContextHost {
  registerTool(tool: any, opts?: any): { unregister(): void };
  getTools(): Promise<any[]>;
  executeTool(tool: any, args: any): Promise<any>;
}

/** Run journeys against an array of tool objects (each with name + execute). */
export function runJourneys(
  tools: ReadonlyArray<HarnessTool>,
  journeys: ReadonlyArray<Journey>
): Promise<JourneyReport>;

/**
 * Browser use: install a spec-shaped capturing modelContext on `doc`, run the
 * page's registration hook (`setup`), then the journeys. `registration` carries
 * whatever `setup` returned (or "no-hook" if it returned nothing).
 */
export function runOnHost(
  doc: any,
  setup: (host: ModelContextHost) => unknown | Promise<unknown>,
  journeys: ReadonlyArray<Journey>
): Promise<JourneyReport & { registration: unknown }>;
