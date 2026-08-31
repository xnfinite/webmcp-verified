# Evidence — auto-generated

_Regenerated 2026-08-31 19:22 UTC by `node scripts/evidence.mjs`. Reproducible: clone,
run the command, get this file. Nothing here is asserted by hand._

## Guarantees, tested live

- **Smoke tests:** ALL PASS — 23 passed.
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
    "avgMs": 5.1,
    "maxMs": 15,
    "totalTokens": 158,
    "avgTokens": 53
  }
```

  `avgTokens` is the measured cost of a call — the reason an agent prefers
  these tools. `grounded` vs `fallback` shows the no-guess rule firing.

## Raw smoke output

```
PASS rejects thin description
PASS grounded price derived from source ($20)
PASS customer surface hides internal rows
PASS stamps provenance
PASS unknown returns fallback with no invented price
PASS internal surface shows internal rows
PASS metrics record grounded + fallback
PASS metrics record token cost (30 avg)
PASS manifest line is lean (first sentence only)
PASS describe_tool serves full detail on demand
PASS compact provenance costs fewer tokens (8 < 26)
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

ALL SMOKE TESTS PASSED
```

---

_Local automation only. This file is committed locally; publishing it to a
public repo is a deliberate human step (machine builds, human publishes)._
