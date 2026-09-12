/**
 * Deterministically generate the built-in, data-only demo library.
 * Run: node scripts/src/generate-demo-library.mjs [--check]
 *
 * Only the two checked-in legacy seeds are evaluated, in a short-lived VM
 * with mocked storage/reload and no process, require, timers, or network.
 * Browser demo loading never evaluates JavaScript: it fetches the JSON files.
 * --check validates source fixtures, exact legacy-state preservation, and
 * byte-for-byte agreement with the generated files without writing anything.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { buildStewartPlatformDemo } from './stewart-platform-demo.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outputDirectory = path.join(root, "artifacts/kineticad/public/demos");
const checkOnly = process.argv.includes("--check");
assert(process.argv.slice(2).every((arg) => arg === "--check"), "Only --check is supported");
const materials = ["aluminium-6061", "steel-1018", "brass-c36000", "titanium-grade5", "nylon-6", "pla", "abs", "acrylic"];

function legacySeed(id) {
  assert(["windmill", "orrery"].includes(id));
  const filename = path.join(root, `artifacts/kineticad/public/seeds/${id}.js`);
  const source = fs.readFileSync(filename, "utf8");
  assert(source.length < 1_000_000, "Unexpectedly large legacy seed");
  let captured;
  let writes = 0;
  const context = vm.createContext({
    localStorage: Object.freeze({ setItem(key, value) {
      assert.equal(key, "kineticad-state");
      assert.equal(++writes, 1, "Legacy seed must write exactly once");
      captured = String(value);
    } }),
    location: Object.freeze({ reload() {} }),
    console: Object.freeze({ log() {} }),
  }, { codeGeneration: { strings: false, wasm: false } });
  new vm.Script(source, { filename }).runInContext(context, { timeout: 1000 });
  assert.equal(writes, 1);
  const envelope = JSON.parse(captured);
  assert.equal(envelope.version, 9);
  return envelope;
}

function part(id, name, materialId, positionMm = [0, 0, 0]) {
  return { id, name, visible: true, materialId,
    transform: { positionMm, rotationDeg: [0, 0, 0] }, sketches: [], features: [] };
}

function extrude(target, name, plane, primitive, depthMm, extrudeMode = "add", direction = "forward") {
  const number = target.features.length + 1;
  const sketchId = `sk-${target.id}-${number}`;
  target.sketches.push({ id: sketchId, name, plane, primitives: [primitive] });
  target.features.push({ id: `feat-${target.id}-${number}`, type: "extrude", sketchId,
    depthMm, direction, extrudeMode: number === 1 ? "new-body" : extrudeMode });
}

const circle = (radius, centre = [0, 0]) => ({ type: "circle", centre, radius });
const rectangle = (width, height, corner = [-width / 2, -height / 2]) => ({ type: "rectangle", corner, width, height });

function annulus(target, plane, outer, inner, thickness) {
  extrude(target, "Ring outer profile", plane, circle(outer), thickness, "add", "symmetric");
  extrude(target, "Open ring centre", plane, circle(inner), thickness + 2, "subtract", "symmetric");
}

function revolute(id, name, a, b, anchorWorld, axisLocal, rpm) {
  // New demos deliberately use identity rotations; subtraction converts the
  // shared world anchor to each part's local coordinates without frame skew.
  const local = (p) => anchorWorld.map((value, i) => value - p.transform.positionMm[i]);
  return { id, type: "revolute", name, partA: a.id, partB: b.id,
    pivotA: { kind: "edge", edgeId: `${id}-anchor-a`, localPoint: local(a) },
    pivotB: { kind: "edge", edgeId: `${id}-anchor-b`, localPoint: local(b) },
    axisLocal, motorSpeedRpm: rpm };
}

function envelope(id, name, parts, mates) {
  return { state: { mode: "modeller", assembly: { id: `asm-${id}`, name,
    groundPartId: parts[0].id, booleanFeatures: [], parts, mates },
    simulation: { running: false, paused: false, timeStepMs: 1000 / 60,
      gravity: [0, 0, 0], speedMultiplier: 1, simulationTimeMs: 0 } }, version: 9 };
}

function gyroscope() {
  const pedestal = part("gyro-pedestal", "Steel pedestal", "steel-1018");
  extrude(pedestal, "Circular foot", "XY", circle(36), 8);
  extrude(pedestal, "Yaw bearing housing", "XY", circle(9), 39.5);
  extrude(pedestal, "Yaw bearing bore · 0.3 mm radial clearance", "XY", circle(3.3), 40, "subtract");
  const outer = part("gyro-outer", "Aluminium yaw ring and bearings", "aluminium-6061", [0, 0, 110]);
  annulus(outer, "XZ", 70, 64, 6);
  extrude(outer, "Yaw spindle stock", "XY", circle(3), 152, "add", "symmetric");
  extrude(outer, "Clear the centre of the spindle", "XY", circle(4), 128, "subtract", "symmetric");
  extrude(outer, "Remove unused upper spindle", "XZ", rectangle(8, 8, [-4, 70]), 16, "subtract", "symmetric");
  for (const x of [-73, 61]) {
    extrude(outer, "Roll bearing housing", "XZ", rectangle(12, 14, [x, -7]), 14, "add", "symmetric");
  }
  extrude(outer, "Roll bearing bores · 0.3 mm radial clearance", "YZ", circle(3.3), 150, "subtract", "symmetric");
  const middle = part("gyro-middle", "Brass roll ring and trunnions", "brass-c36000", [0, 0, 110]);
  annulus(middle, "XY", 54, 48, 6);
  extrude(middle, "Opposed roll trunnion stock", "YZ", circle(3), 140, "add", "symmetric");
  extrude(middle, "Open space between roll trunnions", "YZ", circle(4), 104, "subtract", "symmetric");
  for (const y of [-58, 44]) {
    extrude(middle, "Flywheel bearing housing", "YZ", rectangle(14, 12, [y, -6]), 12, "add", "symmetric");
  }
  extrude(middle, "Flywheel bearing bores · 0.3 mm radial clearance", "XZ", circle(2.3), 120, "subtract", "symmetric");
  const rotor = part("gyro-rotor", "Steel flywheel and axle", "steel-1018", [0, 0, 110]);
  annulus(rotor, "XZ", 38, 29, 6);
  extrude(rotor, "Flywheel spoke", "XZ", rectangle(72, 6), 6, "add", "symmetric");
  extrude(rotor, "Central hub", "XZ", circle(9), 16, "add", "symmetric");
  extrude(rotor, "Flywheel shaft through both bearings", "XZ", circle(2), 112, "add", "symmetric");
  return envelope("gyroscope", "Three-axis driven gimbal", [pedestal, outer, middle, rotor], [
    revolute("gyro-yaw", "Yaw · 5 RPM", pedestal, outer, [0, 0, 110], [0, 0, 1], 5),
    revolute("gyro-roll", "Roll · 8 RPM", outer, middle, [0, 0, 110], [1, 0, 0], 8),
    revolute("gyro-pitch", "Flywheel spin · 16 RPM", middle, rotor, [0, 0, 110], [0, 1, 0], 16),
  ]);
}

function kineticMobile() {
  const pedestal = part("mobile-pedestal", "Brushed steel stand", "steel-1018");
  extrude(pedestal, "Weighted foot", "XY", circle(33), 7);
  extrude(pedestal, "Central spindle", "XY", circle(3), 203);
  const beam = part("mobile-main", "Brass crown beam", "brass-c36000", [0, 0, 178]);
  extrude(beam, "Crown crossbar", "YZ", circle(2.5), 220, "add", "symmetric");
  extrude(beam, "Crown bearing", "XY", circle(7), 8, "add", "symmetric");
  extrude(beam, "Stand spindle bore · 0.3 mm radial clearance", "XY", circle(3.3), 10, "subtract", "symmetric");
  for (const x of [-100, 100]) {
    extrude(beam, `Suspension at ${x} mm`, "XY", circle(1.7, [x, 0]), 24, "add", "backward");
  }
  const parts = [pedestal, beam];
  const mates = [revolute("mobile-crown", "Crown · 4 RPM", pedestal, beam, [0, 0, 178], [0, 0, 1], 4)];
  const pendantMaterials = ["pla", "brass-c36000", "acrylic", "titanium-grade5"];
  for (const [branchIndex, x] of [-100, 100].entries()) {
    const side = branchIndex === 0 ? "left" : "right";
    const branch = part(`mobile-${side}`, `${branchIndex === 0 ? "West" : "East"} aluminium branch`, "aluminium-6061", [x, 0, 154]);
    extrude(branch, "Branch crossbar", "XZ", circle(2), 96, "add", "symmetric");
    extrude(branch, "Branch bearing", "XY", circle(5), 6, "add", "symmetric");
    extrude(branch, "Suspension bearing bore · 0.2 mm radial clearance", "XY", circle(1.9), 8, "subtract", "symmetric");
    for (const y of [-42, 42]) {
      extrude(branch, `Pendant suspension at ${y} mm`, "XY", circle(1.3, [0, y]), 25, "add", "backward");
    }
    parts.push(branch);
    mates.push(revolute(`mobile-${side}-joint`, `${side === "left" ? "West" : "East"} branch · ${side === "left" ? "−7" : "9"} RPM`, beam, branch, [x, 0, 154], [0, 0, 1], branchIndex === 0 ? -7 : 9));
    for (const [pendantIndex, y] of [-42, 42].entries()) {
      const n = branchIndex * 2 + pendantIndex;
      const pendant = part(`mobile-pendant-${n + 1}`, ["Blue medallion", "Golden medallion", "Ice medallion", "Titanium medallion"][n], pendantMaterials[n], [x, y, 129]);
      extrude(pendant, "Medallion profile", "XZ", circle(12, [0, -12]), 4, "add", "symmetric");
      extrude(pendant, "Suspension pin", "XY", circle(1.3), 12, "add", "backward");
      extrude(pendant, "Suspension bearing collar", "XY", circle(3), 6, "add", "symmetric");
      extrude(pendant, "Upper pin socket · 0.2 mm radial clearance", "XY", circle(1.5), 4, "subtract");
      extrude(pendant, "Medallion aperture", "XZ", circle(5, [0, -12]), 6, "subtract", "symmetric");
      parts.push(pendant);
      mates.push(revolute(`mobile-pendant-joint-${n + 1}`, `Medallion ${n + 1} · ${[12, -15, 18, -10][n]} RPM`, branch, pendant, [x, y, 129], [0, 0, 1], [12, -15, 18, -10][n]));
    }
  }
  return envelope("kinetic-mobile", "Kinetic mobile", parts, mates);
}

function materialStudio() {
  const plinth = part("material-plinth", "Steel test bed and guide rails", "steel-1018");
  extrude(plinth, "Test bed · 328 × 264 mm", "XY", rectangle(328, 264), 6);
  // Integral rails keep the guided path visible. Samples have 4 mm lateral
  // clearance; Rapier's ideal prismatic joint supplies the guide reaction.
  for (let i = 0; i < 9; i++) {
    extrude(plinth, `Guide rail ${i + 1}`, "XY", rectangle(4, 252, [-162 + i * 40, -126]), 8);
  }
  const parts = [plinth];
  const mates = [];
  const names = ["Aluminium 6061", "Steel 1018", "Brass C36000", "Titanium Grade 5", "Nylon 6", "PLA", "ABS", "Acrylic"];
  materials.forEach((material, i) => {
    const sample = part(`material-sample-${i + 1}`, `${names[i]} · test sample`, material, [-140 + i * 40, -96, 6]);
    extrude(sample, "Square base", "XY", rectangle(28, 28), 11);
    extrude(sample, "Raised circular boss", "XY", circle(11), 21);
    extrude(sample, "Through bore", "XY", circle(6), 24, "subtract");
    parts.push(sample);
    const id = `material-guide-${i + 1}`;
    mates.push({ id, type: "prismatic", name: `${names[i]} · frictionless guide`, partA: plinth.id, partB: sample.id,
      pivotA: { kind: "edge", edgeId: `${id}-a`, localPoint: [...sample.transform.positionMm] },
      pivotB: { kind: "edge", edgeId: `${id}-b`, localPoint: [0, 0, 0] },
      axisLocal: [0, 1, 0] });
  });
  const result = envelope("material-studio", "Material force lab", parts, mates);
  result.state.simulation.forceExperiment = { kind: "equal-force", partIds: parts.slice(1).map((p) => p.id),
    forceN: 0.001, direction: [0, 1, 0], durationMs: 2000 };
  return result;
}

// XYZ Euler convention matches THREE.Euler('XYZ') and physicsWorker.ts.
function worldPoint(part, local) {
  let [x, y, z] = local;
  const [rx, ry, rz] = part.transform.rotationDeg.map((v) => v * Math.PI / 180);
  [x, y] = [Math.cos(rz) * x - Math.sin(rz) * y, Math.sin(rz) * x + Math.cos(rz) * y];
  [x, z] = [Math.cos(ry) * x + Math.sin(ry) * z, -Math.sin(ry) * x + Math.cos(ry) * z];
  [y, z] = [Math.cos(rx) * y - Math.sin(rx) * z, Math.sin(rx) * y + Math.cos(rx) * z];
  return [x, y, z].map((v, i) => v + part.transform.positionMm[i]);
}

function validate(id, value, legacy = false) {
  assert.equal(value.version, 9);
  const { assembly, simulation } = value.state;
  const ids = new Set(assembly.parts.map((p) => p.id));
  assert.equal(ids.size, assembly.parts.length, `${id}: duplicate part IDs`);
  assert(ids.has(assembly.groundPartId), `${id}: missing ground`);
  assert.equal(simulation.running, false);
  assert.equal(simulation.paused, false);
  assert.equal(simulation.simulationTimeMs, 0);
  assert(Number.isFinite(simulation.timeStepMs) && simulation.timeStepMs > 0);
  const partsById = new Map(assembly.parts.map((p) => [p.id, p]));
  for (const p of assembly.parts) {
    assert(materials.includes(p.materialId), `${id}: unknown material`);
    assert([...p.transform.positionMm, ...p.transform.rotationDeg].every(Number.isFinite));
    if (!legacy && id !== 'stewart-platform') assert.deepEqual(p.transform.rotationDeg, [0, 0, 0], `${id}: unexpected rotated frame`);
    const sketchIds = new Set(p.sketches.map((s) => s.id));
    assert.equal(sketchIds.size, p.sketches.length);
    const featureIds = new Set(p.features.map((f) => f.id));
    assert.equal(featureIds.size, p.features.length);
    for (const sketch of p.sketches) {
      assert(["XY", "XZ", "YZ"].includes(sketch.plane));
      assert(sketch.primitives.length > 0);
      for (const primitive of sketch.primitives) {
        assert(["circle", "rectangle", "line", "arc"].includes(primitive.type));
        if (primitive.type === "circle" || primitive.type === "arc") assert(Number.isFinite(primitive.radius) && primitive.radius > 0);
        if (primitive.type === "rectangle") assert(primitive.width > 0 && primitive.height > 0);
        if (primitive.type === "line") assert([...primitive.start, ...primitive.end].every(Number.isFinite));
        if (primitive.type === "arc") assert([primitive.startAngle, primitive.endAngle, ...primitive.centre].every(Number.isFinite));
      }
    }
    for (const feature of p.features) {
      assert(['extrude', 'revolve'].includes(feature.type));
      assert(sketchIds.has(feature.sketchId), `${id}: broken sketch reference`);
      if (feature.type === 'extrude') {
        assert(Number.isFinite(feature.depthMm) && feature.depthMm > 0);
        assert(["forward", "backward", "symmetric"].includes(feature.direction));
        assert(["new-body", "add", "subtract"].includes(feature.extrudeMode));
      } else assert(feature.axis === 'Z' && feature.angleDeg === 360, `${id}: unexpected turned feature`);
    }
  }
  assert.equal(new Set(assembly.mates.map((m) => m.id)).size, assembly.mates.length);
  let maximumAnchorError = 0;
  const connected = new Set([assembly.groundPartId]);
  for (const mate of assembly.mates) {
    assert(ids.has(mate.partA) && ids.has(mate.partB), `${id}: missing mate body`);
    assert.notEqual(mate.partA, mate.partB);
    assert(["fixed", "revolute", "prismatic", "spherical"].includes(mate.type));
    if (mate.type === "fixed") continue;
    if (mate.type === "revolute") assert(Number.isFinite(mate.motorSpeedRpm) && mate.motorSpeedRpm !== 0, `${id}: unspecified drive`);
    if (mate.type !== 'spherical') assert(Math.abs(Math.hypot(...mate.axisLocal) - 1) < 1e-9, `${id}: non-unit axis`);
    const a = worldPoint(partsById.get(mate.partA), mate.pivotA.localPoint);
    const b = worldPoint(partsById.get(mate.partB), mate.pivotB.localPoint);
    const error = Math.hypot(...a.map((v, i) => v - b[i]));
    maximumAnchorError = Math.max(maximumAnchorError, error);
    assert(error < 0.001, `${id}: ${mate.id} anchors differ by ${error} mm`);
  }
  for (let i = 0; i < assembly.parts.length; i += 1) {
    for (const mate of assembly.mates) {
      if (connected.has(mate.partA)) connected.add(mate.partB);
      if (connected.has(mate.partB)) connected.add(mate.partA);
    }
  }
  assert.equal(connected.size, ids.size, `${id}: ungrounded disconnected mechanism`);
  return maximumAnchorError;
}

const fixtures = new Map([
  ["windmill", legacySeed("windmill")], ["orrery", legacySeed("orrery")],
  ["gyroscope", gyroscope()], ["kinetic-mobile", kineticMobile()], ["material-studio", materialStudio()],
  ['stewart-platform', buildStewartPlatformDemo()],
]);

const descriptions = [
  { id: "windmill", title: "Windmill", subtitle: "Your first moving assembly", category: "Start here", accent: "#66cfbd",
    description: "The original two-part demo: a grounded post and a rotor. See how one revolute mate turns a model into motion.",
    highlights: ["2 parts", "30 RPM drive", "One revolute mate"],
    learningTip: "Press Play, then change the rotor mate's RPM. Stop returns the assembly to its starting pose." },
  { id: "orrery", title: "Solar-system orrery", subtitle: "Thirteen bodies in concert", category: "Showcase", accent: "#a699f2",
    description: "The original planetary showcase, with eight orbital arms, three nested moons and an independently driven asteroid ring.",
    highlights: ["13 bodies", "Nested motion", "12 motorised mates"],
    learningTip: "Follow a moon's mate to its planet: its motion combines two driven joints. Speeds are illustrative, not astronomical." },
  { id: "gyroscope", title: "Three-axis driven gimbal", subtitle: "Explore supported nested rotation", category: "Motion", accent: "#e2be76",
    description: "Nested rings carry a steel flywheel through bored bearing housings and visible shafts. Three motors drive the intersecting axes.",
    highlights: ["Three driven axes", "Shafts and bearings", "Mixed materials"],
    learningTip: "Try changing one joint's RPM at a time. This is a powered gimbal study in zero gravity, not a passive gyroscope prediction." },
  { id: "kinetic-mobile", title: "Kinetic mobile", subtitle: "A small moving sculpture", category: "Motion", accent: "#72b5df",
    description: "A brass crown carries two turning branches and four medallions. Different motor speeds create a layered moving sculpture.",
    highlights: ["7 driven joints", "Branching assembly", "Counter-rotation"],
    learningTip: "Watch the crown, branches and medallions turn at different rates. Each joint is motor-driven; gravity is off." },
  { id: "material-studio", title: "Material force lab", subtitle: "Same force, different mass", category: "Physics", accent: "#c5cf93",
    description: "Give eight identical shapes the same force for two seconds. Watch lighter materials accelerate faster and compare measured results with F = ma.",
    highlights: ["8 materials", "Measured acceleration", "Two-second experiment"],
    learningTip: "Try simulation, choose 0.5 or 1 millinewton, then press Run experiment. The result holds after two seconds. Ideal guides; gravity and friction are off." },
  { id: 'stewart-platform', title: 'Stewart platform', subtitle: 'Six actuators. Six controlled axes.', category: 'Engineering', accent: '#ecab76',
    description: 'Six telescopic actuators translate and tilt one deck through 18 coupled joints. Inspect the bored barrels and spherical ends, then compare requested motion with the measured solver pose.',
    highlights: ['14 rigid bodies', '18 coupled joints', 'Six-axis motion'],
    learningTip: 'Try X, Y, Z, roll, pitch, yaw or combined motion. Targets stay within ±5 mm and ±2° per axis. Four seconds moving, two settling; ideal drives with gravity off, without a payload rating.' },
];

function emit(filename, contents) {
  if (checkOnly) {
    assert.equal(fs.readFileSync(filename, "utf8"), contents, `${path.relative(root, filename)} is stale; regenerate it`);
  } else {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, contents, "utf8");
  }
}

const catalog = descriptions.map((description) => {
  const value = fixtures.get(description.id);
  const anchorError = validate(description.id, value, ["windmill", "orrery"].includes(description.id));
  // Assert exact state preservation again independently of the write format.
  if (["windmill", "orrery"].includes(description.id)) assert.deepEqual(value, legacySeed(description.id));
  emit(path.join(outputDirectory, `${description.id}.json`), `${JSON.stringify(value, null, 2)}\n`);
  const { assembly } = value.state;
  console.log(`${description.id}: ${assembly.parts.length} parts, ${assembly.mates.length} joints; maximum initial anchor error ${anchorError.toFixed(6)} mm`);
  return { ...description, partCount: assembly.parts.length, jointCount: assembly.mates.length };
});

emit(path.join(root, "artifacts/kineticad/src/demos/catalog.ts"), `// Generated by scripts/src/generate-demo-library.mjs. Regenerate rather than editing.\nexport type DemoId = string;\n\nexport type DemoDefinition = {\n  id: DemoId;\n  title: string;\n  subtitle: string;\n  description: string;\n  category: string;\n  partCount: number;\n  jointCount: number;\n  highlights: string[];\n  learningTip: string;\n  accent: string;\n};\n\nexport const DEMOS: DemoDefinition[] = ${JSON.stringify(catalog, null, 2)};\n\nexport function getDemo(id: DemoId): DemoDefinition | undefined {\n  return DEMOS.find((demo) => demo.id === id);\n}\n`);
console.log(checkOnly ? "Demo library verified; all generated files match." : "Demo library generated. Run again with --check to verify without writing.");
