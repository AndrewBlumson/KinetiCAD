import test from 'node:test';
import assert from 'node:assert/strict';
import {createActuatorBench,validateActuatorBenchConfig,ACTUATOR_BENCH_PRESETS} from '../src/physics/actuatorBench.ts';
const close=(a,b,t,label)=>assert.ok(Math.abs(a-b)<=t,`${label}: ${a} vs ${b} ± ${t}`);
async function run(config,partition){
  const bench=await createActuatorBench(config);let last=bench.step(0),i=0;const samples=[];
  assert.equal(last.simulatedTimeMs,0);assert.equal(last.dtMs,0);assert.equal(last.inferredActuatorForceN,null);
  while(!last.completed){last=bench.step(partition?.[i++%partition.length]);if(last.dtMs>0)samples.push(last);assert(samples.length<10000);}
  const paused=bench.step(0),frozen=bench.step(1000);assert.deepEqual(paused,{...last,dtMs:0});assert.deepEqual(frozen,paused);
  bench.dispose();bench.dispose();assert.throws(()=>bench.step(),/disposed/);
  return {last,samples};
}
test('capped axial force produces F/m acceleration with correct SI/mm conversion',async()=>{
  for(const mass of [0.5,1,2]){
    const {last,samples}=await run({payloadKg:mass,maxForceN:0.01,targetHeightMm:500,gravityMPerSec2:0,durationMs:100});
    const expectedAcceleration=1000*0.01/mass;
    for(const s of samples){assert.equal(s.appliedForceN,0.01);assert.equal(s.reactionForceN,-0.01);assert(s.saturated);
      close(s.accelerationMmPerSec2,expectedAcceleration,0.001,'actual step acceleration');close(s.inferredActuatorForceN,0.01,1e-6,'force inferred from measured acceleration');}
    close(last.velocityMmPerSec[2],expectedAcceleration*0.1,0.0001,'velocity');
    close(last.positionMm[2],300+0.5*expectedAcceleration*0.1**2,0.003,'displacement');
  }
});
test('a rated motor holds gravity and an overloaded motor saturates and falls at Fmax/m − g',async()=>{
  const hold=await run(ACTUATOR_BENCH_PRESETS.find(p=>p.id==='hold').config);
  close(hold.last.positionMm[2],300,1e-5,'held position');close(hold.last.velocityMmPerSec[2],0,1e-5,'held velocity');
  for(const s of hold.samples){close(s.appliedForceN,9.81,1e-10,'static weight');close(s.inferredActuatorForceN,9.81,1e-6,'measured static force');assert.equal(s.saturated,false);}
  const overload=await run(ACTUATOR_BENCH_PRESETS.find(p=>p.id==='overload').config);
  assert.equal(overload.last.simulatedTimeMs,500);assert.equal(overload.last.stopReason,'duration');
  const acceleration=(16/2-9.81)*1000;
  for(const s of overload.samples){assert.equal(s.appliedForceN,16);assert(s.saturated);close(s.accelerationMmPerSec2,acceleration,0.1,'overload acceleration');close(s.inferredActuatorForceN,16,0.0003,'inferred force');}
  close(overload.last.velocityMmPerSec[2],acceleration*0.5,0.05,'overload velocity');
  close(overload.last.positionMm[2],320+0.5*acceleration*0.5**2,0.2,'overload displacement');
  assert(Math.abs(overload.last.velocityMmPerSec[2])>overload.last.parameters.maxSpeedMmPerSec,'commanded speed is not an artificial fall-speed clamp');
});
test('free-base reaction conserves momentum and mass-weighted centre of mass',async()=>{
  const {last,samples}=await run({payloadKg:1,maxForceN:0.01,targetHeightMm:500,gravityMPerSec2:0,baseFixed:false,durationMs:1000});
  for(const s of samples){close(s.massKg*s.velocityMmPerSec[2]+4*s.baseVelocityMmPerSec[2],0,0.0001,'total linear momentum');close((s.massKg*s.positionMm[2]+4*s.basePositionMm[2])/5,60,0.0003,'centre of mass');}
  assert(last.baseVelocityMmPerSec[2]<0 && last.velocityMmPerSec[2]>0);
});
test('lift reaches its target without ever exceeding the actuator force rating',async()=>{
  const {last,samples}=await run(ACTUATOR_BENCH_PRESETS.find(p=>p.id==='lift').config);
  close(last.positionMm[2],380,0.02,'settled lift position');close(last.velocityMmPerSec[2],0,0.06,'settled lift velocity');
  for(const s of samples){assert(Math.abs(s.appliedForceN)<=16);close(s.inferredActuatorForceN,s.appliedForceN,0.0001,'applied versus inferred force');}
  close(last.energyJ.kinetic+last.energyJ.potential,last.energyJ.actuatorWork,0.001,'actuator work versus mechanical energy');
});
test('fixed-step partitioning is invariant and halving dt reduces overload position error',async()=>{
  const c=ACTUATOR_BENCH_PRESETS.find(p=>p.id==='overload').config;
  const a=await run(c),b=await run(c,[2,17,6,33,0,11]),fine=await run({...c,timeStepMs:1000/240});
  assert.deepEqual(a.last.positionMm,b.last.positionMm);assert.deepEqual(a.last.velocityMmPerSec,b.last.velocityMmPerSec);
  const exact=320+0.5*(16/2-9.81)*1000*0.5**2;
  assert(Math.abs(fine.last.positionMm[2]-exact)<0.75*Math.abs(a.last.positionMm[2]-exact),'smaller integration step improves position');
});
test('travel cutoff stops before geometry crosses the base and is distinguished from modeled impact',async()=>{
  const {last}=await run({payloadKg:10,maxForceN:0.01,targetHeightMm:500,initialHeightMm:300,durationMs:2000});
  assert.equal(last.stopReason,'travel-boundary');assert(last.simulatedTimeMs<2000);assert(last.positionMm[2]>80);assert(last.velocityMmPerSec[2]<0,'cutoff preserves actual velocity without inventing a collision');
});
test('invalid configuration and step requests reject explicitly',async()=>{
  for(const c of [{payloadKg:0,maxForceN:1,targetHeightMm:300},{payloadKg:1,maxForceN:Infinity,targetHeightMm:300},{payloadKg:1,maxForceN:1,targetHeightMm:300,timeStepMs:100}])assert.throws(()=>validateActuatorBenchConfig(c),/Actuator bench/);
  const b=await createActuatorBench(ACTUATOR_BENCH_PRESETS[0].config);assert.throws(()=>b.step(-1),/non-negative/);assert.throws(()=>b.step(NaN),/non-negative/);assert.equal(b.step(0).simulatedTimeMs,0);b.dispose();
});
