# E156 Protocol — BetaBlockerSynth

- **Project:** betablocker (BetaBlockerSynth V2.3 — Fragility Diagnostics Dashboard)
- **Revived:** 2026-06-05
- **Type:** Offline single-file browser dashboard + extracted pure JS engine + Node tests
- **Dashboard:** https://mahmood726-cyber.github.io/betablocker/

## What changed

- Removed the only external reference (Google Fonts `<link>`); page is now fully offline.
- Extracted the pure statistical core into `engine.js` (`calculateStats`, `erf`, `runFragilitySimulation`) as a single source of truth; deleted the inline `calculateStats` copy from the page and wired in `<script src="engine.js">`.
- Added `tests.js`: 31 hand-derived, dependency-free Node assertions (all passing).
- Renamed `beta.html` -> `index.html` for GitHub Pages.
- Added `.nojekyll`, `.gitignore`, `README.md`, this protocol. (LICENSE already present: Apache.)
- Reviewed the fragility-one-arm rule: the shipped model adds events to the treatment arm only and runs no 2x2/Fisher recomputation, so there is no two-arm bug; behaviour kept faithful.

## Body (E156 draft — CURRENT BODY)

Does the apparent null benefit of beta-blockers after a preserved-ejection-fraction myocardial infarction survive small, plausible perturbations of the underlying trial data? The tool ingests five recent post-MI beta-blocker randomized trials (REDUCE-AMI, REBOOT-CNIC, DANBLOCK, BETAMI, CAPITAL-RCT), each editable as treatment and control event counts. It pools their log relative risks with a fixed-heterogeneity Bayesian model and then performs a reverse-fragility walk, adding adverse events to the treatment arm only and tracking the probability that the pooled hazard ratio exceeds one. The dashboard reports the pooled hazard ratio, a reverse fragility index, a fragility quotient, and the most influential trial via leave-one-out Baujat diagnostics. A continuity correction is applied only to zero event cells, and the variance uses the standard delta-method form. Interpreted cautiously, a modest excess of treatment-arm harms can flip the result toward harm. Conclusions are exploratory sensitivity analysis, not a primary meta-analytic estimate.

SUBMITTED: [ ]
