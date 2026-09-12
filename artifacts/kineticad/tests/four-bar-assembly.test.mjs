import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFourBarAssembly, fourBarAssemblyClearances, FOUR_BAR_IDS as ids, FOUR_BAR_GEOMETRY as g } from '../src/mechanisms/fourBarAssembly.ts';
import { independentFourBarParams as base, independentFourBarPoses } from './helpers/four-bar-reference.mjs';
import { Vector3, Quaternion } from 'three';

const world = (pose, point) => new Vector3(...point).applyQuaternion(new Quaternion(...pose.rotationQuat)).add(new Vector3(...pose.positionMm));
test('native four-bar factory creates four connected-history bodies and only one driven revolute', () => {
  const assembly = buildFourBarAssembly(base);
  assert.equal(assembly.parts.length, 4); assert.equal(assembly.mates.length, 4);
  assert.equal(assembly.groundPartId, ids.ground); assert.deepEqual(assembly.booleanFeatures, []);
  assert.deepEqual(assembly.mates.filter(m => m.motorSpeedRpm !== undefined).map(m => [m.id, m.motorSpeedRpm]), [[ids.drive, 10]]);
  for (const part of assembly.parts) {
    assert.equal(part.features[0].extrudeMode, 'new-body');
    assert(part.features.every(f => f.type === 'extrude' && f.depthMm > 0 && part.sketches.some(s => s.id === f.sketchId)));
    assert(part.features.slice(1).every(f => ['add', 'subtract'].includes(f.extrudeMode)));
  }
  assert(assembly.mates.every(m => m.type === 'revolute' && m.axisLocal.join(',') === '0,0,1'));
});

test('every local joint anchor agrees with independent closure in both branches and arbitrary placement', () => {
  for (const branch of [1,-1]) for (const initialCrankAngleDeg of [0,17,137,301]) {
    const p = {...base,branch,initialCrankAngleDeg,originMm:[123,-78],rotationDeg:73};
    const a = buildFourBarAssembly(p), poses = independentFourBarPoses(p,initialCrankAngleDeg*Math.PI/180);
    for (const part of a.parts) {
      const pose = poses.find(pose=>pose.partId===part.id);
      assert(new Vector3(...part.transform.positionMm).distanceTo(new Vector3(...pose.positionMm))<1e-10);
      const actual = new Quaternion().setFromAxisAngle(new Vector3(0,0,1),part.transform.rotationDeg[2]*Math.PI/180);
      assert(1-Math.abs(actual.dot(new Quaternion(...pose.rotationQuat)))<1e-12);
    }
    for (const mate of a.mates) assert(world(poses.find(p=>p.partId===mate.partA),mate.pivotA.localPoint).distanceTo(world(poses.find(p=>p.partId===mate.partB),mate.pivotB.localPoint))<1e-10);
  }
});

test('authored plate/pin envelopes match the continuous rigid-geometry clearance proof', () => {
  const a=buildFourBarAssembly(base), [ground,crank,coupler,rocker]=a.parts;
  const profile=(part,name)=>{const s=part.sketches.find(s=>s.name.startsWith(name));assert(s,name);return{p:s.primitives[0],f:part.features.find(f=>f.sketchId===s.id)};};
  assert.equal(profile(ground,'Input bearing pedestal').f.depthMm,24);
  assert.equal(profile(ground,'Output bearing pedestal').f.depthMm,36);
  for(const link of [crank,rocker]) {
    assert.equal(profile(link,'Spindle boss').p.radius,7); assert.equal(profile(link,'Coupler pin boss').p.radius,7);
    assert.equal(profile(link,'Rigid link strap').p.height,10); assert.equal(profile(link,'Spindle boss').f.depthMm,6);
    assert.equal(profile(link,'Main spindle').p.radius,4); assert.equal(profile(link,'Coupler pin ·').p.radius,3);
    assert.equal(link.transform.positionMm[2]-profile(link,'Main spindle').f.depthMm-g.bedThicknessMm,2);
  }
  assert.equal(coupler.transform.positionMm[2],51); assert.equal(profile(coupler,'Main coupling strap').f.depthMm,6);
  assert.equal(profile(coupler,'Pin bore').p.radius,3.5);
  assert.equal(profile(ground,'Input spindle bore').p.radius,4.5);
  const bounds=fourBarAssemblyClearances(base); assert(Object.values(bounds).every(v=>v>0));
  // The complete accepted domain has b≥35, μ≥20° and d−a≥22.
  assert(35*Math.sin(20*Math.PI/180)-7-3>1.97); assert.equal(22-7-9,6);
  assert.equal(bounds.spindleRadialMm,.5); assert.equal(bounds.pinRadialMm,.5);
  assert.equal(bounds.crankToRockerSlabMm,6); assert.equal(bounds.rockerToCouplerSlabMm,6);
});

test('near-zero tracing arms are omitted inside the existing solid; invalid geometry cannot be generated', () => {
  for(const point of [[45,0],[45+1e-10,1e-10]]) {
    const a=buildFourBarAssembly({...base,couplerPointLocalMm:point});
    assert(!a.parts[2].sketches.some(s=>s.name==='Connected tracing arm'));
    assert(a.parts[2].sketches.some(s=>s.name.startsWith('Tracing point boss')));
  }
  for(const patch of [{couplerPointLocalMm:[0,0]},{crankLengthMm:60},{groundLengthMm:NaN},{couplerLengthMm:20},{branch:0}]) assert.throws(()=>buildFourBarAssembly({...base,...patch}));
});
