// Actual Zustand document actions, history and project packaging. Only the CAD
// import endpoint is controlled in the STEP lifetime case; no OCCT claim here.
import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { useKinetiCADStore as store } from '../src/state/store.ts';
import { booleanBodyId } from '../src/state/assemblyBodies.ts';
import { computeBooleanHash } from '../src/features/assemblyRegen.ts';
import { sketchEditAssemblySignature } from '../src/sketch/sketchEditSource.ts';
import { createDemoSession } from '../src/demos/demoSession.ts';
import { clearProjectAssetMemory, createProjectDocument, importDurableStep, restoreProjectAssets } from '../src/project/projectAssets.ts';
import { clearImportedShapeCache, getImportedShapeMesh } from '../src/cad/importedShapeCache.ts';
import { parseProjectDocument } from '../src/project/projectDocument.ts';

const kernelKey = '__kineticadHistoryTestKernel';
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (context.parentURL?.includes('/src/state/documentHistory.ts') && /\/cadClient(?:\.ts)?$/.test(specifier)) {
    return { url: `data:text/javascript,${encodeURIComponent(`export const getCadKernel=()=>Promise.resolve(globalThis.${kernelKey});`)}`, shortCircuit: true };
  }
  return nextResolve(specifier, context);
} });
after(() => { hooks.deregister(); delete globalThis[kernelKey]; });
const part = id => ({ id, name: id, visible: true, materialId: 'steel-1018',
  transform: { positionMm: [0,0,0], rotationDeg: [0,0,0] },
  sketches: [{ id: `sketch-${id}`, name: 'Rectangle', plane: 'XY', primitives: [{ type: 'rectangle', corner: [0,0], width: 20, height: 10 }] }],
  features: [{ id: `extrude-${id}`, type: 'extrude', sketchId: `sketch-${id}`, depthMm: 5, direction: 'forward', extrudeMode: 'new-body' }],
});
function setup(assemblyPatch = {}) {
  store.setState({ ...store.getInitialState(), mode: 'modeller',
    assembly: { id: 'history-project', name: 'History project', parts: [part('a'), part('b'), part('support')], groundPartId: 'support', mates: [], booleanFeatures: [], ...assemblyPatch },
  });
  store.getState().clearHistory();
}
const current = () => structuredClone(store.getState().assembly);
const noKernel = async () => { throw Error('Native project packaging must not initialize CAD.'); };
beforeEach(() => {
  store.persist.setOptions({ storage: { getItem: () => null, setItem() {}, removeItem() {} } });
  clearProjectAssetMemory(); clearImportedShapeCache();
  globalThis[kernelKey] = { importStep() { throw Error('Unexpected CAD import'); } };
  setup();
});

test('Undo and Redo restore a cascading part/Boolean/joint/ground deletion in one atomic document publication', async () => {
  const result = { id: 'housing', type: 'boolean', resultPartName: 'Finished housing', operation: { type: 'union' }, inputPartIds: ['a','b'], hideInputs: true, materialId: 'brass-c36000' };
  const parts = [part('a'),part('b'),part('support')], resultId = booleanBodyId(result.id);
  setup({ parts, groundPartId: resultId, booleanFeatures: [result], mates: [
    { id: 'result-pin', type: 'fixed', partA: resultId, partB: 'support', booleanGeometryHashes: { [resultId]: computeBooleanHash(result,parts) } },
    { id: 'source-pin', type: 'fixed', partA: 'a', partB: 'support' },
    { id: 'retained-pin', type: 'fixed', partA: 'b', partB: 'support' },
  ] });
  const before = current();
  store.getState().deletePartCascade('a');
  const deleted = current();
  assert.deepEqual(deleted.parts.map(p=>p.id), ['b','support']);
  assert.deepEqual(deleted.booleanFeatures, []);
  assert.deepEqual(deleted.mates.map(m=>m.id), ['retained-pin']);
  assert.equal(deleted.groundPartId, '');
  const publications = [];
  const unsubscribe = store.subscribe((next, previous) => { if (next.assembly !== previous.assembly) publications.push(structuredClone(next.assembly)); });
  try {
    assert.equal(await store.getState().undo(), true);
    assert.deepEqual(current(), before);
    assert.deepEqual(publications, [before], 'no intermediate restored parts without their joints/results');
    assert.equal(store.getState().canUndo, false, 'the cascade is one document action');
    assert.equal(store.getState().canRedo, true);
    assert.equal(await store.getState().redo(), true);
    assert.deepEqual(current(), deleted);
    assert.deepEqual(publications, [before,deleted]);
  } finally { unsubscribe(); }
});

test('invalid/no-op actions preserve Redo, while a new successful document edit branches it', async () => {
  store.getState().renamePart('a','Renamed');
  assert.equal(await store.getState().undo(), true);
  const unchanged = current();
  for (const action of [
    () => store.getState().renamePart('a','   '),
    () => store.getState().renamePart('missing','Anything'),
    () => store.getState().renamePart('a','a'),
    () => store.getState().setPartMaterial('a','steel-1018'),
    () => store.getState().setPartVisible('a',true),
    () => store.getState().resetPartTransform('a'),
    () => store.getState().removeMate('missing'),
  ]) { action(); assert.equal(store.getState().canRedo,true); assert.deepEqual(current(),unchanged); }
  store.getState().setSketchDimensionsEditing(true);
  const source = store.getState().assembly.parts[0].sketches[0];
  assert.throws(() => store.getState().updateSketch('a',source.id,[{type:'rectangle',corner:[0,0],width:-1,height:10}],source,sketchEditAssemblySignature(store.getState().assembly)));
  store.getState().setSketchDimensionsEditing(false);
  assert.equal(store.getState().canRedo,true); assert.deepEqual(current(),unchanged);
  assert.equal(await store.getState().redo(),true);
  assert.equal(store.getState().assembly.parts[0].name,'Renamed');
  assert.equal(await store.getState().undo(),true);
  store.getState().setPartMaterial('a','brass-c36000');
  assert.equal(store.getState().canRedo,false);
  assert.equal(await store.getState().redo(),false);
  assert.equal(await store.getState().undo(),true);
  assert.deepEqual(current(),unchanged);
});

test('a transform gesture groups all pose samples into one step and copies caller arrays', async () => {
  const before = current(), token = store.getState().beginHistoryTransaction('Move and rotate part');
  for (let i=1;i<=20;i++) store.getState().setPartTransformPartial('a',{positionMm:[i,2*i,-i],rotationDeg:[i,-i,3*i]});
  assert.equal(store.getState().canUndo,false,'a gesture cannot be undone halfway through');
  const input = {positionMm:[21,42,-21],rotationDeg:[21,-21,63]};
  store.getState().setPartTransform('a',input); input.positionMm[0]=999;
  const afterGesture=current(); assert.equal(afterGesture.parts[0].transform.positionMm[0],21);
  store.getState().endHistoryTransaction(token);
  assert.equal(store.getState().historyUndoLabel,'Move and rotate part');
  assert.equal(await store.getState().undo(),true); assert.deepEqual(current(),before);
  assert.equal(store.getState().canUndo,false);
  assert.equal(await store.getState().redo(),true); assert.deepEqual(current(),afterGesture);
});

test('nested transforms and cancellation preserve the preceding edit and the previous Redo branch', async () => {
  store.getState().renamePart('a','Earlier edit'); await store.getState().undo();
  const before=current(), outer=store.getState().beginHistoryTransaction('Outer gesture'), inner=store.getState().beginHistoryTransaction('Inner gesture');
  store.getState().setPartTransformPartial('a',{positionMm:[20,0,0]});
  assert.throws(()=>store.getState().endHistoryTransaction(outer),/nested/i);
  store.getState().endHistoryTransaction(inner);
  assert.equal(await store.getState().cancelHistoryTransaction(outer),true);
  assert.deepEqual(current(),before);
  assert.equal(store.getState().canUndo,false);
  assert.equal(store.getState().canRedo,true,'cancel does not consume the redo branch');
  assert.equal(await store.getState().redo(),true);
  assert.equal(store.getState().assembly.parts[0].name,'Earlier edit');
  const noOp=store.getState().beginHistoryTransaction('No movement');
  store.getState().setPartTransformPartial('a',{positionMm:[0,0,0]});
  store.getState().endHistoryTransaction(noOp);
  assert.equal(await store.getState().undo(),true);
  assert.equal(store.getState().assembly.parts[0].name,'a');
  assert.equal(store.getState().canUndo,false,'ending a zero-change gesture creates no extra step');
});

test('selection, preview, picker, simulation frames and derived mass writes do not create history', async () => {
  store.getState().renamePart('a','Editable name');
  const revision=store.getState().historyRevision;
  store.getState().selectPart('b'); store.getState().selectFace('b','top-face');
  store.getState().setPickingMode('faces'); store.getState().setPickFilter({faceTypes:['plane']});
  store.getState().setFeaturePreview({status:'ok',error:null,details:null});
  store.getState().updatePartMassProps('a',123,456);
  for(let i=0;i<20;i++) store.getState().tickSimulationTime(1000/60);
  store.getState().setSimulationRunning(true); store.getState().setSimulationPaused(true);
  assert.equal(store.getState().historyRevision,revision);
  assert.equal(await store.getState().undo(),true,'Undo stops a live or paused world before restoring its source model');
  const s=store.getState();
  assert.equal(s.assembly.parts[0].name,'a');
  assert.equal(s.assembly.parts[0].massKg,undefined); assert.equal(s.assembly.parts[0].volumeCm3,undefined);
  assert.equal(s.simulation.running,false); assert.equal(s.simulation.paused,false); assert.equal(s.simulation.simulationTimeMs,0);
  assert.equal(s.selection,null); assert.equal(s.pickingMode,'idle'); assert.equal(s.pickFilter,null);
  assert.deepEqual(s.featurePreview,{status:'idle',error:null,details:null}); assert.equal(s.canUndo,false);
});

test('feature and sketch drafts add no history, while each committed source edit restores its exact stable IDs', async()=>{
  const before=current();
  store.getState().beginEditFeature('a','extrude-a');
  store.getState().setFeatureEditorExtrudeParams({depthMm:12,direction:'forward',extrudeMode:'new-body'});
  store.getState().setFeaturePreview({status:'error',error:'Candidate failed',details:'Controlled preview failure'});
  store.getState().cancelFeatureEditor();
  assert.equal(store.getState().canUndo,false);assert.deepEqual(current(),before);
  store.getState().beginEditFeature('a','extrude-a');
  store.getState().setFeatureEditorExtrudeParams({depthMm:12,direction:'forward',extrudeMode:'new-body'});
  store.getState().applyFeatureEditor(); const featureEdited=current();
  assert.equal(featureEdited.parts[0].features[0].id,'extrude-a');assert.equal(featureEdited.parts[0].features[0].depthMm,12);
  assert.equal(await store.getState().undo(),true);assert.deepEqual(current(),before);
  store.getState().selectPart('a');store.getState().beginSketch('XZ');
  store.getState().commitPrimitive({type:'circle',centre:[10,15],radius:5});store.getState().cancelSketch();
  assert.equal(store.getState().canRedo,true);assert.deepEqual(current(),before);
  assert.equal(await store.getState().redo(),true);assert.deepEqual(current(),featureEdited);
  store.getState().clearHistory();store.getState().selectPart('a');store.getState().beginSketch('XZ');
  store.getState().commitPrimitive({type:'circle',centre:[10,15],radius:5});store.getState().finishSketch();
  const sketchAdded=current(), added=sketchAdded.parts[0].sketches.at(-1);
  assert.equal(added.plane,'XZ');assert.deepEqual(added.primitives,[{type:'circle',centre:[10,15],radius:5}]);
  assert.equal(await store.getState().undo(),true);assert.deepEqual(current(),featureEdited);
  assert.equal(await store.getState().redo(),true);assert.deepEqual(current(),sketchAdded,'Redo retains the original sketch ID rather than creating a fresh copy');
});

test('part duplication retains unique remapped feature/sketch IDs through Undo and Redo without mutating its source',async()=>{
  const before=current(), duplicateId=store.getState().duplicatePart('a'), duplicated=current();
  const copy=duplicated.parts.find(p=>p.id===duplicateId), source=duplicated.parts.find(p=>p.id==='a');
  assert.ok(copy);assert.deepEqual(source,before.parts[0]);
  assert.notEqual(copy.sketches[0].id,source.sketches[0].id);assert.notEqual(copy.features[0].id,source.features[0].id);
  assert.equal(copy.features[0].sketchId,copy.sketches[0].id);assert.equal(copy.transform.positionMm[0],30);
  assert.equal(await store.getState().undo(),true);assert.deepEqual(current(),before);
  assert.equal(await store.getState().redo(),true);assert.deepEqual(current(),duplicated);
  store.getState().setPartTransformPartial(duplicateId,{positionMm:[90,0,0]});
  assert.equal(store.getState().assembly.parts.find(p=>p.id==='a').transform.positionMm[0],0);
  assert.equal(await store.getState().undo(),true);assert.deepEqual(current(),duplicated);
});

test('editors, geometry rebuilds and overlapping operations block history without consuming it', async () => {
  store.getState().renamePart('a','Undo me');
  store.getState().setSketchDimensionsEditing(true);
  assert.match(store.getState().historyBlockedReason,/edit/i); assert.equal(await store.getState().undo(),false);
  store.getState().setSketchDimensionsEditing(false);
  store.getState().setHistoryGeometryPending(true);
  assert.match(store.getState().historyBlockedReason,/geometry/i); assert.equal(await store.getState().undo(),false);
  store.getState().setHistoryGeometryPending(false);
  const releaseImport=store.getState().beginHistoryOperation('STEP import'), releaseSave=store.getState().beginHistoryOperation('Save');
  assert.match(store.getState().historyBlockedReason,/STEP import/);
  releaseImport(); releaseImport();
  assert.match(store.getState().historyBlockedReason,/Save/); assert.equal(await store.getState().undo(),false);
  releaseSave(); assert.equal(store.getState().historyBlockedReason,null);
  assert.equal(await store.getState().undo(),true); assert.equal(store.getState().assembly.parts[0].name,'a');
});

test('sketch geometry and its controller invalidation restore together as one document edit', async () => {
  const controller={radiusMm:25,rodLengthMm:100,rpm:15};
  store.setState(s=>({simulation:{...s.simulation,crankSlider:controller}})); store.getState().clearHistory();
  const before=current(), sketch=store.getState().assembly.parts[0].sketches[0];
  store.getState().setSketchDimensionsEditing(true);
  store.getState().updateSketch('a',sketch.id,[{type:'rectangle',corner:[0,0],width:30,height:10}],sketch,sketchEditAssemblySignature(store.getState().assembly));
  assert.equal(store.getState().simulation.crankSlider,undefined); assert.equal(store.getState().simulation.sketchGeometryEdited,true);
  assert.equal(await store.getState().undo(),true); assert.deepEqual(current(),before);
  assert.deepEqual(store.getState().simulation.crankSlider,controller); assert.equal(store.getState().simulation.sketchGeometryEdited,undefined);
  assert.equal(await store.getState().redo(),true); assert.equal(store.getState().assembly.parts[0].sketches[0].primitives[0].width,30);
  assert.equal(store.getState().simulation.crankSlider,undefined); assert.equal(store.getState().simulation.sketchGeometryEdited,true);
});

test('an external assembly replacement is a boundary even when its document bytes are identical', async () => {
  store.getState().renamePart('a','Edit'); const token=store.getState().beginHistoryTransaction('Old gesture');
  store.getState().setPartTransformPartial('a',{positionMm:[10,0,0]});
  const loaded=current(); store.setState({assembly:structuredClone(loaded)});
  store.getState().endHistoryTransaction(token);
  assert.equal(store.getState().canUndo,false); assert.equal(store.getState().canRedo,false);
  assert.equal(await store.getState().undo(),false); assert.deepEqual(current(),loaded);
  store.getState().renamePart('a','After load'); assert.equal(await store.getState().undo(),true); assert.deepEqual(current(),loaded);
});

test('entering, replacing and leaving demo workspaces cannot expose another document history', async () => {
  store.getState().renamePart('a','Original edited'); const original=current();
  const session=createDemoSession({read:store.getState,initial:store.getInitialState,write:store.setState,isolatePersistence(){return()=>{};}});
  const demo=JSON.parse(readFileSync(new URL('../public/demos/windmill.json',import.meta.url)));
  session.enter(demo);
  assert.equal(store.getState().canUndo,false);
  store.getState().renamePart(demo.state.assembly.parts[0].id,'Changed demo'); assert.equal(store.getState().canUndo,true);
  session.enter(demo); assert.equal(store.getState().canUndo,false);
  store.getState().renamePart(demo.state.assembly.parts[0].id,'Second demo edit');
  session.leave(); assert.deepEqual(current(),original);
  assert.equal(store.getState().canUndo,false); assert.equal(store.getState().canRedo,false);
  assert.equal(await store.getState().undo(),false);
  store.getState().renamePart('a','Edit after return'); assert.equal(await store.getState().undo(),true); assert.deepEqual(current(),original);
});

test('deleted imported STEP assets survive Undo, native Save/parse and a cold asset restore', async () => {
  const bytes=new Uint8Array(readFileSync(new URL('fixtures/recovery-block.step',import.meta.url)));
  const mesh={positions:new Float32Array([0,0,0,20,0,0,0,20,0]),indices:new Uint32Array([0,1,2]),normals:new Float32Array([0,0,1,0,0,1,0,0,1]),edges:[],faces:[]};
  let imports=0;
  const kernel={async importStep(actual,fileName,options){imports++;assert.deepEqual(actual,bytes);return[{shapeId:`step-${options.assetId}-0`,name:fileName,tessellated:mesh,boundingBox:{min:[0,0,0],max:[20,20,10]}}];},exportAssemblyStep(){throw Error('A durable asset must not be repackaged from its live worker.');}};
  globalThis[kernelKey]=kernel;
  const imported=await importDurableStep(kernel,bytes,'recovery-block.step',true);
  const shapeId=imported.parts[0].shapeId;
  const id=store.getState().addImportedStepPart('Durable imported block',shapeId);
  store.getState().setPartTransform(id,{positionMm:[17,-9,11],rotationDeg:[13,29,-41]});
  store.getState().clearHistory(); const before=current();
  store.getState().deletePartCascade(id);
  assert.ok(getImportedShapeMesh(shapeId),'deletion retains source mesh/asset lifetime');
  assert.equal(await store.getState().undo(),true); assert.deepEqual(current(),before); assert.equal(imports,1,'warm registered source is reused');
  const saved=await createProjectDocument(store.getState(),noKernel);
  const parsed=parseProjectDocument(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(parsed.assets,[imported.asset]); assert.deepEqual(parsed.state.assembly,before);
  assert.equal(JSON.stringify(saved).includes('historyUndoLabel'),false,'history is not native project data');
  assert.equal(store.persist.getOptions().partialize(store.getState()).canUndo,undefined);
  clearProjectAssetMemory(); clearImportedShapeCache();
  await restoreProjectAssets(parsed,kernel); assert.equal(imports,2); assert.ok(getImportedShapeMesh(shapeId));
  store.setState(parsed.state);
  assert.deepEqual(current(),before); assert.equal(store.getState().canUndo,false); assert.equal(store.getState().canRedo,false);
  store.getState().deletePartCascade(id); assert.equal(await store.getState().undo(),true); assert.deepEqual(current(),before);
  // A later manual source edit can leave an experiment's references stale. Undo
  // must restore that exact source state, not turn asset recovery into an
  // unrelated whole-project validation or silently rewrite the experiment.
  const staleForce={kind:'equal-force',partIds:['removed-experiment-body'],forceN:0.001,durationMs:2000,direction:[0,1,0]};
  store.setState(s=>({simulation:{...s.simulation,forceExperiment:staleForce}}));store.getState().clearHistory();
  store.getState().deletePartCascade(id);
  assert.equal(await store.getState().undo(),true);assert.deepEqual(current(),before);
  assert.deepEqual(store.getState().simulation.forceExperiment,staleForce);
});
