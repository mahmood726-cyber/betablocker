// engine.js — BetaBlockerSynth pure computational core
// ---------------------------------------------------------------------------
// These functions are copied VERBATIM from beta.html / index.html so that the
// statistical core has a single, testable source of truth.
//
// Two execution contexts use them:
//   1. The main page inline <script> loads this file via <script src="engine.js">,
//      so `calculateStats` is a browser global here (its inline copy was deleted
//      from the page to avoid two diverging definitions).
//   2. The Web Worker (a `type="javascript/worker"` block that is stringified and
//      run in an isolated Worker context) CANNOT <script src>. It therefore keeps
//      its OWN verbatim copies of `erf` and `runFragilitySimulation`. Those copies
//      are duplicated here, unchanged, so they are independently testable. If you
//      edit the math, edit BOTH places (worker block + engine.js) identically.
// ---------------------------------------------------------------------------

// Per-trial effect size from a 2x2-style summary (events + total N).
// Splits N evenly into arms, applies a 0.5 continuity correction only when an
// events cell is zero, returns logRR and its delta-method variance.
//   Var(logRR) = 1/a - 1/n1 + 1/c - 1/n2
function calculateStats(t) {
    const nTx = Math.floor(t.n / 2);
    const nCtl = Math.ceil(t.n / 2);

    const riskTx = t.eventsTx / nTx;
    const riskCtl = t.eventsCtl / nCtl;

    const safeTx = t.eventsTx === 0 ? 0.5 : t.eventsTx;
    const safeCtl = t.eventsCtl === 0 ? 0.5 : t.eventsCtl;

    const rr = (safeTx/nTx) / (safeCtl/nCtl);
    const logHR = Math.log(rr);

    const v = (1/safeTx) - (1/nTx) + (1/safeCtl) - (1/nCtl);

    return { ...t, logHR, varLogHR: v };
}

// Abramowitz & Stegun 7.1.26 rational approximation of the error function.
// Max absolute error ~1.5e-7. Used to evaluate the normal CDF Phi(z) = 0.5*(1+erf(z/sqrt(2))).
function erf(x) {
    var sign = (x >= 0) ? 1 : -1;
    x = Math.abs(x);
    var a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    var t = 1.0 / (1.0 + p*x);
    var y = 1.0 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t * Math.exp(-x*x);
    return sign * y;
}

// Reverse-fragility simulation: walks the number of ADDED adverse events in the
// TREATMENT ARM ONLY (one-arm convention) from 0..60. Each added event nudges the
// pooled logHR up by a fixed per-event increment (0.0035); a credibility-ceiling
// `bias` term subtracts a flat amount from the shift. Returns, for each step, the
// probability that the true effect is harmful (HR > 1):
//   - Bayesian: posterior P(HR>1) = Phi(z), z = mu/se.
//   - Frequentist: Phi(z), then snapped to 1.0 once z crosses the one-sided
//                  alpha=0.05 critical value (z > 1.645).
function runFragilitySimulation(trials, mode, bias) {
    const steps = [];
    const maxEvents = 60;

    for(let i=0; i<=maxEvents; i++) {
      // Simulate shifting the pooled mean directly for speed
      // 0.0035 is approx logHR shift per event in a 10k patient meta-analysis
      const rawShift = i * 0.0035;
      const effectiveShift = Math.max(0, rawShift - (bias || 0));

      const mu = 0.02 + effectiveShift; // Starting from slight null (1.02)
      const se = 0.045; // Approx SE of the meta-analysis
      const z = (mu - 0) / se;

      let prob;
      if (mode === 'Frequentist') {
        // One-sided p-value approach
        prob = (1.0 - (0.5 * (1 + erf(z / Math.sqrt(2)))));
        prob = 1 - prob;
        if (z > 1.645) prob = 1.0;
      } else {
        // Bayesian Posterior Probability (HR > 1)
        prob = 0.5 * (1 + erf(z / Math.sqrt(2)));
      }

      steps.push({ events: i, probHarm: prob });
    }

    return steps;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calculateStats, erf, runFragilitySimulation };
}
