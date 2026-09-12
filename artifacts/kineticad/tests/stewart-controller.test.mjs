import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveStewartGeometry, validateStewartMotionConfig, validateStewartTrajectory,
  stewartDesiredPose, stewartInverseKinematics, stewartQuaternion, stewartEulerDeg,
  stewartOrientationErrorDeg, stewartJacobianCondition } from '../src/physics/stewartKinematics.ts';

const fixture=JSON.parse(readFileSync(new URL('../public/demos/stewart-platform.json',import.meta.url))).state;
const parts=fixture.assembly.parts.map(p=>({...p,isGround:p.id===fixture.assembly.groundPartId}));
const geometry=deriveStewartGeometry(parts,fixture.assembly.mates);
const config=(translationMm=[0,0,0],rotationDeg=[0,0,0],moveDurationMs=4000)=>({kind:'six-axis',target:{translationMm,rotationDeg},moveDurationMs,settleDurationMs:2000});
const close=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b} ± ${t}`);
// Independent scalar Rx·Ry·Rz multiplication, not the controller's quaternion math.
function rotate([x,y,z],[rx,ry,rz]) {
  const [a,b,c]=[rx,ry,rz].map(v=>v*Math.PI/180);
  const xx=Math.cos(c)*x-Math.sin(c)*y,yy=Math.sin(c)*x+Math.cos(c)*y;
  const xxx=Math.cos(b)*xx+Math.sin(b)*z,zz=-Math.sin(b)*xx+Math.cos(b)*z;
  return [xxx,Math.cos(a)*yy-Math.sin(a)*zz,Math.sin(a)*yy+Math.cos(a)*zz];
}

test('six-axis IK agrees with independently transformed anchors for both directions of every axis',()=>{
  for(let axis=0;axis<6;axis++)for(const sign of [-1,1]){
    const t=[0,0,0],r=[0,0,0];if(axis<3)t[axis]=sign*5;else r[axis-3]=sign*2;
    const c=config(t,r),pose=stewartDesiredPose(geometry,c,4000),ik=stewartInverseKinematics(geometry,pose);
    validateStewartTrajectory(geometry,c);
    geometry.legs.forEach((leg,i)=>{
      const point=rotate(leg.deckAnchorLocal,r).map((v,j)=>v+t[j]+geometry.home.positionMm[j]);
      close(ik.legs[i].lengthMm,Math.hypot(...point.map((v,j)=>v-leg.baseAnchor[j])));
    });
    stewartEulerDeg(pose.rotationQuat).forEach((v,i)=>close(v,r[i]));
  }
});

test('all 64 simultaneous translation/rotation workspace corners satisfy stroke, speed and singularity guards',()=>{
  for(let bits=0;bits<64;bits++){
    const values=Array.from({length:6},(_,i)=>((bits>>i)&1?1:-1)*(i<3?5:2));
    validateStewartTrajectory(geometry,config(values.slice(0,3),values.slice(3)));
  }
});

test('quintic trajectory starts and ends at rest and holds its final requested pose',()=>{
  const c=config([4,-3,4],[1.5,-1,2]);
  const start=stewartDesiredPose(geometry,c,0),end=stewartDesiredPose(geometry,c,4000);
  start.positionMm.forEach((v,i)=>close(v,geometry.home.positionMm[i]));
  close(stewartOrientationErrorDeg(start.rotationQuat,geometry.home.rotationQuat),0);
  assert.deepEqual(end,stewartDesiredPose(geometry,c,6000));
  const epsilon=1e-2;
  for(const time of [0,4000-epsilon]){
    const a=stewartDesiredPose(geometry,c,time),b=stewartDesiredPose(geometry,c,time+epsilon);
    assert(Math.hypot(...b.positionMm.map((v,i)=>v-a.positionMm[i]))<1e-9);
    assert(stewartOrientationErrorDeg(a.rotationQuat,b.rotationQuat)<1e-9);
  }
});

test('invalid values, speed requests, altered frames and altered anchors reject explicitly',()=>{
  for(const c of [config([6,0,0]),config([0,0,0],[0,3,0]),config([NaN,0,0]),{...config(),settleDurationMs:0}])assert.throws(()=>validateStewartMotionConfig(c),/Stewart controller/);
  assert.throws(()=>validateStewartTrajectory(geometry,config([5,5,5],[2,2,2],1000)),/speed|duration|mm\/s/);
  const changed=structuredClone(parts);changed[2].transform.rotationDeg[0]+=1;
  assert.throws(()=>deriveStewartGeometry(changed,fixture.assembly.mates),/frames|anchors/);
  const mates=structuredClone(fixture.assembly.mates);mates[0].pivotA.localPoint[0]+=1;
  assert.throws(()=>deriveStewartGeometry(parts,mates),/anchor edits/);
});

test('dimensionless Jacobian guard detects a collapsed singular geometry',()=>{
  close(stewartJacobianCondition(Array.from({length:6},(_,i)=>Array.from({length:6},(_,j)=>Number(i===j)))),1);
  assert.equal(stewartJacobianCondition(Array.from({length:6},()=>[1,0,0,0,0,0])),Infinity);
  const g=structuredClone(geometry);g.legs.forEach(l=>{l.baseAnchor=[0,0,0];l.deckAnchorLocal=[0,0,0];});
  assert.throws(()=>validateStewartTrajectory(g,config()),/singular/);
});

test('orientation error measures tiny and sign-equivalent quaternions without acos cancellation',()=>{
  close(stewartOrientationErrorDeg([0,0,0,1],stewartQuaternion([0,0,0.00001])),0.00001,1e-12);
  const q=stewartQuaternion([1,2,-1]);close(stewartOrientationErrorDeg(q,q.map(v=>-v)),0);
});
