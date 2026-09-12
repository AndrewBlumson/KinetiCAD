import test from 'node:test';
import assert from 'node:assert/strict';
import { readFourBarSample } from '../src/mechanisms/fourBarReadout.ts';
import { independentFourBarParams as base, independentFourBar, independentFourBarPoses } from './helpers/four-bar-reference.mjs';
const design=params=>({kind:'four-bar-path',version:1,params,targetPathMm:[[-30,-20],[30,-20],[30,20],[-30,20],[-30,-20]],search:{algorithmVersion:1,seed:42}});
const bodies=rpm=>[{partId:'four-bar-crank',angularVelocityRadPerSec:[0,0,rpm*Math.PI/30]}];

test('four-bar readout transforms the actual material point under both branches, placement and motor directions',()=>{
  for(const branch of [1,-1]) for(const rpm of [10,-10]) {
    const p={...base,branch,rpm,originMm:[53,-91],rotationDeg:123},t=1.731,theta=t*rpm*Math.PI/30;
    const sample=readFourBarSample(design(p),t*1000,independentFourBarPoses(p,theta),bodies(rpm));
    assert(sample); assert(Math.hypot(...sample.positionMm.map((v,i)=>v-independentFourBar(p,theta).P[i]))<1e-10);
    assert(sample.positionErrorMm<1e-10);assert(sample.nominalPositionErrorMm<1e-10);assert(sample.maxJointClosureMm<1e-10);
    assert.equal(sample.heightErrorMm,0);assert(Math.abs(sample.crankRpm-rpm)<1e-12);
  }
});

test('perturbed solver coordinates remain visible and cannot be replaced by predicted positions',()=>{
  const p={...base},theta=.6,poses=independentFourBarPoses(p,theta),original=structuredClone(poses);
  poses[2].positionMm[0]+=2;poses[2].positionMm[1]-=3;poses[2].positionMm[2]+=4;
  const sample=readFourBarSample(design(p),theta/(p.rpm*Math.PI/30)*1000,poses,bodies(10));
  assert(sample);assert(Math.abs(sample.positionErrorMm-Math.sqrt(29))<1e-10);
  assert(Math.abs(sample.maxJointClosureMm-Math.sqrt(29))<1e-10);assert.equal(sample.heightErrorMm,4);
  const ref=independentFourBar(p,theta).P;
  assert(Math.abs(sample.positionMm[0]-ref[0]-2)<1e-10); assert.notDeepEqual(poses,original);
});

test('measured-angle reference and nominal motor schedule disclose phase lag separately',()=>{
  const theta=.5,sample=readFourBarSample(design(base),2000,independentFourBarPoses(base,theta),bodies(9));
  assert(sample);assert(sample.positionErrorMm<1e-10);assert(sample.nominalPositionErrorMm>10);
  assert.equal(sample.crankRpm,9);assert(Math.abs(sample.crankAngleDeg-theta*180/Math.PI)<1e-10);
});

test('missing, duplicate, nonfinite or invalid poses yield no invented path sample',()=>{
  const poses=independentFourBarPoses(base,.4);
  for(const bad of [[],poses.slice(1),[...poses,poses[1]],poses.map((p,i)=>i===2?{...p,positionMm:[NaN,0,0]}:p),poses.map((p,i)=>i===1?{...p,rotationQuat:[0,0,0,0]}:p)]) {
    assert.equal(readFourBarSample(design(base),100,bad,bodies(10)),undefined);
  }
  for(const time of [-1,NaN,Infinity]) assert.equal(readFourBarSample(design(base),time,poses,bodies(10)),undefined);
  const sample=readFourBarSample(design(base),100,poses,[]);assert(sample);assert.equal(sample.crankRpm,undefined);
  assert.equal(readFourBarSample(design(base),100,poses,bodies(NaN)).crankRpm,undefined);
});

test('normalizing valid quaternion scale/sign preserves measured points without mutating snapshots',()=>{
  const poses=independentFourBarPoses(base,.83).map(p=>({...p,rotationQuat:p.rotationQuat.map(v=>-3*v)})),copy=structuredClone(poses);
  const sample=readFourBarSample(design(base),100,poses,bodies(10));assert(sample);assert(sample.positionErrorMm<1e-10);
  assert.deepEqual(poses,copy);
});
