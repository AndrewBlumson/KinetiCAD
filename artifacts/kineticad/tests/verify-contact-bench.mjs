// node --experimental-strip-types artifacts/kineticad/tests/verify-contact-bench.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createContactBench } from '../src/physics/contactBench.ts';

const root = new URL('../../../', import.meta.url);
const report = { schemaVersion: 1, generatedAt: new Date().toISOString(),
  sourceSha256: createHash('sha256').update(readFileSync(new URL('artifacts/kineticad/src/physics/contactBench.ts', root))).digest('hex'),
  method: 'Actual installed Rapier0.12 cuboid contact, measured each fixed step. Contact impulses are divided by the one-outer-step dt and converted from kg·mm/s to N; independent body momentum differences check both normal and friction forces. The horizontal reference is Coulomb friction under continuous support; the drop diagnostic disables it.',
  scope: 'Guided block, flat exact-cuboid floor, isotropic single-coefficient friction, restitution0. Contact geometry matches the rendered dimensions. No arbitrary CAD-assembly contacts, static/kinetic friction separation, rolling resistance, surface roughness, flexible contact or claimed load ratings.',
  thresholds: { impulseMomentumBalanceN: 0.0005, slidingVelocityError: '0.01*mu*g*dt + 0.1 mm/s: one percent of a fixed-step Coulomb velocity increment plus a small absolute solver allowance.',
    slidingPositionError: 'v0*dt/2 + 0.5 mm for the validated cases; reports show first-order timestep convergence.',
    supportedPenetrationMm: 0.025, drop20mmPenetrationMm: 0.1, passiveStepEnergyIncreaseJ: 1e-7 },
  cases: [], failures: [] };
const cases = [
  { name: 'resting', initialVelocityMmPerSec: 0, frictionCoefficient: 0.5 },
  { name: 'frictionless', frictionCoefficient: 0 },
  { name: 'sliding-60Hz', timeStepMs: 1000 / 60 },
  { name: 'sliding-120Hz', timeStepMs: 1000 / 120 },
  { name: 'sliding-240Hz', timeStepMs: 1000 / 240 },
  { name: 'heavy-10kg', massKg: 10 },
  { name: 'rough-mu0.5', frictionCoefficient: 0.5 },
  { name: 'drop-reference-disabled', initialGapMm: 20 },
];
for (const { name, ...config } of cases) {
  const bench = await createContactBench(config);
  let previous = bench.step(0);
  const entry = { name, config: previous.config, measurementCadence: 'Every fixed step', steps: 0,
    maxPenetrationMm: 0, maxImpulseMomentumBalanceN: 0, maxVelocityErrorMmPerSec: 0, maxPositionErrorMm: 0,
    maxEnergyIncreaseJ: 0, contactSteps: 0, invalidReferenceSteps: 0, trace: [previous], final: null };
  try {
    while (!previous.completed) {
      const snapshot = bench.step(previous.config.timeStepMs);
      entry.steps++;
      entry.maxPenetrationMm = Math.max(entry.maxPenetrationMm, snapshot.contact.penetrationMm, snapshot.contact.geometricPenetrationMm);
      entry.maxImpulseMomentumBalanceN = Math.max(entry.maxImpulseMomentumBalanceN,
        Math.abs(snapshot.contact.normalForceN - snapshot.contact.normalForceFromMomentumN),
        Math.abs(snapshot.contact.frictionForceN - Math.abs(snapshot.contact.frictionForceXFromMomentumN)));
      entry.maxEnergyIncreaseJ = Math.max(entry.maxEnergyIncreaseJ, snapshot.energy.mechanicalJ - previous.energy.mechanicalJ);
      if (snapshot.contact.active) entry.contactSteps++;
      if (snapshot.reference.valid) {
        entry.maxVelocityErrorMmPerSec = Math.max(entry.maxVelocityErrorMmPerSec, Math.abs(snapshot.body.linearVelocityMmPerSec[0] - snapshot.reference.velocityXMmPerSec));
        entry.maxPositionErrorMm = Math.max(entry.maxPositionErrorMm, Math.abs(snapshot.body.positionMm[0] - snapshot.reference.positionXMm));
      } else entry.invalidReferenceSteps++;
      if (entry.steps % Math.round(100 / snapshot.config.timeStepMs) === 0 || snapshot.completed) entry.trace.push(snapshot);
      previous = snapshot;
    }
    entry.final = previous;
  } finally { bench.dispose(); }
  const positionBound = previous.config.initialVelocityMmPerSec * previous.config.timeStepMs / 2000 + 0.5;
  const forceBound = report.thresholds.impulseMomentumBalanceN * Math.max(1, previous.config.massKg / 2);
  const velocityBound = 0.01 * previous.config.frictionCoefficient * 9810 * previous.config.timeStepMs / 1000 + 0.1;
  entry.velocityErrorBoundMmPerSec = velocityBound;
  if (entry.maxImpulseMomentumBalanceN > forceBound) report.failures.push(`${name}: impulse/momentum discrepancy`);
  if (entry.maxEnergyIncreaseJ > report.thresholds.passiveStepEnergyIncreaseJ) report.failures.push(`${name}: passive energy gain`);
  if (previous.config.initialGapMm > 0) {
    if (entry.invalidReferenceSteps !== entry.steps || entry.maxPenetrationMm > 0.1) report.failures.push(`${name}: impact/reference check`);
  } else if (entry.invalidReferenceSteps || entry.maxVelocityErrorMmPerSec > velocityBound || entry.maxPositionErrorMm > positionBound || entry.maxPenetrationMm > 0.025) {
    report.failures.push(`${name}: supported sliding reference or penetration check`);
  }
  report.cases.push(entry);
}
const convergence = report.cases.filter((entry) => entry.name.startsWith('sliding-'));
for (let i = 1; i < convergence.length; i++) if (convergence[i].maxPositionErrorMm >= convergence[i - 1].maxPositionErrorMm * 0.55
  || convergence[i].maxPenetrationMm >= convergence[i - 1].maxPenetrationMm * 0.4) report.failures.push('Timestep convergence failed.');
report.passed = report.failures.length === 0;
writeFileSync(new URL('docs/contact-bench-results.json', root), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, cases: report.cases.map(({ name, maxPenetrationMm, maxImpulseMomentumBalanceN, maxPositionErrorMm }) =>
  ({ name, maxPenetrationMm, maxImpulseMomentumBalanceN, maxPositionErrorMm })), failures: report.failures }, null, 2));
if (!report.passed) process.exitCode = 1;
