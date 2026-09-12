import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStore } from 'zustand/vanilla';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createCrankSliderDocument, matchesCrankSliderAssembly, matchesCrankSliderConfiguration } from '../src/mechanisms/crankSliderWorkspace.ts';
import { DEFAULT_CRANK_SLIDER_PARAMS, CRANK_SLIDER_IDS, CRANK_SLIDER_DURATION_MS, CRANK_SLIDER_TIME_STEP_MS } from '../src/mechanisms/crankSlider.ts';
import { createProjectDocument } from '../src/project/projectAssets.ts';
import { parseProjectDocument } from '../src/project/projectDocument.ts';
import { parseDemoDocument } from '../src/demos/demoDocument.ts';
import { createDemoSession } from '../src/demos/demoSession.ts';

const params = () => ({ ...DEFAULT_CRANK_SLIDER_PARAMS });
const create = () => createCrankSliderDocument(params());
const withoutKernel = async () => { throw new Error('Native mechanism Save must not initialize OCCT.'); };

test('generated workspace is fresh, stopped and contains only its validated experiment', () => {
  const input = params();
  const doc = createCrankSliderDocument(input);
  assert.equal(doc.version, 9);
  assert.equal(doc.state.mode, 'simulator');
  assert.deepEqual(doc.state.simulation, {
    running: false, paused: false, simulationTimeMs: 0,
    timeStepMs: CRANK_SLIDER_TIME_STEP_MS, durationMs: CRANK_SLIDER_DURATION_MS,
    gravity: [0,0,0], speedMultiplier: 1, crankSlider: params(),
  });
  assert.equal(doc.state.assembly.parts.length, 4);
  assert.equal(doc.state.assembly.mates.length, 4);
  assert.equal(doc.state.assembly.booleanFeatures.length, 0);
  input.radiusMm = 30;
  assert.equal(doc.state.simulation.crankSlider.radiusMm, DEFAULT_CRANK_SLIDER_PARAMS.radiusMm);
  const next = create();
  doc.state.assembly.parts[0].sketches[0].primitives[0].width = 1;
  assert.notEqual(next.state.assembly.parts[0].sketches[0].primitives[0].width, 1);
});

test('demo parser and actual Save/project parser retain adjustable parameters and native history', async () => {
  const p = { radiusMm: 35, rodLengthMm: 140, rpm: -12.5 };
  const doc = parseDemoDocument(createCrankSliderDocument(p));
  doc.state.simulation.running = true;
  doc.state.simulation.paused = true;
  doc.state.simulation.simulationTimeMs = 1234;
  const saved = await createProjectDocument({ ...doc.state, setMode() {} }, withoutKernel);
  const loaded = parseProjectDocument(JSON.parse(JSON.stringify(saved)));
  assert.equal(loaded.format, 'kineticad-project');
  assert.deepEqual(loaded.assets, []);
  assert.deepEqual(loaded.state.simulation.crankSlider, p);
  assert.deepEqual(loaded.state.assembly, doc.state.assembly);
  assert.equal(loaded.state.simulation.running, false);
  assert.equal(loaded.state.simulation.paused, false);
  assert.equal(loaded.state.simulation.simulationTimeMs, 0);
  assert.equal(matchesCrankSliderConfiguration(loaded.state.assembly, loaded.state.simulation), true);
});

test('physical assembly guard tolerates cosmetic names, computed fields and object-key order', () => {
  const { assembly } = create().state;
  assembly.id = 'renamed-project-identity';
  assembly.name = 'My linkage';
  for (const part of assembly.parts) {
    part.name = `Named ${part.id}`;
    part.meshHash = 'render-cache-only';
    part.massKg = 123;
    part.volumeCm3 = 456;
    part.sketches.forEach(sketch => { sketch.name = 'New sketch label'; });
    part.features = part.features.map(feature => Object.fromEntries(Object.entries(feature).reverse()));
  }
  assembly.mates.forEach(mate => { mate.name = 'Renamed hinge'; });
  assert.equal(matchesCrankSliderAssembly(assembly, params()), true);
});

test('manual geometry, frame, material, visibility and joint edits disable parameter replacement', () => {
  const changes = [
    ['sketch', a => { a.parts[0].sketches[0].primitives[0].width += 1; }],
    ['feature', a => { a.parts[0].features[0].depthMm += 1; }],
    ['history order', a => { a.parts[0].features.reverse(); }],
    ['position', a => { a.parts[1].transform.positionMm[0] += 1; }],
    ['rotation', a => { a.parts[2].transform.rotationDeg[2] += 1; }],
    ['material', a => { a.parts[0].materialId = 'brass-c36000'; }],
    ['hidden mate body', a => { a.parts[3].visible = false; }],
    ['grounding', a => { a.groundPartId = CRANK_SLIDER_IDS.crank; }],
    ['joint pivot', a => { a.mates[1].pivotA.localPoint[0] += 1; }],
    ['joint axis', a => { a.mates[0].axisLocal = [0,1,0]; }],
    ['motor', a => { a.mates[0].motorSpeedRpm += 1; }],
    ['missing body', a => { a.parts.pop(); }],
    ['assembly Boolean', a => { a.booleanFeatures.push({ id:'extra',type:'boolean',resultPartName:'Cut',hideInputs:true,inputPartIds:a.parts.slice(0,2).map(p=>p.id),operation:{type:'union'} }); }],
  ];
  for (const [name, mutate] of changes) {
    const { assembly } = create().state;
    mutate(assembly);
    assert.equal(matchesCrankSliderAssembly(assembly, params()), false, name);
  }
  assert.equal(matchesCrankSliderAssembly(create().state.assembly, { ...params(), radiusMm: 26 }), false);
});

test('reference guard rejects changed gravity, timing and stale experiment controllers', () => {
  const { assembly, simulation } = create().state;
  assert.equal(matchesCrankSliderConfiguration(assembly, { ...simulation, running:true,paused:true,simulationTimeMs:200,speedMultiplier:2 }), true);
  for (const patch of [
    { gravity: [0,0,-9810] },
    { durationMs: 4000 },
    { timeStepMs: 1000/60 },
    { crankSlider: undefined },
    { forceExperiment: { kind:'equal-force',partIds:[CRANK_SLIDER_IDS.slider],forceN:1,direction:[1,0,0],durationMs:2000 } },
    { stewartMotion: { kind:'six-axis',target:{translationMm:[0,0,0],rotationDeg:[0,0,0]},moveDurationMs:4000,settleDurationMs:2000 } },
  ]) assert.equal(matchesCrankSliderConfiguration(assembly, { ...simulation, ...patch }), false, JSON.stringify(patch));
});

test('invalid adjustable metadata rejects before a document can replace the workspace', async () => {
  for (const invalid of [{...params(),radiusMm:NaN},{...params(),radiusMm:40,rodLengthMm:75},{...params(),rpm:31}]) {
    assert.throws(() => createCrankSliderDocument(invalid));
    assert.equal(matchesCrankSliderAssembly(create().state.assembly, invalid), false);
  }
  const doc = create();
  doc.state.simulation.crankSlider.rodLengthMm = 1;
  assert.throws(() => parseDemoDocument(doc));
  await assert.rejects(createProjectDocument(doc.state, withoutKernel));
});

test('parameter changes and Save remain isolated, then restore original live imported references', async () => {
  const original = JSON.parse(readFileSync(new URL('../public/demos/windmill.json', import.meta.url))).state;
  original.assembly.id = 'original-project';
  original.assembly.parts[0].features = [{ id:'original-import',type:'imported-step',shapeId:'original-live-occt-reference' }];
  const stored = new Map();
  const storage = createJSONStorage(() => ({ getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key) }));
  const store = createStore(persist(() => ({ ...original, selection:'original-selection' }), { name:'project',version:9,storage }));
  store.setState({ selection:'original-selection' });
  const before = stored.get('project');
  const session = createDemoSession({ read:store.getState,initial:store.getInitialState,write:store.setState,isolatePersistence() {
    const prior = store.persist.getOptions().storage;
    store.persist.setOptions({storage:{getItem:()=>null,setItem(){},removeItem(){}}});
    return () => store.persist.setOptions({storage:prior});
  } });
  for (const rpm of [15,-20,0]) {
    session.enter(createCrankSliderDocument({...params(),rpm}));
    store.setState({simulation:{...store.getState().simulation,running:true,simulationTimeMs:1500}});
    const saved = await createProjectDocument(store.getState(), withoutKernel);
    assert.equal(saved.state.simulation.crankSlider.rpm,rpm);
    assert.equal(saved.state.simulation.running,false);
    assert.equal(stored.get('project'),before);
  }
  session.leave();
  assert.equal(store.getState().assembly,original.assembly);
  assert.equal(store.getState().assembly.parts[0].features[0].shapeId,'original-live-occt-reference');
  assert.equal(store.getState().selection,'original-selection');
  assert.equal(store.getState().simulation.running,false);
  assert.equal(stored.get('project'),before);
  store.setState({assembly:{...store.getState().assembly,name:'Next original edit'}});
  assert.equal(JSON.parse(stored.get('project')).state.assembly.name,'Next original edit');
});
