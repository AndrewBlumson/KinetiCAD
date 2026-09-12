import test,{before,after}from 'node:test';
import assert from 'node:assert/strict';
import {Worker}from 'node:worker_threads';
import * as Comlink from 'comlink';
import nodeEndpoint from 'comlink/dist/esm/node-adapter.mjs';

let worker,api;
const actuator={kind:'actuator',config:{payloadKg:1,maxForceN:16,initialHeightMm:300,targetHeightMm:300,durationMs:2000,timeStepMs:1000/120}};
const contact={kind:'contact',config:{massKg:2,frictionCoefficient:0,initialVelocityMmPerSec:1000,durationMs:2000,timeStepMs:1000/120}};
before(async()=>{
  worker=new Worker(new URL('./helpers/engineering-bench-node.mjs',import.meta.url),{
    execArgv:[],
  });
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Bench worker did not initialize within 15 seconds.')),15000);
    worker.on('error',error=>{clearTimeout(timer);reject(error);});
    worker.on('message',message=>{if(message.__benchReady){clearTimeout(timer);resolve();}});
  });
  api=Comlink.wrap(nodeEndpoint(worker));
});
after(async()=>{if(api)await api.destroy();if(worker)await worker.terminate();});

test('real Comlink worker serializes initial asynchronous build before zero-time and advancing calls',async()=>{
  const building=api.build(actuator),zero=api.step(0),advancing=api.step(100);
  const [built,paused,advanced]=await Promise.all([building,zero,advancing]);
  assert.equal(built.kind,'actuator');assert.equal(built.simulatedTimeMs,0);assert.equal(built.dtMs,0);
  assert.deepEqual(paused,built,'zero-time request returns the measured initial state');
  assert.equal(advanced.simulatedTimeMs,100);assert.equal(advanced.positionMm[2],300);assert.equal(advanced.appliedForceN,9.81);
  await api.destroy();await assert.rejects(api.step(0),/Build the experiment/);
});

test('queued actuator step, contact rebuild and contact step remain FIFO and reset the physical world',async()=>{
  await api.build(actuator);
  const pendingActuatorStep=api.step(200),switching=api.build(contact),pendingContactStep=api.step(100);
  const [first,newWorld,last]=await Promise.all([pendingActuatorStep,switching,pendingContactStep]);
  assert.equal(first.kind,'actuator');assert.equal(first.simulatedTimeMs,200);
  assert.equal(newWorld.kind,'contact');assert.equal(newWorld.simulatedTimeMs,0);assert.deepEqual(newWorld.body.positionMm,[0,0,20]);
  assert.equal(last.kind,'contact');assert.equal(last.simulatedTimeMs,100);
  assert(Math.abs(last.body.positionMm[0]-100)<0.01,'new world starts at its own origin and velocity');
  assert.equal(last.body.massKg,2);assert(last.contact.active);assert(last.reference.valid);
  const paused=await api.step(0);assert.deepEqual(paused.body,last.body);assert.equal(paused.dtMs,0);
});

test('invalid build rejects and clears the previous world without poisoning subsequent queued rebuilds',async()=>{
  await api.build(contact);
  const invalid=api.build({kind:'actuator',config:{...actuator.config,payloadKg:0}});
  const afterInvalid=api.step(0);
  const rebuilding=api.build(actuator);
  const advancing=api.step(100);
  const results=await Promise.allSettled([invalid,afterInvalid,rebuilding,advancing]);
  assert.equal(results[0].status,'rejected');assert.match(String(results[0].reason),/payloadKg/);
  assert.equal(results[1].status,'rejected');assert.match(String(results[1].reason),/Build the experiment/);
  assert.equal(results[2].status,'fulfilled');assert.equal(results[2].value.kind,'actuator');assert.equal(results[2].value.simulatedTimeMs,0);
  assert.equal(results[3].status,'fulfilled');assert.equal(results[3].value.simulatedTimeMs,100);assert.equal(results[3].value.positionMm[2],300);
  await api.destroy();await api.destroy();await assert.rejects(api.step(0),/Build the experiment/);
});
