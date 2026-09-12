// Independent numeric evidence for the explicit capped-force experiment.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createActuatorBench,ACTUATOR_BENCH_PRESETS} from '../src/physics/actuatorBench.ts';
const root=new URL('../../../',import.meta.url);
const sha=x=>createHash('sha256').update(x).digest('hex');
const thresholds={forceInferenceErrorN:0.0004,holdPositionErrorMm:0.00001,liftPositionErrorMm:0.02,overloadPositionErrorMm:0.2,overloadVelocityErrorMmPerSec:0.05,referenceVelocityErrorMmPerSec:0.05,referencePositionErrorMm:0.2,energyBalanceErrorJ:0.003,momentumErrorKgMmPerSec:0.0001};
const report={schemaVersion:1,generatedAt:new Date().toISOString(),moduleSha256:sha(readFileSync(new URL('artifacts/kineticad/src/physics/actuatorBench.ts',root))),
  method:'Actual Rapier 0.12 rigid bodies and an unpowered prismatic guide. Motor force is explicitly capped in newtons and applied as an equal/opposite pair. Independent script reconstructs acceleration from successive velocity readouts, compares inferred F=m(a+g) to the applied force, integrates the force schedule from rest, and checks analytic hold/overload and free-base momentum.',
  limitations:'This is a simple vertical actuator experiment, not a load rating for the Stewart mechanism. Ideal guide; no contact, bearing friction, electrical motor model, transmission efficiency, structural deformation or impacts. The travel boundary ends the test before a possible crossing and preserves its measured state. Commanded speed limits do not clamp gravity-driven actual velocity.',thresholds,cases:[],failures:[]};
const check=(label,value,bound)=>{if(!(value<=bound))report.failures.push(`${label}: ${value} exceeds ${bound}`);};
async function run(name,config){
  const bench=await createActuatorBench(config);let old=bench.step(0),current=old,index=0,expectedVelocity=0,expectedPosition=current.positionMm[2];
  const summary={name,parameters:current.parameters,massKg:current.massKg,samples:0,maxAppliedForceN:0,maxForceInferenceErrorN:0,maxReferenceVelocityErrorMmPerSec:0,maxReferencePositionErrorMm:0,maxEnergyBalanceErrorJ:0,maxMomentumErrorKgMmPerSec:0,trace:[]};
  while(!current.completed){
    current=bench.step();if(current.dtMs===0)break;index++;const dt=current.dtMs/1000;
    const actualAcceleration=(current.velocityMmPerSec[2]-old.velocityMmPerSec[2])/dt;
    const inferredForce=current.massKg*(actualAcceleration/1000+current.parameters.gravityMPerSec2);
    const expectedAcceleration=(current.appliedForceN/current.massKg-current.parameters.gravityMPerSec2)*1000;
    expectedPosition+=expectedVelocity*dt+0.5*expectedAcceleration*dt*dt;expectedVelocity+=expectedAcceleration*dt;
    summary.maxAppliedForceN=Math.max(summary.maxAppliedForceN,Math.abs(current.appliedForceN));
    summary.maxForceInferenceErrorN=Math.max(summary.maxForceInferenceErrorN,Math.abs(inferredForce-current.appliedForceN));
    summary.maxReferenceVelocityErrorMmPerSec=Math.max(summary.maxReferenceVelocityErrorMmPerSec,Math.abs(current.velocityMmPerSec[2]-expectedVelocity));
    summary.maxReferencePositionErrorMm=Math.max(summary.maxReferencePositionErrorMm,Math.abs(current.positionMm[2]-expectedPosition));
    summary.maxEnergyBalanceErrorJ=Math.max(summary.maxEnergyBalanceErrorJ,Math.abs(current.energyJ.kinetic+current.energyJ.potential-current.energyJ.actuatorWork));
    if(!current.parameters.baseFixed)summary.maxMomentumErrorKgMmPerSec=Math.max(summary.maxMomentumErrorKgMmPerSec,Math.abs(current.massKg*current.velocityMmPerSec[2]+4*current.baseVelocityMmPerSec[2]));
    assert(Math.abs(current.appliedForceN+current.reactionForceN)<1e-12);
    assert(Math.abs(current.inferredActuatorForceN-inferredForce)<1e-10);
    if(index%Math.max(1,Math.round(50/current.parameters.timeStepMs))===0)summary.trace.push({timeMs:current.simulatedTimeMs,heightMm:current.positionMm[2],velocityMmPerSec:current.velocityMmPerSec[2],appliedForceN:current.appliedForceN,inferredForceN:inferredForce,saturated:current.saturated});
    old=current;
  }
  summary.samples=index;summary.final=current;
  assert(current.completed);assert.equal(bench.step(0).dtMs,0);assert.deepEqual(bench.step(1000).positionMm,current.positionMm);bench.dispose();
  check(`${name} applied-force cap`,summary.maxAppliedForceN,current.parameters.maxForceN);
  check(`${name} force inference`,summary.maxForceInferenceErrorN,thresholds.forceInferenceErrorN);
  check(`${name} reference velocity`,summary.maxReferenceVelocityErrorMmPerSec,thresholds.referenceVelocityErrorMmPerSec);
  check(`${name} reference displacement`,summary.maxReferencePositionErrorMm,thresholds.referencePositionErrorMm);
  check(`${name} energy balance`,summary.maxEnergyBalanceErrorJ,thresholds.energyBalanceErrorJ);
  if(name==='hold')check('stationary gravity hold',Math.abs(current.positionMm[2]-current.parameters.initialHeightMm),thresholds.holdPositionErrorMm);
  if(name==='lift')check('target lift',Math.abs(current.positionMm[2]-current.parameters.targetHeightMm),thresholds.liftPositionErrorMm);
  if(name.startsWith('overload')){
    const t=current.simulatedTimeMs/1000,a=(current.parameters.maxForceN/current.massKg-current.parameters.gravityMPerSec2)*1000;
    summary.closedForm={accelerationMmPerSec2:a,velocityMmPerSec:a*t,positionMm:current.parameters.initialHeightMm+0.5*a*t*t};
    assert(summary.trace.every(p=>p.saturated));
    check(`${name} analytic displacement`,Math.abs(current.positionMm[2]-summary.closedForm.positionMm),thresholds.overloadPositionErrorMm);
    check(`${name} analytic velocity`,Math.abs(current.velocityMmPerSec[2]-summary.closedForm.velocityMmPerSec),thresholds.overloadVelocityErrorMmPerSec);
  }
  if(!current.parameters.baseFixed)check('free-base momentum',summary.maxMomentumErrorKgMmPerSec,thresholds.momentumErrorKgMmPerSec);
  report.cases.push(summary);console.log(`${name}: force residual ${summary.maxForceInferenceErrorN} N, height ${current.positionMm[2]} mm, ${current.stopReason}`);
}
try{
  for(const p of ACTUATOR_BENCH_PRESETS)await run(p.id,p.config);
  await run('overload-240Hz',{...ACTUATOR_BENCH_PRESETS.find(p=>p.id==='overload').config,timeStepMs:1000/240});
  await run('free-base-reaction',{payloadKg:1,maxForceN:0.01,initialHeightMm:300,targetHeightMm:500,gravityMPerSec2:0,baseFixed:false,durationMs:1000});
  report.passed=report.failures.length===0;
}catch(error){report.passed=false;report.failures.push(error.message);}
writeFileSync(new URL('docs/actuator-bench-results.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,failures:report.failures,report:'docs/actuator-bench-results.json'},null,2));if(!report.passed)process.exitCode=1;
