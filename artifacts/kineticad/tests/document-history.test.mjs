// Real history controller; only asynchronous source preparation is controlled.
// Deferred promises expose stale/failed restore races without sleeps or OCCT.
import test from 'node:test';
import assert from 'node:assert/strict';
import { captureHistoryDocument, createDocumentHistory, createDocumentHistoryController } from '../src/state/documentHistory.ts';

function initial() {return {mode:'modeller',assembly:{id:'a',name:'Original',parts:[],mates:[],booleanFeatures:[],groundPartId:''},
  simulation:{running:false,paused:false,simulationTimeMs:0,timeStepMs:1000/60,gravity:[0,0,-9810],speedMultiplier:1},
  sketchSession:{active:false},sketchDimensionsEditing:false,featureEditor:{open:false},booleanEditor:{open:false},mateEditor:{open:false},selection:null};}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function harness(prepareRestore) {
  let host=initial(); const writes=[];
  const controller=createDocumentHistoryController({read:()=>host,write:patch=>{host={...host,...patch};writes.push(host);},resetTransient:()=>({selection:null}),prepareRestore});
  host={...host,...controller.state()};
  const edit=patch=>{const before=host;host={...host,...patch};controller.record(before,host);host={...host,...controller.state()};};
  return {get state(){return host;},controller,writes,edit,rename(name){edit({assembly:{...host.assembly,name}});},replace(next){controller.clear();host={...next,...controller.state(next)};}};
}

test('failed preparation preserves source and stack, releases busy state and permits a successful retry', async()=>{
  const calls=[],h=harness(document=>{const d=deferred();calls.push({document,...d});return d.promise;});
  h.rename('Edited');const before=captureHistoryDocument(h.state),pending=h.controller.actions.undo();
  assert.equal(h.state.historyBusy,true); assert.equal(h.state.canUndo,false);
  assert.deepEqual(captureHistoryDocument(h.state),before,'target remains private until preparation succeeds');
  calls[0].reject(new Error('Saved STEP source could not be restored'));
  await assert.rejects(pending,/STEP source/);
  assert.deepEqual(captureHistoryDocument(h.state),before);assert.equal(h.state.historyBusy,false);assert.equal(h.state.canUndo,true);assert.equal(h.state.canRedo,false);
  const retry=h.controller.actions.undo();calls[1].resolve(calls[1].document);
  assert.equal(await retry,true);assert.equal(h.state.assembly.name,'Original');assert.equal(h.state.canRedo,true);
});

test('a document edit during pending preparation cannot be overwritten by an old Undo result',async()=>{
  const d=deferred(),h=harness(()=>d.promise);h.rename('First edit');const pending=h.controller.actions.undo();
  h.rename('Newer edit');const newer=captureHistoryDocument(h.state);d.resolve(captureHistoryDocument(initial()));
  assert.equal(await pending,false);assert.deepEqual(captureHistoryDocument(h.state),newer);assert.equal(h.state.historyBusy,false);
  assert.equal(h.state.canRedo,false,'a rejected stale restore never moves the old stack entry');
});

test('replacement by an identical-looking loaded project invalidates pending history and gesture tokens',async()=>{
  const d=deferred(),h=harness(()=>d.promise);h.rename('Edited');const pending=h.controller.actions.undo();
  const loaded=structuredClone(h.state);h.replace(loaded);d.resolve(captureHistoryDocument(initial()));
  assert.equal(await pending,false);assert.equal(h.state.assembly.name,'Edited');assert.equal(h.state.canUndo,false);assert.equal(h.state.canRedo,false);
  const token=h.controller.actions.beginHistoryTransaction('old gesture');h.rename('Gesture');h.replace(initial());h.controller.actions.endHistoryTransaction(token);
  assert.equal(h.state.assembly.name,'Original');assert.equal(h.state.canUndo,false);
});

test('opening and then closing an editor or navigating invalidates a pending restore even when the model is unchanged',async()=>{
  for(const transition of [
    h=>{h.edit({featureEditor:{open:true}});h.edit({featureEditor:{open:false}});},
    h=>{h.edit({mode:'simulator'});h.edit({mode:'modeller'});},
  ]){
    const d=deferred(),h=harness(()=>d.promise);h.rename('Edited');const pending=h.controller.actions.undo();transition(h);
    d.resolve(captureHistoryDocument(initial()));assert.equal(await pending,false);assert.equal(h.state.assembly.name,'Edited');assert.equal(h.state.canUndo,true);
  }
});

test('overlapping Undo calls and a newly started operation cannot publish partial or out-of-order restores',async()=>{
  const calls=[],h=harness(document=>{const d=deferred();calls.push({document,...d});return d.promise;});h.rename('Edited');
  const first=h.controller.actions.undo();assert.equal(await h.controller.actions.undo(),false);assert.equal(calls.length,1);
  const release=h.controller.actions.beginHistoryOperation('new import');calls[0].resolve(calls[0].document);
  assert.equal(await first,false);assert.equal(h.state.assembly.name,'Edited');release();
  const retry=h.controller.actions.undo();calls[1].resolve(calls[1].document);assert.equal(await retry,true);
  assert.equal(h.state.assembly.name,'Original');assert.equal(h.state.canUndo,false);assert.equal(h.state.canRedo,true);
});

test('history entry and byte limits evict whole oldest records, with retained Undo/Redo order intact',()=>{
  const bounded=createDocumentHistory({steps:2,bytes:10000});
  bounded.record('A','B','one');bounded.record('B','C','two');bounded.record('C','D','three');
  assert.deepEqual(bounded.stats,{undo:2,redo:0,bytes:2*(1+1+3+1+1+5)});
  const three=bounded.peek('undo');assert.equal(three.before,'C');bounded.move('undo',three);
  const two=bounded.peek('undo');assert.equal(two.before,'B');bounded.move('undo',two);
  assert.equal(bounded.peek('undo'),undefined);assert.equal(bounded.peek('redo'),two);
  bounded.move('redo',two);assert.equal(bounded.peek('redo'),three);
  assert.equal(bounded.record('C','C'),false);assert.equal(bounded.peek('redo'),three,'no-op preserves future');
  bounded.record('C','E','branch');assert.equal(bounded.peek('redo'),undefined);
  const byteBounded=createDocumentHistory({steps:50,bytes:30});
  byteBounded.record('A','B','x');byteBounded.record('B','C','y');
  assert.equal(byteBounded.stats.undo,2);
  byteBounded.record('C','x'.repeat(30),'oversize');
  assert.deepEqual(byteBounded.stats,{undo:0,redo:0,bytes:0},'oversize edit drops history rather than storing a partial source document');
});
