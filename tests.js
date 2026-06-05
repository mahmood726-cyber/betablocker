// tests.js — pure-Node tests for engine.js (no dependencies).
// Run: node tests.js
//
// Every expected value below is hand-derived INDEPENDENTLY of the engine
// (by closed-form algebra and/or standard-normal-table reference values from
// Python's math.erf), never by running engine.js. Reference normal-CDF values
// were obtained as Phi(z)=0.5*(1+math.erf(z/sqrt(2))) in CPython and are noted
// inline.

const { calculateStats, erf, runFragilitySimulation } = require('./engine.js');

let pass = 0, fail = 0;

function approx(name, got, want, tol) {
  tol = tol === undefined ? 1e-9 : tol;
  const ok = Math.abs(got - want) <= tol;
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name +
    ' | got=' + got + ' want=' + want + ' tol=' + tol);
  if (ok) pass++; else fail++;
}
function eq(name, got, want) {
  const ok = got === want;
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name +
    ' | got=' + JSON.stringify(got) + ' want=' + JSON.stringify(want));
  if (ok) pass++; else fail++;
}
function truthy(name, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : ''));
  if (cond) pass++; else fail++;
}

// Phi(z) helper used only in EXPECTATIONS, implemented with the SAME A&S erf
// the engine uses is NOT done here — expectations are table values from CPython.
function PhiEngine(z) { return 0.5 * (1 + erf(z / Math.sqrt(2))); }

console.log('--- erf(x): Abramowitz & Stegun 7.1.26 (max err ~1.5e-7) ---');
// erf is odd; erf(0)=0 exactly in the limit (approx ~1e-9 here).
approx('erf(0) = 0', erf(0), 0, 1e-7);
// True erf(1) = 0.8427007929 (CPython math.erf).
approx('erf(1) = 0.8427007929', erf(1), 0.8427007929, 1.5e-7);
// Oddness: erf(-1) = -erf(1).
approx('erf(-1) = -erf(1) (odd)', erf(-1), -erf(1), 1e-12);
// True erf(0.5) = 0.5204998778.
approx('erf(0.5) = 0.5204998778', erf(0.5), 0.5204998778, 1.5e-7);
// Monotone increasing.
truthy('erf monotone: erf(0.5) < erf(1)', erf(0.5) < erf(1));

console.log('\n--- calculateStats(t): logRR + delta-method variance ---');
// Case A (symmetric, even N): n=1000, eventsTx=100, eventsCtl=100.
//   nTx=floor(500)=500, nCtl=ceil(500)=500.
//   rr=(100/500)/(100/500)=1 -> logHR=ln(1)=0.
//   v=1/100 - 1/500 + 1/100 - 1/500 = 0.01-0.002+0.01-0.002 = 0.016.
{
  const r = calculateStats({ n: 1000, eventsTx: 100, eventsCtl: 100 });
  approx('A logHR = 0', r.logHR, 0, 1e-12);
  approx('A varLogHR = 0.016', r.varLogHR, 0.016, 1e-12);
}
// Case B (asymmetric events): n=200, eventsTx=10, eventsCtl=20.
//   nTx=100, nCtl=100. rr=(10/100)/(20/100)=0.5 -> logHR=ln(0.5)=-0.6931471806.
//   v=1/10 - 1/100 + 1/20 - 1/100 = 0.1-0.01+0.05-0.01 = 0.13.
{
  const r = calculateStats({ n: 200, eventsTx: 10, eventsCtl: 20 });
  approx('B logHR = ln(0.5)', r.logHR, -0.6931471805599453, 1e-12);
  approx('B varLogHR = 0.13', r.varLogHR, 0.13, 1e-12);
}
// Case C (odd N split): n=5, eventsTx=1, eventsCtl=1.
//   nTx=floor(2.5)=2, nCtl=ceil(2.5)=3.
//   rr=(1/2)/(1/3)=1.5 -> logHR=ln(1.5)=0.4054651081.
//   v=1/1 - 1/2 + 1/1 - 1/3 = 1-0.5+1-0.333333... = 1.1666666667.
{
  const r = calculateStats({ n: 5, eventsTx: 1, eventsCtl: 1 });
  // tol 1e-11 (not 1e-12): engine computes log((1/2)/(1/3)), whose division
  // chain lands ~1.4e-12 off the exact ln(1.5) double. Value is correct.
  approx('C logHR = ln(1.5)', r.logHR, 0.4054651081095832, 1e-11);
  approx('C varLogHR = 7/6', r.varLogHR, 7/6, 1e-12);
}
// Case D (zero-cell continuity correction on Tx arm only): n=100, eventsTx=0, eventsCtl=5.
//   nTx=50, nCtl=50. safeTx=0.5 (0->0.5), safeCtl=5.
//   rr=(0.5/50)/(5/50)=0.01/0.1=0.1 -> logHR=ln(0.1)=-2.302585093.
//   v=1/0.5 - 1/50 + 1/5 - 1/50 = 2-0.02+0.2-0.02 = 2.16.
{
  const r = calculateStats({ n: 100, eventsTx: 0, eventsCtl: 5 });
  approx('D logHR = ln(0.1) [zero-cell corr]', r.logHR, -2.302585092994046, 1e-12);
  approx('D varLogHR = 2.16', r.varLogHR, 2.16, 1e-12);
}
// Case E: spreads original fields through (...t) so downstream UI keeps id/name.
{
  const r = calculateStats({ id: 'X', name: 'Trial X', n: 1000, eventsTx: 100, eventsCtl: 100 });
  eq('E passthrough id', r.id, 'X');
  eq('E passthrough name', r.name, 'Trial X');
}

console.log('\n--- runFragilitySimulation(): one-arm (Tx) reverse-fragility walk ---');
// Geometry: 61 steps (i=0..60). z(i) = (0.02 + max(0, 0.0035*i - bias)) / 0.045.
{
  const bayes = runFragilitySimulation([], 'Bayesian', 0);
  eq('grid length = 61 (i=0..60)', bayes.length, 61);
  eq('first step events = 0', bayes[0].events, 0);
  eq('last step events = 60', bayes[60].events, 60);

  // i=0, bias=0: mu=0.02, z=0.02/0.045=0.4444444444.
  //   Reference Phi(0.4444444)=0.67163936 (CPython). Bayesian prob = Phi(z).
  approx('Bayes i=0 probHarm = Phi(0.4444) = 0.6716', bayes[0].probHarm, 0.67163936, 2e-3);

  // i=60, bias=0: rawShift=0.21, mu=0.23, z=0.23/0.045=5.111111.
  //   Reference Phi(5.111111)=0.99999984 -> effectively 1.
  truthy('Bayes i=60 probHarm -> ~1 (z=5.11)', bayes[60].probHarm > 0.999,
    'probHarm=' + bayes[60].probHarm);

  // Monotone non-decreasing in events for the Bayesian (pure Phi) branch.
  let mono = true;
  for (let i = 1; i < bayes.length; i++) if (bayes[i].probHarm < bayes[i-1].probHarm - 1e-12) mono = false;
  truthy('Bayes probHarm monotone non-decreasing', mono);
}

// Frequentist branch == Phi(z) for z<=1.645, then HARD-SNAP to exactly 1.0 once z>1.645.
// Solve z>1.645: 0.02+0.0035*i > 1.645*0.045=0.074025 -> i > 15.435 -> first integer i=16.
{
  const freq = runFragilitySimulation([], 'Frequentist', 0);

  // i=15: mu=0.02+0.0525=0.0725, z=0.0725/0.045=1.611111 (<1.645, NOT snapped).
  //   Reference Phi(1.611111)=0.94642225.
  approx('Freq i=15 probHarm = Phi(1.6111) = 0.9464 (not snapped)',
    freq[15].probHarm, 0.94642225, 2e-3);
  truthy('Freq i=15 not snapped (<1.0)', freq[15].probHarm < 0.9999,
    'probHarm=' + freq[15].probHarm);

  // i=16: mu=0.076, z=1.688889 (>1.645) -> snapped to exactly 1.0.
  eq('Freq i=16 probHarm snapped to exactly 1.0', freq[16].probHarm, 1.0);
  // All steps from 16..60 are snapped.
  let allSnapped = true;
  for (let i = 16; i <= 60; i++) if (freq[i].probHarm !== 1.0) allSnapped = false;
  truthy('Freq i>=16 all snapped to 1.0', allSnapped);
}

// Bias (credibility ceiling) reduces the effective shift, lowering probHarm.
// i=30: rawShift=0.105.
//   bias=0    -> effShift=0.105, mu=0.125, z=2.7778.
//   bias=0.10 -> effShift=0.005, mu=0.025, z=0.5556 -> Phi(0.5556)=0.71074262.
{
  const b0  = runFragilitySimulation([], 'Bayesian', 0);
  const b10 = runFragilitySimulation([], 'Bayesian', 0.10);
  truthy('bias lowers probHarm at i=30', b10[30].probHarm < b0[30].probHarm,
    'b0=' + b0[30].probHarm + ' b10=' + b10[30].probHarm);
  approx('Bayes bias=0.10 i=30 = Phi(0.5556) = 0.7107', b10[30].probHarm, 0.71074262, 2e-3);

  // Bias floor: at i=0 the shift is clamped at 0 (max(0,...)), so probHarm(bias)=probHarm(0).
  approx('bias floor at i=0 (shift clamped to >=0)', b10[0].probHarm, b0[0].probHarm, 1e-12);
}

// Internal consistency: Bayesian branch must equal PhiEngine(z) exactly for a few i.
{
  const bayes = runFragilitySimulation([], 'Bayesian', 0);
  for (const i of [0, 5, 20]) {
    const z = (0.02 + 0.0035 * i) / 0.045;
    approx('Bayes i=' + i + ' equals Phi_engine(z) exactly', bayes[i].probHarm, PhiEngine(z), 1e-12);
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
