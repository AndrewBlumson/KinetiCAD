// Actual-CAD closed-loop Stewart regression. Export descriptors first, then:
// node artifacts/kineticad/tests/verify-stewart-physics.mjs /tmp/kineticad-demo-descriptors.json
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import * as Comlink from 'comlink';
import nodeEndpoint from 'comlink/dist/esm/node-adapter.mjs';
import {Euler,Quaternion} from 'three';

const root=new URL('../../../',import.meta.url);
const input=process.argv[2];
assert(input,'Pass the actual OCCT descriptor JSON.');
const payload=JSON.parse(readFileSync(input,'utf8'));
assert.equal(payload.schemaVersion,1);
const fixture=payload.fixtures['stewart-platform'];
assert(fixture,'Actual Stewart CAD descriptors are required.');
const fixturePath='artifacts/kineticad/public/demos/stewart-platform.json';
assert.equal(fixture.fixturePath,fixturePath);
const sha=data=>createHash('sha256').update(data).digest('hex');
const bytes=readFileSync(new URL(fixturePath,root));
assert.equal(sha(bytes),fixture.fixtureSha256,'Stale Stewart CAD descriptors.');
const {assembly,simulation}=JSON.parse(bytes).state;
assert.deepEqual(fixture.mates,assembly.mates);
assert.deepEqual(fixture.gravity,simulation.gravity);
assert.equal(fixture.timeStepMs,simulation.timeStepMs);
assert.deepEqual(simulation.gravity,[0,0,0],'This symmetric-heave reference assumes zero gravity.');
assert.equal(simulation.durationMs,6000,'Reassess references if the experiment window changes.');
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const scale=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const norm=a=>Math.hypot(...a);
const rotate=(q,v)=>{
  const [x,y,z,w]=q;
  const t=[2*(y*v[2]-z*v[1]),2*(z*v[0]-x*v[2]),2*(x*v[1]-y*v[0])];
  return add(add(v,scale(t,w)),[y*t[2]-z*t[1],z*t[0]-x*t[2],x*t[1]-y*t[0]]);
};
const initial=new Map(assembly.parts.map(part=>[part.id,{partId:part.id,positionMm:part.transform.positionMm,rotationQuat:new Quaternion().setFromEuler(new Euler(...part.transform.rotationDeg.map(d=>d*Math.PI/180),'XYZ')).toArray()}]));
const anchor=(poses,partId,pivot)=>add(poses.get(partId).positionMm,rotate(poses.get(partId).rotationQuat,pivot.localPoint));
const mates=new Map(assembly.mates.map(mate=>[mate.id,mate]));
const legs=Array.from({length:6},(_,i)=>{
  const n=i+1;
  const bottom=mates.get(`stewart-base-ball-${n}`),slider=mates.get(`stewart-slider-${n}`),top=mates.get(`stewart-deck-ball-${n}`);
  assert.equal(bottom?.type,'spherical'); assert.equal(slider?.type,'prismatic'); assert.equal(top?.type,'spherical');
  assert.equal(slider.motorVelocityMmPerSec,2);
  const lower=anchor(initial,bottom.partA,bottom.pivotA), upper=anchor(initial,top.partB,top.pivotB);
  const delta=sub(upper,lower);
  return {n,bottom,slider,top,lower,initialLengthMm:norm(delta),horizontalDistanceMm:Math.hypot(delta[0],delta[1]),initialVerticalMm:delta[2]};
});
for(const leg of legs) {
  assert(Math.abs(leg.initialLengthMm-legs[0].initialLengthMm)<1e-8,'Symmetric heave requires equal initial leg lengths.');
  assert(Math.abs(leg.horizontalDistanceMm-legs[0].horizontalDistanceMm)<1e-8,'Symmetric heave requires equal horizontal spans.');
  assert(Math.abs(leg.initialVerticalMm-legs[0].initialVerticalMm)<1e-8);
}
const thresholds={sphericalClosureMm:0.1,sliderLateralErrorMm:0.1,sliderTravelErrorMm:0.1,legLengthResidualMm:0.1,platformHeaveErrorMm:0.1,platformLateralDriftMm:0.1,platformRotationRad:0.002,settledSliderSpeedErrorMmPerSec:0.05};
const report={schemaVersion:1,generatedAt:new Date().toISOString(),fixturePath,fixtureSha256:fixture.fixtureSha256,
  physicsWorkerSha256:sha(readFileSync(new URL('artifacts/kineticad/src/physics/physicsWorker.ts',root))),
  method:'Actual OCCT meshes and mass tensors in the shipped Comlink/Rapier worker. Every fixed-step pose independently reconstructs slider travel, both spherical closures and each platform-to-base leg length. Symmetric heave is derived from initial pivot coordinates and commanded extension using Pythagoras; no pose is assigned to the platform.',
  scope:'Six-second equal-extension, zero-gravity closed-loop test. No arbitrary six-axis inverse kinematics, contact/friction, payload rating or singularity guarantee.',
  durationMs:simulation.durationMs,timeStepMs:simulation.timeStepMs,thresholds,bodyCount:0,jointCount:0,solverIterations:0,actualTimeMs:0,steps:0,
  maxima:{sphericalClosureMm:0,sliderLateralErrorMm:0,sliderTravelErrorMm:0,legLengthResidualMm:0,platformHeaveErrorMm:0,platformLateralDriftMm:0,platformRotationRad:0,settledSliderSpeedErrorMmPerSec:0},
  initialLegLengthMm:legs[0].initialLengthMm,horizontalSpanMm:legs[0].horizontalDistanceMm,
  legs:Object.fromEntries(legs.map(leg=>[String(leg.n),{initialLengthMm:leg.initialLengthMm,finalExtensionMm:0,maxBottomClosureMm:0,maxTopClosureMm:0,maxLengthResidualMm:0,maxTravelErrorMm:0,motorSamples:0}])),trace:[],failures:[],
};
const maxima=report.maxima;
const worker=new Worker(new URL('./helpers/physics-worker-node.mjs',import.meta.url),{execArgv:[]});
const measurements=[];
worker.on('message',message=>{if(message.__log && message.args?.[0]==='[step-diag]') measurements.push(message.args[1]);});
const physics=Comlink.wrap(nodeEndpoint(worker));
try {
  report.rapierVersion=(await physics.init()).version;
  const parts=fixture.parts.map(part=>({...part,meshPositions:new Float32Array(part.meshPositions),meshIndices:new Uint32Array(part.meshIndices)}));
  assert.deepEqual(parts.map(p=>p.id).sort(),assembly.parts.map(p=>p.id).sort());
  const built=await physics.buildWorld({parts,mates:fixture.mates,gravity:fixture.gravity,timeStepMs:fixture.timeStepMs,durationMs:simulation.durationMs});
  assert.equal(built.ok,true,JSON.stringify(built)); assert.deepEqual(built.warnings,[]);
  assert.equal(built.bodyCount,14); assert.equal(built.jointCount,18);
  report.bodyCount=built.bodyCount; report.jointCount=built.jointCount;
  const start=await physics.step(0);
  assert.equal(start.completed,false); assert.equal(start.simulatedTimeMs,0);
  const expectedSteps=Math.floor(simulation.durationMs/simulation.timeStepMs+1e-9);
  let last;
  for(let step=1;step<=expectedSteps;step++) {
    last=await physics.step(simulation.timeStepMs);
    report.actualTimeMs+=last.dtMs; report.steps++;
    assert(Math.abs(last.simulatedTimeMs-report.actualTimeMs)<1e-6);
    assert.equal(last.completed,step===expectedSteps);
    const poses=new Map(last.transforms.map(p=>[p.partId,p]));
    assert.equal(poses.size,14);
    for(const pose of poses.values()) assert([...pose.positionMm,...pose.rotationQuat].every(Number.isFinite) && Math.abs(norm(pose.rotationQuat)-1)<2e-5,'Invalid body pose.');
    const seconds=last.simulatedTimeMs/1000;
    for(const leg of legs) {
      const stat=report.legs[String(leg.n)];
      const lower=anchor(poses,leg.bottom.partA,leg.bottom.pivotA), barrelBottom=anchor(poses,leg.bottom.partB,leg.bottom.pivotB);
      const upper=anchor(poses,leg.top.partB,leg.top.pivotB), rodTop=anchor(poses,leg.top.partA,leg.top.pivotA);
      const bottomError=norm(sub(lower,barrelBottom)),topError=norm(sub(upper,rodTop));
      stat.maxBottomClosureMm=Math.max(stat.maxBottomClosureMm,bottomError); stat.maxTopClosureMm=Math.max(stat.maxTopClosureMm,topError);
      maxima.sphericalClosureMm=Math.max(maxima.sphericalClosureMm,bottomError,topError);
      const axis=rotate(poses.get(leg.slider.partA).rotationQuat,leg.slider.axisLocal);
      const separation=sub(anchor(poses,leg.slider.partB,leg.slider.pivotB),anchor(poses,leg.slider.partA,leg.slider.pivotA));
      const extension=dot(separation,axis);
      const expectedExtension=leg.slider.motorVelocityMmPerSec*seconds;
      stat.finalExtensionMm=extension;
      stat.maxTravelErrorMm=Math.max(stat.maxTravelErrorMm,Math.abs(extension-expectedExtension));
      maxima.sliderTravelErrorMm=Math.max(maxima.sliderTravelErrorMm,stat.maxTravelErrorMm);
      maxima.sliderLateralErrorMm=Math.max(maxima.sliderLateralErrorMm,norm(sub(separation,scale(axis,extension))));
      const lengthResidual=Math.abs(norm(sub(upper,lower))-(leg.initialLengthMm+expectedExtension));
      stat.maxLengthResidualMm=Math.max(stat.maxLengthResidualMm,lengthResidual);
      maxima.legLengthResidualMm=Math.max(maxima.legLengthResidualMm,lengthResidual);
      if(step%60===0 && seconds>=1-1e-9) {
        const measurement=measurements.find(d=>d.stepCount===step && d.mateId===leg.slider.id);
        assert(measurement,'Missing production motor diagnostic.');
        report.solverIterations=measurement.solverIterations;
        stat.motorSamples++;
        maxima.settledSliderSpeedErrorMmPerSec=Math.max(maxima.settledSliderSpeedErrorMmPerSec,Math.abs(measurement.relativeLinearSpeedMmPerSec-leg.slider.motorVelocityMmPerSec));
      }
    }
    const platform=poses.get('stewart-platform'), original=initial.get('stewart-platform');
    const reference=legs[0];
    const expectedZ=original.positionMm[2]+Math.sqrt((reference.initialLengthMm+2*seconds)**2-reference.horizontalDistanceMm**2)-reference.initialVerticalMm;
    maxima.platformHeaveErrorMm=Math.max(maxima.platformHeaveErrorMm,Math.abs(platform.positionMm[2]-expectedZ));
    maxima.platformLateralDriftMm=Math.max(maxima.platformLateralDriftMm,Math.hypot(platform.positionMm[0]-original.positionMm[0],platform.positionMm[1]-original.positionMm[1]));
    const quaternionDot=dot(platform.rotationQuat,original.rotationQuat)/(norm(platform.rotationQuat)*norm(original.rotationQuat));
    maxima.platformRotationRad=Math.max(maxima.platformRotationRad,2*Math.acos(Math.min(1,Math.abs(quaternionDot))));
    if(step%60===0 || step===expectedSteps) report.trace.push({simulatedTimeMs:last.simulatedTimeMs,platformPositionMm:platform.positionMm,expectedPlatformZMm:expectedZ});
  }
  assert(Math.abs(report.actualTimeMs-simulation.durationMs)<1e-6);
  const stopped=await physics.step(10000);
  assert.equal(stopped.dtMs,0); assert.equal(stopped.completed,true); assert.deepEqual(stopped.transforms,last.transforms);
  report.finalTransforms=last.transforms;
  report.completed=true;
  for(const [metric,value] of Object.entries(maxima)) if(!Number.isFinite(value) || value>thresholds[metric]) report.failures.push(`${metric}: ${value} exceeds ${thresholds[metric]}`);
} finally {await physics.destroy();await worker.terminate();}
report.passed=report.failures.length===0;
writeFileSync(new URL('docs/stewart-physics-results.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,maxima:report.maxima,failures:report.failures,report:'docs/stewart-physics-results.json'},null,2));
if(!report.passed) process.exitCode=1;
