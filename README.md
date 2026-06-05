# BetaBlockerSynth V2.3 — Fragility Diagnostics Dashboard

An offline, single-file browser dashboard for exploring the **sensitivity of a
beta-blocker post-MI meta-analysis** to small changes in the data. It pools a set
of recent post-MI beta-blocker trials (REDUCE-AMI, REBOOT-CNIC, DANBLOCK, BETAMI,
CAPITAL-RCT, all editable), and shows three linked views:

- **Baujat plot** — each trial's contribution to heterogeneity vs. its
  leave-one-out influence on the pooled estimate.
- **Reverse-fragility curve** — how many *added adverse events in the treatment
  arm* are needed to push the probability of harm (HR > 1) past 95%.
- **Forest plot** — per-trial log-RR confidence intervals plus the pooled
  estimate.

The pooled effect is estimated by a small Bayesian MCMC (Gibbs on the pooled
mean with a fixed heterogeneity `tau = 0.1`) that runs in a Web Worker.

## Offline / no external dependencies

The page is fully self-contained: open `index.html` directly in any modern
browser. There are **no CDN links, no Google Fonts, no network calls** — system
fonts fall back automatically. `grep -nE 'https?://' index.html` returns nothing.

## Layout

| File | Purpose |
|------|---------|
| `index.html` | The dashboard (UI, canvases, Web-Worker MCMC, rendering). |
| `engine.js` | The **pure** statistical core, single source of truth: `calculateStats`, `erf`, `runFragilitySimulation`. Loaded by the page as `<script src>` and also `module.exports`-ed for Node tests. |
| `tests.js` | Pure-Node test suite (no dependencies) with hand-derived expected values. |

## Statistical core (`engine.js`)

- **`calculateStats(t)`** — per-trial log relative risk and its delta-method
  variance `Var(logRR) = 1/a - 1/n1 + 1/c - 1/n2`. Arms are split evenly from `n`;
  a 0.5 continuity correction is applied **only** to a zero events cell.
- **`erf(x)`** — Abramowitz & Stegun 7.1.26 error-function approximation
  (max abs error ~1.5e-7), used to evaluate the normal CDF.
- **`runFragilitySimulation(trials, mode, bias)`** — the reverse-fragility walk.
  It adds adverse events to the **treatment arm only** (one-arm convention),
  shifting the pooled log-HR upward, and reports P(HR > 1) at each step under a
  Bayesian (`Phi(z)`) or Frequentist (`Phi(z)`, hard-snapped to 1.0 once the
  one-sided alpha = 0.05 critical value `z > 1.645` is crossed) reading.

## Running the tests

```
node tests.js
```

Prints each check and a final `N passed, M failed`; exit code is non-zero if any
check fails. Current status: **31 passed, 0 failed**. Every expected value is
hand-derived independently of the engine (closed-form algebra plus standard
normal-table reference values).

## Fixes applied during revival (2026-06-05)

- **Removed the only external reference** (Google Fonts `<link>`), replaced with
  an HTML comment, making the page fully offline. System fonts fall back.
- **Extracted the pure statistical functions into `engine.js`** as a single
  source of truth, loaded by the page via `<script src="engine.js">` and exported
  for Node. The inline `calculateStats` definition was **deleted** from the page
  so the engine copy is authoritative.
  (`erf` and `runFragilitySimulation` live inside an isolated `type="javascript/worker"`
  block that cannot use `<script src>`; their verbatim copies remain in the worker
  string and are duplicated unchanged in `engine.js` for testing — documented in
  both files.)
- **Added `tests.js`** with 31 hand-derived assertions, including edge cases
  (symmetric trial, asymmetric events, odd-N arm split, zero-cell continuity
  correction, fragility grid geometry, Frequentist snap threshold, bias floor and
  monotonicity).
- **Renamed `beta.html` -> `index.html`** so GitHub Pages serves it at the repo
  root.

### Fragility one-arm review (no bug found)

The project's statistics rules require the Fragility Index to modify **one arm
only**. The shipped reverse-fragility model is a *heuristic linear shift*: it does
not recompute a 2x2 table or run Fisher's exact test — it nudges the pooled log-HR
by a fixed increment per added event, where those events are conceptually added to
the **treatment arm only** (the curve's x-axis is "Added Adverse Events (Tx Arm)").
Because no per-arm 2x2 recomputation exists, there is **no two-arm-modification
bug to fix**; the one-arm convention is respected. This heuristic (and the
Frequentist hard-snap at `z > 1.645`) is a deliberate methodology choice and was
kept faithful — the tests assert the documented behaviour rather than silently
changing it.
