import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { preflightFourBarDocument } from '../src/mechanisms/fourBarPreflight.ts';
import { clearCache } from '../src/features/featureCache.ts';
import { clearVolumeCache } from '../src/features/volumeCache.ts';
import { createFourBarDocument } from '../src/mechanisms/fourBarWorkspace.ts';
import { FOUR_BAR_PRESETS } from '../src/mechanisms/fourBarSynthesis.ts';
import { parseProjectState } from '../src/project/projectDocument.ts';
const design = () => ({kind:'four-bar-path',version:1,targetPathMm:FOUR_BAR_PRESETS[0].targetPathMm,params:FOUR_BAR_PRESETS[0].knownParams,search:{algorithmVersion:1,seed:123}});
const triangle = {solidCount:1,positions:new Float32Array([0,0,0,1,0,0,0,1,0]),indices:new Uint32Array([0,1,2]),normals:new Float32Array(9),edges:[],faces:[]};
const mass = {volumeMm3:10,massKg:0.00001,comLocal:[0,0,0],principalInertiaKgMm2:[0.00001,0.00001,0.00001],principalInertiaLocalFrame:[0,0,0,1]};
beforeEach(()=>{clearCache();clearVolumeCache();});
test('four-bar project retains its drawing and rejects corrupt metadata before loading',()=>{
 const doc=createFourBarDocument(design()),restored=parseProjectState(JSON.parse(JSON.stringify(doc.state)));
 assert.deepEqual(restored.simulation.fourBar,doc.state.simulation.fourBar);
 for(const mutate of [s=>s.fourBar.targetPathMm.pop(),s=>s.fourBar.search.seed=-1,s=>s.fourBar.params.crankLengthMm=999,s=>s.forceExperiment={kind:'equal-force',partIds:['four-bar-crank'],forceN:1,direction:[1,0,0],durationMs:1000}]){
  const bad=structuredClone(doc.state);mutate(bad.simulation);assert.throws(()=>parseProjectState(bad));
 }
});
test('four-bar preflight checks every full feature chain without mutating the document',async()=>{
 const doc=createFourBarDocument(design()),before=structuredClone(doc),calls=[];
 await preflightFourBarDocument(doc,{buildPartMesh:async args=>{calls.push(args);return {mesh:triangle,unitDensityMassProperties:mass};}},()=>{});
 assert.equal(calls.length,4);
 calls.forEach((args,i)=>{assert.deepEqual(args.features,doc.state.assembly.parts[i].features);assert.deepEqual(args.sketches,doc.state.assembly.parts[i].sketches);});
 assert.deepEqual(doc,before);
});
test('four-bar preflight rejects failed geometry, invalid mesh and missing or invalid mass properties',async()=>{
 for(const result of [new Error('invalid solid'),{mesh:{...triangle,solidCount:2},unitDensityMassProperties:mass},{mesh:{...triangle,solidCount:undefined},unitDensityMassProperties:mass},{mesh:{...triangle,positions:new Float32Array([NaN,0,0,1,0,0,0,1,0])},unitDensityMassProperties:mass},{mesh:triangle},{mesh:triangle,unitDensityMassProperties:{...mass,volumeMm3:0}},{mesh:triangle,unitDensityMassProperties:{...mass,principalInertiaKgMm2:[0,0,0]}}]){
  clearCache();clearVolumeCache();const doc=createFourBarDocument(design()),before=structuredClone(doc);
  await assert.rejects(preflightFourBarDocument(doc,{buildPartMesh:async()=>{if(result instanceof Error)throw result;return result;}},()=>{}));assert.deepEqual(doc,before);
 }
});
test('four-bar stale model detection after a delayed CAD response prevents the next part building',async()=>{
 const doc=createFourBarDocument(design());let resolve,current=true,calls=0;
 const pending=preflightFourBarDocument(doc,{buildPartMesh:()=>{calls++;return new Promise(yes=>{resolve=yes;});}},()=>{if(!current)throw new Error('model changed');});
 assert.equal(calls,1);current=false;resolve({mesh:triangle,unitDensityMassProperties:mass});
 await assert.rejects(pending,/model changed/);assert.equal(calls,1);
});
