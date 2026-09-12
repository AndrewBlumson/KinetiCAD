import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import * as Comlink from 'comlink';
import nodeEndpoint from 'comlink/dist/esm/node-adapter.mjs';
import { Vector3, Quaternion } from 'three';
import { loadFourBarCad, fourBarCadCases, fourBarCadSourceSha256 } from './helpers/four-bar-cad.mjs';
import { independentFourBar } from './helpers/four-bar-reference.mjs';
import { FOUR_BAR_IDS as ids } from '../src/mechanisms/fourBarAssembly.ts';
import { FOUR_BAR_SOLVER_SETTINGS } from '../src/mechanisms/fourBarSolver.ts';
const sha=path=>createHash('sha256').update(readFileSync(new URL(path,import.meta.url))).digest('hex');
const point=(pose,local)=>new Vector3(...local).applyQuaternion(new Quaternion(...pose.rotationQuat).normalize()).add(new Vector3(...pose.positionMm));

test('actual CAD four-bar follows independent coupler geometry through complete forward/reverse cycles and both branches',async()=>{
  const worker=new Worker(new URL('./helpers/physics-worker-node.mjs',import.meta.url),{execArgv:[]}),physics=Comlink.wrap(nodeEndpoint(worker));
  const thresholds={positionAtMeasuredAngleMm:.05,nominalPositionMm:.1,jointClosureMm:.05,motorSpeedRadPerSec:.005,outOfPlaneTiltRad:1e-5,heightErrorMm:.01,groundDriftMm:1e-7,initialPlacementMm:1e-4};
  const report={schemaVersion:1,generatedAt:new Date().toISOString(),sourceSha256:fourBarCadSourceSha256,
    physicsWorkerSha256:sha('../src/physics/physicsWorker.ts'),solverProfileSha256:sha('../src/mechanisms/fourBarSolver.ts'),
    thresholds,solverSettings:FOUR_BAR_SOLVER_SETTINGS,measurement:'Every fixed solver step for position, height and closure, including startup. Motor speed after 0.25s startup. Partition case records batch endpoints and exact final equality. Reference is independent cosine-law test code; no measured positions are synthesized from that reference.',
    scope:'120Hz ideal-motor, zero-gravity, no-contact factory mechanisms; 240Hz is a convergence diagnostic. Exact OCCT mass and inertia from all actual solid parts. No tracer velocity/acceleration or finite motor strength claim.',cases:[],failures:[]};
  const scenarios=fourBarCadCases.flatMap((p,i)=>[1,-1].flatMap(branch=>[10,-10].map(rpm=>({p:{...p,branch,rpm},name:`geometry-${i}/branch-${branch}/rpm-${rpm}`,dt:1000/120}))));
  scenarios.push({p:fourBarCadCases[0],name:'default-240Hz',dt:1000/240},{p:fourBarCadCases[0],name:'render-partitions',dt:1000/120,partition:[5,21,13,2,31]});
  scenarios.push(...[1,-1].flatMap(branch=>[10,-10].map(rpm=>({p:{...fourBarCadCases[2],branch,rpm},name:`near-toggle-240Hz/branch-${branch}/rpm-${rpm}`,dt:1000/240}))));
  try{
    await physics.init();
    for(const{name,p,dt,partition}of scenarios){
      const cad=await loadFourBarCad(p),parts=cad.descriptors.map(part=>({...part,meshPositions:new Float32Array(part.meshPositions),meshIndices:new Uint32Array(part.meshIndices)}));
      const built=await physics.buildWorld({parts,mates:cad.assembly.mates,gravity:[0,0,0],timeStepMs:dt,durationMs:6000,measurementPartIds:[ids.crank],solverSettings:FOUR_BAR_SOLVER_SETTINGS});
      assert.equal(built.ok,true,JSON.stringify(built));assert.equal(built.bodyCount,4);assert.equal(built.jointCount,4);
      const result={name,params:p,timeStepMs:dt,solverSteps:0,solids:cad.solids,metrics:Object.fromEntries(Object.keys(thresholds).map(key=>[key,0]))};
      const initial=(await physics.step(0)).transforms,initialGround=initial.find(pose=>pose.partId===ids.ground).positionMm;
      result.metrics.initialPlacementMm=Math.max(...initial.map(pose=>new Vector3(...pose.positionMm).distanceTo(new Vector3(...parts.find(part=>part.id===pose.partId).transform.positionMm))));
      let final,t=0;
      for(let i=0;t<6-1e-9;i++){
        assert(i<10000,'bounded schedule completes');const step=await physics.step(partition?partition[i%partition.length]:dt);final=step;
        result.solverSteps+=Math.round(step.dtMs/dt);if(step.dtMs===0)continue;t=step.simulatedTimeMs/1000;
        const poses=new Map(step.transforms.map(pose=>[pose.partId,pose])),crank=poses.get(ids.crank),q=new Quaternion(...crank.rotationQuat).normalize();
        const measuredAngle=Math.atan2(2*(q.w*q.z+q.x*q.y),1-2*(q.y*q.y+q.z*q.z))-p.rotationDeg*Math.PI/180;
        const expected=independentFourBar(p,measuredAngle),nominal=independentFourBar(p,p.rpm*Math.PI/30*t),trace=point(poses.get(ids.coupler),[...p.couplerPointLocalMm,3]);
        const record=(key,error)=>{assert(Number.isFinite(error),`${name}: nonfinite${key}`);result.metrics[key]=Math.max(result.metrics[key],Math.abs(error));};
        record('positionAtMeasuredAngleMm',trace.distanceTo(new Vector3(...expected.P)));record('nominalPositionMm',trace.distanceTo(new Vector3(...nominal.P)));
        record('heightErrorMm',trace.z-54);record('groundDriftMm',point(poses.get(ids.ground),[0,0,0]).distanceTo(new Vector3(...initialGround)));
        for(const pose of poses.values())record('outOfPlaneTiltRad',2*Math.asin(Math.min(1,Math.hypot(...pose.rotationQuat.slice(0,2))/Math.hypot(...pose.rotationQuat))));
        for(const mate of cad.assembly.mates)record('jointClosureMm',point(poses.get(mate.partA),mate.pivotA.localPoint).distanceTo(point(poses.get(mate.partB),mate.pivotB.localPoint)));
        if(t>.25)record('motorSpeedRadPerSec',step.bodyMeasurements.find(b=>b.partId===ids.crank).angularVelocityRadPerSec[2]-p.rpm*Math.PI/30);
      }
      assert.equal(final.completed,true);assert(Math.abs(final.simulatedTimeMs-6000)<1e-7);assert.deepEqual(final.solverSettings,FOUR_BAR_SOLVER_SETTINGS);assert.equal((await physics.step(1000)).dtMs,0);
      result.finalTransforms=final.transforms;
      if(partition)assert.deepEqual(final.transforms,report.cases[0].finalTransforms,'packet partitions preserve exact final state');
      for(const[key,limit]of Object.entries(thresholds))if(result.metrics[key]>limit)report.failures.push(`${name}/${key}: ${result.metrics[key]} > ${limit}`);
      report.cases.push(result);console.log(JSON.stringify({name,metrics:result.metrics}));
    }
  }finally{await worker.terminate();}
  for(const branch of [1,-1])for(const rpm of [10,-10]){
    const coarse=report.cases.find(c=>c.name===`geometry-2/branch-${branch}/rpm-${rpm}`),fine=report.cases.find(c=>c.name===`near-toggle-240Hz/branch-${branch}/rpm-${rpm}`);
    assert(fine.metrics.nominalPositionMm<coarse.metrics.nominalPositionMm*.8,'halving the timestep reduces near-toggle nominal path error by at least20%');
  }
  report.passed=report.failures.length===0;writeFileSync(join(tmpdir(),'kineticad-four-bar-physics-results.json'),JSON.stringify(report,null,2)+'\n');assert.deepEqual(report.failures,[]);
});
