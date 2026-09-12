import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStore } from 'zustand/vanilla';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createFourBarDocument, matchesFourBarAssembly, matchesFourBarConfiguration } from '../src/mechanisms/fourBarWorkspace.ts';
import { createProjectDocument } from '../src/project/projectAssets.ts';
import { parseProjectDocument } from '../src/project/projectDocument.ts';
import { parseDemoDocument } from '../src/demos/demoDocument.ts';
import { createDemoSession } from '../src/demos/demoSession.ts';
import { independentFourBarParams as params } from './helpers/four-bar-reference.mjs';
const design=patch=>({kind:'four-bar-path',version:1,params:{...structuredClone(params),...patch},targetPathMm:[[-30,-20],[30,-20],[30,20],[-30,20],[-30,-20]],search:{algorithmVersion:1,seed:42}});
const create=()=>createFourBarDocument(design());
const noKernel=async()=>{throw Error('Native Save must not initialize the CAD worker.');};

test('four-bar document is fresh, stopped, isolated from the input and limited to the validated cycle profile',()=>{
  const input=design(),doc=createFourBarDocument(input);assert.equal(doc.version,9);assert.equal(doc.state.mode,'simulator');
  assert.equal(doc.state.simulation.running,false);assert.equal(doc.state.simulation.simulationTimeMs,0);
  assert.equal(doc.state.simulation.durationMs,6000);assert.equal(doc.state.simulation.timeStepMs,1000/120);assert.deepEqual(doc.state.simulation.gravity,[0,0,0]);
  input.params.originMm[0]=999;input.targetPathMm[0][0]=999;assert.equal(doc.state.simulation.fourBar.params.originMm[0],0);assert.equal(doc.state.simulation.fourBar.targetPathMm[0][0],-30);
  for(const patch of [{rpm:0},{rpm:15},{initialCrankAngleDeg:30}])assert.throws(()=>createFourBarDocument(design(patch)));
});

test('native Save/project and demo parsers retain four-bar target, seed, branch, placement and complete feature histories',async()=>{
  const doc=createFourBarDocument(design({branch:-1,rpm:-10,originMm:[31,-27],rotationDeg:79}));
  doc.state.simulation.running=true;doc.state.simulation.paused=true;doc.state.simulation.simulationTimeMs=2999;
  const saved=await createProjectDocument(doc.state,noKernel),loaded=parseProjectDocument(JSON.parse(JSON.stringify(saved))),demo=parseDemoDocument({version:9,state:loaded.state});
  assert.deepEqual(saved.assets,[]);assert.deepEqual(loaded.state.assembly,doc.state.assembly);assert.deepEqual(loaded.state.simulation.fourBar,doc.state.simulation.fourBar);
  assert.equal(loaded.state.simulation.running,false);assert.equal(loaded.state.simulation.paused,false);assert.equal(loaded.state.simulation.simulationTimeMs,0);
  assert.equal(matchesFourBarConfiguration(demo.state.assembly,demo.state.simulation),true);
});

test('cosmetic names and derived caches do not disable a physically unchanged saved four-bar',()=>{
  const{assembly,simulation}=create().state;assembly.name='My custom name';assembly.id='my-id';
  for(const part of assembly.parts){part.name='Named';part.massKg=500;part.meshHash='cached';part.volumeCm3=123;part.sketches.forEach(s=>s.name='Sketch');part.features=part.features.map(f=>Object.fromEntries(Object.entries(f).reverse()));}
  assembly.mates.forEach(m=>m.name='Joint');assert(matchesFourBarAssembly(assembly,params));assert(matchesFourBarConfiguration(assembly,simulation));
});

test('manual geometry, transforms, materials, visibility, ground or joint changes disable generated reference claims',()=>{
  const edits=[a=>a.parts[0].sketches[0].primitives[0].width++,a=>a.parts[2].features[0].depthMm++,a=>a.parts[1].features.reverse(),a=>a.parts[2].transform.rotationDeg[2]++,a=>a.parts[2].transform.positionMm[0]++,a=>a.parts[2].materialId='steel-1018',a=>a.parts[1].visible=false,a=>a.groundPartId='four-bar-crank',a=>a.mates[0].motorSpeedRpm++,a=>a.mates[1].pivotA.localPoint[0]++,a=>a.mates[0].axisLocal=[0,1,0],a=>a.parts.pop(),a=>a.booleanFeatures.push({id:'extra'})];
  for(const edit of edits){const{assembly,simulation}=create().state;edit(assembly);assert.equal(matchesFourBarAssembly(assembly,params),false);assert.equal(matchesFourBarConfiguration(assembly,simulation),false);}
});

test('reference profile rejects altered gravity, fixed step, duration, manual-edit marker and other experiment controllers',()=>{
  const{assembly,simulation}=create().state;
  for(const patch of [{gravity:[0,0,-9810]},{timeStepMs:1000/60},{durationMs:8000},{sketchGeometryEdited:true},{fourBar:undefined},{forceExperiment:{}},{stewartMotion:{}},{crankSlider:{}}])assert.equal(matchesFourBarConfiguration(assembly,{...simulation,...patch}),false);
  assert(matchesFourBarConfiguration(assembly,{...simulation,running:true,paused:true,simulationTimeMs:1500,speedMultiplier:2}));
});

test('invalid loaded design metadata rejects before replacing a workspace',async()=>{
  for(const mutate of [d=>d.version=2,d=>d.params.branch=0,d=>d.params.crankLengthMm=NaN,d=>d.search.seed=-1,d=>d.targetPathMm.pop()]){
    const doc=create();mutate(doc.state.simulation.fourBar);assert.throws(()=>parseDemoDocument(doc));await assert.rejects(createProjectDocument(doc.state,noKernel));
  }
});

test('multiple generated builds and native Save preserve original persistence and live STEP references until return',async()=>{
  const original=JSON.parse(readFileSync(new URL('../public/demos/windmill.json',import.meta.url))).state;
  original.assembly.parts[0].features=[{id:'import',type:'imported-step',shapeId:'original-worker-shape'}];
  const records=new Map(),storage=createJSONStorage(()=>({getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v),removeItem:k=>records.delete(k)}));
  const store=createStore(persist(()=>({...original,selection:'original'}),{name:'project',version:9,storage}));store.setState({selection:'original'});const before=records.get('project');
  const session=createDemoSession({read:store.getState,initial:store.getInitialState,write:store.setState,isolatePersistence(){const previous=store.persist.getOptions().storage;store.persist.setOptions({storage:{getItem:()=>null,setItem(){},removeItem(){}}});return()=>store.persist.setOptions({storage:previous});}});
  for(const branch of [1,-1,1]){session.enter(createFourBarDocument(design({branch})));const saved=await createProjectDocument(store.getState(),noKernel);assert.equal(saved.state.simulation.fourBar.params.branch,branch);assert.equal(records.get('project'),before);}
  session.leave();assert.equal(store.getState().assembly,original.assembly);assert.equal(store.getState().assembly.parts[0].features[0].shapeId,'original-worker-shape');assert.equal(store.getState().selection,'original');assert.equal(records.get('project'),before);
  store.setState({assembly:{...original.assembly,name:'Original edit'}});assert.equal(JSON.parse(records.get('project')).state.assembly.name,'Original edit');
});

test('actual Chrome native Save is canonical despite platform transcendental rounding',()=>{
  const doc=parseProjectDocument(JSON.parse(readFileSync(new URL('../../../docs/fixtures/four-bar/browser-custom-loop.kineticad.json',import.meta.url))));
  assert.equal(matchesFourBarAssembly(doc.state.assembly,doc.state.simulation.fourBar.params),true);
  assert.equal(matchesFourBarConfiguration(doc.state.assembly,doc.state.simulation),true);
  const assembly=structuredClone(doc.state.assembly);
  assembly.parts.find(p=>p.id==='four-bar-rocker').transform.rotationDeg[2]+=2.842170943040401e-14;
  assert.equal(matchesFourBarAssembly(assembly,doc.state.simulation.fourBar.params),true);
});

test('roundoff matching preserves exact structure and rejects tiny meaningful edits and nonfinite values',()=>{
  const edits=[a=>a.parts[0].sketches[0].primitives[0].width+=1e-8,a=>a.mates[1].pivotA.localPoint[0]+=1e-8,
    a=>a.parts[3].transform.rotationDeg[2]+=1e-8,a=>a.parts[1].transform.positionMm[0]=NaN,
    a=>a.mates[0].motorSpeedRpm=Infinity,a=>a.parts[1].transform.positionMm=[0,,30],a=>a.parts[0].features[0].depthMm='6',
    a=>a.parts[0].features[0].unexpectedPhysicalField=0,a=>a.parts[0].features.reverse(),a=>a.parts[0].features[0].depthMm=undefined];
  for(const edit of edits){const{assembly}=create().state;edit(assembly);assert.equal(matchesFourBarAssembly(assembly,params),false);}
});
