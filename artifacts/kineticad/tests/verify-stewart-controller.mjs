// Actual final OCCT geometry/mass → shipped physics worker → independent pose readback.
// node artifacts/kineticad/tests/verify-stewart-controller.mjs /tmp/kineticad-demo-descriptors.json
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import * as Comlink from 'comlink';
import nodeEndpoint from 'comlink/dist/esm/node-adapter.mjs';
import {Euler,Quaternion,Vector3} from 'three';

const root=new URL('../../../',import.meta.url),input=process.argv[2];
assert(input,'Pass current actual-CAD descriptor JSON.');
const descriptors=JSON.parse(readFileSync(input)),fixture=descriptors.fixtures['stewart-platform'];
assert.equal(descriptors.schemaVersion,1);assert(fixture);
const sha=x=>createHash('sha256').update(x).digest('hex');
const bytes=readFileSync(new URL(fixture.fixturePath,root));assert.equal(sha(bytes),fixture.fixtureSha256,'Stale actual-CAD descriptor.');
const state=JSON.parse(bytes).state;
assert.deepEqual(fixture.mates,state.assembly.mates);
const parts=fixture.parts.map(p=>({...p,meshPositions:new Float32Array(p.meshPositions),meshIndices:new Uint32Array(p.meshIndices)}));
const worker=new Worker(new URL('./helpers/physics-worker-node.mjs',import.meta.url),{execArgv:[]});
const physics=Comlink.wrap(nodeEndpoint(worker));
const v=a=>new Vector3(...a),q=a=>new Quaternion(...a).normalize();
const bodyPoint=(poses,id,pivot)=>v(pivot.localPoint).applyQuaternion(q(poses.get(id).rotationQuat)).add(v(poses.get(id).positionMm));
const orientationError=(a,b)=>{const qa=q(a),qb=q(b);if(qa.dot(qb)<0)qb.set(-qb.x,-qb.y,-qb.z,-qb.w);return 4*Math.atan2(Math.hypot(...qa.toArray().map((v,i)=>v-qb.toArray()[i])),Math.hypot(...qa.toArray().map((v,i)=>v+qb.toArray()[i])))*180/Math.PI;};
const mateById=new Map(fixture.mates.map(m=>[m.id,m]));
const initialPoses=new Map(parts.map(p=>[p.id,{positionMm:p.transform.positionMm,rotationQuat:new Quaternion().setFromEuler(new Euler(...p.transform.rotationDeg.map(x=>x*Math.PI/180),'XYZ')).toArray()}]));
const geometry=Array.from({length:6},(_,i)=>{const n=i+1,lower=mateById.get(`stewart-base-ball-${n}`),upper=mateById.get(`stewart-deck-ball-${n}`),slider=mateById.get(`stewart-slider-${n}`);return {lower,upper,slider,base:bodyPoint(initialPoses,lower.partA,lower.pivotA),initialLength:bodyPoint(initialPoses,upper.partB,upper.pivotB).distanceTo(bodyPoint(initialPoses,lower.partA,lower.pivotA))};});
const thresholds={peakPositionErrorMm:0.1,peakOrientationErrorDeg:0.05,finalPositionErrorMm:0.05,finalOrientationErrorDeg:0.05,jointClosureMm:0.1,sliderLateralMm:0.1,commandSpeedMmPerSec:8,measuredSpeedMmPerSec:8.1};
const report={schemaVersion:1,generatedAt:new Date().toISOString(),fixturePath:fixture.fixturePath,fixtureSha256:fixture.fixtureSha256,
  sourceSha256:Object.fromEntries(['physicsWorker.ts','stewartController.ts','stewartKinematics.ts'].map(p=>[p,sha(readFileSync(new URL('artifacts/kineticad/src/physics/'+p,root)))])),
  method:'Actual OCCT meshes, centres of mass and full principal inertia in the shipped Comlink/Rapier worker. Independent Three.js transforms reconstruct requested and actual deck poses, six anchor-to-anchor lengths, all 12 spherical closures, six slider lateral errors and actual stepwise actuator velocities. No deck transform is assigned by the controller.',
  measurementCadence:'Fifteen motion cases independently reconstruct every fixed solver step. The irregular render-partition case reconstructs each returned batch endpoint and additionally requires bit-identical final transforms to its every-step reference; the controller itself monitors tracking every internal solver step.',
  scope:'Bounded ±5 mm translations and ±2° rotations, zero gravity, no external loads, ideal velocity servos. This report measures selected trajectories, not contact/friction, finite drive force, payload ratings or deformation.',thresholds,cases:[],failures:[]};
const check=(label,actual,limit)=>{if(!(actual<=limit))report.failures.push(`${label}: ${actual} > ${limit}`);};

async function run(name,target,{timeStepMs=1000/60,partition=[timeStepMs]}={}) {
  const config={kind:'six-axis',target,moveDurationMs:4000,settleDurationMs:2000};
  const build=await physics.buildWorld({parts,mates:fixture.mates,gravity:[0,0,0],timeStepMs,stewartMotion:config});assert.equal(build.ok,true,JSON.stringify(build));
  const summary={name,target,timeStepMs,partition,bodyCount:build.bodyCount,jointCount:build.jointCount,steps:0,
    peakPositionErrorMm:0,peakOrientationErrorDeg:0,maxJointClosureMm:0,maxSliderLateralMm:0,maxCommandSpeedMmPerSec:0,maxMeasuredSpeedMmPerSec:0,minExtensionMm:Infinity,maxExtensionMm:-Infinity,maxJacobianCondition:0,trace:[]};
  let last=await physics.step(0),request=0,lastTime=0,previousExtensions=null;
  const targetQ=new Quaternion().setFromEuler(new Euler(...target.rotationDeg.map(x=>x*Math.PI/180),'XYZ'));
  const targetAxis=new Vector3(targetQ.x,targetQ.y,targetQ.z),sinHalf=targetAxis.length();
  const targetAngle=2*Math.atan2(sinHalf,targetQ.w);if(sinHalf>0)targetAxis.multiplyScalar(1/sinHalf);else targetAxis.set(0,0,1);
  while(!last.completed) {
    last=await physics.step(partition[request++%partition.length]);assert(request<10000);
    if(last.dtMs===0)continue;
    const time=last.simulatedTimeMs,poses=new Map(last.transforms.map(p=>[p.partId,p])),deck=poses.get('stewart-platform'),m=last.stewartMeasurement;assert(m);
    const fraction=Math.min(1,time/4000),progress=10*fraction**3-15*fraction**4+6*fraction**5;
    const expectedPosition=v(target.translationMm).multiplyScalar(progress).add(new Vector3(0,0,160));
    // Three's slerp deliberately uses normalized lerp below 3.6 degrees.
    // The specified trajectory uses exact angular progress, so use its
    // independent axis-angle constructor rather than that approximation.
    const expectedQuaternion=new Quaternion().setFromAxisAngle(targetAxis,targetAngle*progress);
    const positionError=v(deck.positionMm).distanceTo(expectedPosition),rotationError=orientationError(deck.rotationQuat,expectedQuaternion.toArray());
    assert(v(m.requestedPose.positionMm).distanceTo(expectedPosition)<1e-8,'independent desired translation');
    assert(orientationError(m.requestedPose.rotationQuat,expectedQuaternion.toArray())<1e-8,'independent desired orientation');
    assert.equal(JSON.stringify(m.actualPose.positionMm),JSON.stringify(deck.positionMm),'readout uses actual solver pose');
    summary.peakPositionErrorMm=Math.max(summary.peakPositionErrorMm,positionError);summary.peakOrientationErrorDeg=Math.max(summary.peakOrientationErrorDeg,rotationError);
    summary.maxJacobianCondition=Math.max(summary.maxJacobianCondition,m.jacobianCondition);
    const extensions=[];
    geometry.forEach((leg,i)=>{
      for(const joint of [leg.lower,leg.upper])summary.maxJointClosureMm=Math.max(summary.maxJointClosureMm,bodyPoint(poses,joint.partA,joint.pivotA).distanceTo(bodyPoint(poses,joint.partB,joint.pivotB)));
      const actualLength=bodyPoint(poses,leg.upper.partB,leg.upper.pivotB).distanceTo(leg.base);
      const expectedLength=v(leg.upper.pivotB.localPoint).applyQuaternion(expectedQuaternion).add(expectedPosition).distanceTo(leg.base);
      assert(Math.abs(m.actuators[i].actualLengthMm-actualLength)<1e-8,'reported length derives from actual deck anchors');
      assert(Math.abs(m.actuators[i].targetLengthMm-expectedLength)<1e-8,`${name} at ${time} ms leg ${i+1}: reported target length ${m.actuators[i].targetLengthMm} vs independent IK ${expectedLength}`);
      const a=poses.get(leg.slider.partA),axis=new Vector3(0,0,1).applyQuaternion(q(a.rotationQuat));
      const delta=bodyPoint(poses,leg.slider.partB,leg.slider.pivotB).sub(bodyPoint(poses,leg.slider.partA,leg.slider.pivotA));
      const extension=delta.dot(axis);extensions.push(extension);
      summary.minExtensionMm=Math.min(summary.minExtensionMm,extension);summary.maxExtensionMm=Math.max(summary.maxExtensionMm,extension);
      summary.maxSliderLateralMm=Math.max(summary.maxSliderLateralMm,delta.clone().addScaledVector(axis,-extension).length());
      summary.maxCommandSpeedMmPerSec=Math.max(summary.maxCommandSpeedMmPerSec,Math.abs(m.actuators[i].commandVelocityMmPerSec));
      if(previousExtensions)summary.maxMeasuredSpeedMmPerSec=Math.max(summary.maxMeasuredSpeedMmPerSec,Math.abs(extension-previousExtensions[i])/((time-lastTime)/1000));
    });
    previousExtensions=extensions;lastTime=time;summary.steps+=Math.round(last.dtMs/timeStepMs);
    if(Math.abs(time/1000-Math.round(time/1000))<1e-7)summary.trace.push({simulatedTimeMs:time,positionMm:deck.positionMm,rotationDeg:m.actualRotationDeg,positionErrorMm:positionError,orientationErrorDeg:rotationError});
  }
  assert.equal(last.simulatedTimeMs,6000);assert.equal(last.stewartMeasurement.phase,'complete');
  summary.finalPositionErrorMm=v(last.stewartMeasurement.actualPose.positionMm).distanceTo(v(target.translationMm).add(new Vector3(0,0,160)));
  summary.finalOrientationErrorDeg=orientationError(last.stewartMeasurement.actualPose.rotationQuat,targetQ.toArray());
  summary.reached=last.stewartMeasurement.reached;assert(summary.reached,'controller reports reached target');
  summary.finalTransforms=last.transforms;
  const frozen=await physics.step(1000);assert.equal(frozen.dtMs,0);assert.equal(frozen.simulatedTimeMs,6000);assert.deepEqual(frozen.transforms,last.transforms);
  for(const [key,limit] of Object.entries(thresholds)){
    const field=({jointClosureMm:'maxJointClosureMm',sliderLateralMm:'maxSliderLateralMm',commandSpeedMmPerSec:'maxCommandSpeedMmPerSec',measuredSpeedMmPerSec:'maxMeasuredSpeedMmPerSec'})[key]??key;
    check(`${name} ${key}`,summary[field],limit);
  }
  check(`${name} lower stroke`,-summary.minExtensionMm,12.1);check(`${name} upper stroke`,summary.maxExtensionMm,20.1);
  report.cases.push(summary);
  console.log(`${name}: final ${summary.finalPositionErrorMm.toExponential(3)} mm, ${summary.finalOrientationErrorDeg.toExponential(3)}°, peak ${summary.peakPositionErrorMm.toExponential(3)} mm`);
  return summary;
}

try {
  await physics.init();
  for(let axis=0;axis<6;axis++)for(const sign of [-1,1]){
    const translationMm=[0,0,0],rotationDeg=[0,0,0];if(axis<3)translationMm[axis]=sign*5;else rotationDeg[axis-3]=sign*2;
    await run(`${['X','Y','Z','roll','pitch','yaw'][axis]}${sign<0?'-':'+'}`,{translationMm,rotationDeg});
  }
  const combined={translationMm:[4,-3,4],rotationDeg:[1.5,-1,2]};
  const reference=await run('combined',combined);
  const partitioned=await run('combined-render-partitions',combined,{partition:[7,24,3,41,9]});
  assert.deepEqual(partitioned.finalTransforms,reference.finalTransforms,'render-message partitions preserve exact fixed-step result');
  await run('combined-120Hz',combined,{timeStepMs:1000/120});
  await run('workspace-corner',{translationMm:[-5,-5,-5],rotationDeg:[2,-2,2]});
  for(const invalid of [
    {stewartMotion:{kind:'six-axis',target:{translationMm:[6,0,0],rotationDeg:[0,0,0]},moveDurationMs:4000,settleDurationMs:2000}},
    {stewartMotion:{kind:'six-axis',target:combined,moveDurationMs:1000,settleDurationMs:2000}},
    {stewartMotion:{kind:'six-axis',target:combined,moveDurationMs:4000,settleDurationMs:2000},gravity:[0,0,-9810]},
  ]){const result=await physics.buildWorld({parts,mates:fixture.mates,gravity:[0,0,0],timeStepMs:1000/60,...invalid});assert.equal(result.ok,false);assert.deepEqual((await physics.step()).transforms,[]);}
  report.invalidWorldsRejected=3;
  report.passed=report.failures.length===0;
} catch(error) {report.passed=false;report.failures.push(error.message);}
finally {await worker.terminate();}
const reportPath='docs/stewart-controller-results.json';writeFileSync(new URL(reportPath,root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,failures:report.failures,report:reportPath},null,2));
if(!report.passed)process.exitCode=1;
