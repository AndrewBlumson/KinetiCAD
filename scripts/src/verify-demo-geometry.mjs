// Real OCCT B-rep checks using the same feature operations as the CAD worker.
// Run from the repository root:
// node --import ./scripts/node_modules/tsx/dist/loader.mjs scripts/src/verify-demo-geometry.mjs
// Add --export-descriptors to export the actual CAD meshes and mass properties
// to /tmp/kineticad-demo-descriptors.json for the physics worker tests (macOS/Linux).
// Add --descriptors-only to skip repeating the interference sweeps during export.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import factory from '../../artifacts/kineticad/node_modules/opencascade.js/dist/node.js';
import { sketchToWire } from '../../artifacts/kineticad/src/cad/operations/sketchToWire.ts';
import { extrude } from '../../artifacts/kineticad/src/cad/operations/extrude.ts';
import { revolve } from '../../artifacts/kineticad/src/cad/operations/revolve.ts';
import { applyBoolean } from '../../artifacts/kineticad/src/cad/operations/boolean.ts';
import { computeMassProperties } from '../../artifacts/kineticad/src/cad/operations/massProperties.ts';
import { tessellateShape } from '../../artifacts/kineticad/src/cad/operations/tessellate.ts';
import { getMaterial } from '../../artifacts/kineticad/src/cad/materials.ts';

export async function loadGeometryKernel() { return factory(); }

export function rebuildPart(oc, part) {
  let current;
  try {
    for (const feature of part.features) {
      assert(['extrude', 'revolve'].includes(feature.type), `Unsupported fixture feature ${feature.type}`);
      const sketch = part.sketches.find((s) => s.id === feature.sketchId);
      assert(sketch, `${part.id}: missing sketch`);
      const wire = sketchToWire(oc, sketch.plane, sketch.primitives);
      let solid;
      try {
        solid = feature.type === 'extrude'
          ? extrude(oc, wire, sketch.plane, feature.depthMm, feature.direction)
          : revolve(oc, wire, feature.axis, feature.angleDeg);
      } finally { wire.delete(); }
      const mode = feature.type === 'extrude' ? (feature.extrudeMode ?? 'add') : 'new-body';
      if (current && (mode === 'add' || mode === 'subtract')) {
        let combined;
        try {
          combined = applyBoolean(oc, [current, solid], mode === 'add' ? {type:'union'} : {type:'subtract', toolPartId:''});
        } finally { solid.delete(); }
        current.delete();
        current = combined;
      } else {
        current?.delete();
        current = solid;
      }
    }
    return current;
  } catch (error) { current?.delete(); throw error; }
}

export function volume(oc, shape) {
  const props = new oc.GProp_GProps_1();
  try { oc.BRepGProp.VolumeProperties_1(shape, props, 1e-7, true, false); return props.Mass(); }
  finally { props.delete(); }
}

export function validateSolid(oc, shape) {
  const analyzer = new oc.BRepCheck_Analyzer(shape, true, false);
  const explorer = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_SOLID, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  try {
    let count = 0;
    for (; explorer.More(); explorer.Next()) count++;
    return {valid:analyzer.IsValid_2(), solids:count, volumeMm3:volume(oc, shape)};
  } finally { analyzer.delete(); explorer.delete(); }
}

const multiply = (a,b) => Array.from({length:9},(_,n)=> {
  const row=Math.floor(n/3), col=n%3;
  return a[row*3]*b[col]+a[row*3+1]*b[col+3]+a[row*3+2]*b[col+6];
});
const rx=(v)=>[1,0,0,0,Math.cos(v),-Math.sin(v),0,Math.sin(v),Math.cos(v)];
const ry=(v)=>[Math.cos(v),0,Math.sin(v),0,1,0,-Math.sin(v),0,Math.cos(v)];
const rz=(v)=>[Math.cos(v),-Math.sin(v),0,Math.sin(v),Math.cos(v),0,0,0,1];

export function transformed(oc, shape, matrix, position) {
  const trsf = new oc.gp_Trsf_1();
  let builder;
  try {
    trsf.SetValues(...matrix.slice(0,3),position[0], ...matrix.slice(3,6),position[1], ...matrix.slice(6,9),position[2]);
    builder = new oc.BRepBuilderAPI_Transform_2(shape, trsf, true);
    assert(builder.IsDone());
    return builder.Shape();
  } finally { builder?.delete(); trsf.delete(); }
}

export function intersectionVolume(oc, a, b) {
  const progress = new oc.Message_ProgressRange_1();
  let common, shape;
  try {
    common = new oc.BRepAlgoAPI_Common_3(a, b, progress);
    assert(common.IsDone(), 'Intersection operation failed');
    shape = common.Shape();
    return Math.abs(volume(oc, shape));
  } finally { shape?.delete(); common?.delete(); progress.delete(); }
}

async function main() {
  const available=['windmill','orrery','gyroscope','kinetic-mobile','material-studio'];
  const options=process.argv.slice(2);
  const exportDescriptors=options.includes('--export-descriptors');
  const descriptorsOnly=options.includes('--descriptors-only');
  assert(!descriptorsOnly || exportDescriptors, '--descriptors-only requires --export-descriptors');
  const selected=options.filter(value=>!['--export-descriptors','--descriptors-only'].includes(value));
  assert(selected.every(id=>available.includes(id)), 'Pass only known demo IDs, or no arguments to check all demos');
  const descriptors={schemaVersion:1,fixtures:{}};
  const oc=await loadGeometryKernel();
  const report={
    description:'Actual generated B-rep validation and sampled geometric interference; this does not validate contact dynamics.',
    overlapToleranceMm3:1e-5,
    fixtureSha256:{},
    solids:[],
    gimbal:{poses:0,pairChecks:0,maxIntersectionMm3:0,voidProbes:[]},
    mobile:{poses:0,pairChecks:0,maxIntersectionMm3:0},
  };
  for (const id of selected.length ? selected : available) {
    const fixtureText=fs.readFileSync(new URL(`../../artifacts/kineticad/public/demos/${id}.json`,import.meta.url),'utf8');
    report.fixtureSha256[id]=createHash('sha256').update(fixtureText).digest('hex');
    const {state:{assembly}}=JSON.parse(fixtureText);
    const fixtureState=JSON.parse(fixtureText).state;
    if(exportDescriptors) descriptors.fixtures[id]={
      fixturePath:`artifacts/kineticad/public/demos/${id}.json`,
      fixtureSha256:report.fixtureSha256[id],
      parts:[],mates:assembly.mates,
      gravity:fixtureState.simulation.gravity,timeStepMs:fixtureState.simulation.timeStepMs,
    };
    const shapes=[];
    try {
      for (const part of assembly.parts) {
        const shape=rebuildPart(oc,part);
        shapes.push(shape);
        const result=validateSolid(oc,shape);
        console.log(JSON.stringify({demo:id,part:part.id,...result}));
        assert(result.valid && result.volumeMm3>0, `${id}/${part.id} invalid or empty`);
        // Legacy seeds are preserved byte-for-byte; new rigid parts must be connected solids.
        if (!['windmill','orrery'].includes(id)) assert.equal(result.solids,1, `${id}/${part.id} contains disconnected solids`);
        report.solids.push({demo:id,part:part.id,...result});
        if(exportDescriptors) {
          const props=computeMassProperties(oc,shape,getMaterial(part.materialId).densityGcm3);
          const mesh=tessellateShape(oc,shape);
          assert(mesh.positions.length>0 && mesh.indices.length>0, `${id}/${part.id} has no simulation mesh`);
          descriptors.fixtures[id].parts.push({
            id:part.id,transform:part.transform,
            meshPositions:Array.from(mesh.positions),meshIndices:Array.from(mesh.indices),
            massKg:props.massKg,comLocal:props.comLocal,
            principalInertiaKgMm2:props.principalInertiaKgMm2,
            principalInertiaLocalFrame:props.principalInertiaLocalFrame,
            isGround:part.id===assembly.groundPartId,
          });
        }
      }
      if (id==='gyroscope' && !descriptorsOnly) {
        // The narrow 3.01 mm cutters previously returned IsDone while leaving
        // almost the entire 3 mm stock in place. Probe the intended voids
        // independently of how the other moving parts happen to be posed.
        for (const [partIndex,plane,depthMm] of [[1,'XY',100],[2,'YZ',80]]) {
          const wire=sketchToWire(oc,plane,[{type:'circle',centre:[0,0],radius:2.9}]);
          let probe;
          try {
            probe=extrude(oc,wire,plane,depthMm,'symmetric');
            const overlap=intersectionVolume(oc,shapes[partIndex],probe);
            report.gimbal.voidProbes.push({part:assembly.parts[partIndex].id,radiusMm:2.9,lengthMm:depthMm,intersectionMm3:overlap});
            assert(overlap<1e-5, `${assembly.parts[partIndex].id} retains stock in its intended central void: ${overlap} mm3`);
          } finally { probe?.delete(); wire.delete(); }
        }
        // Deterministic off-axis poses spanning several turns. This is a sampled
        // interference regression, not a mathematical proof for every orientation.
        const poses=Array.from({length:16},(_,n)=>[n*23,n*37,n*61]);
        for (const angles of poses) {
          const [yaw,roll,spin]=angles.map(d=>d*Math.PI/180);
          const outer=rz(yaw), middle=multiply(outer,rx(roll)), rotor=multiply(middle,ry(spin));
          const placed=shapes.map((shape,i)=>transformed(oc,shape,[rx(0),outer,middle,rotor][i],i===0?[0,0,0]:[0,0,110]));
          try {
            for (let a=0;a<4;a++) for (let b=a+1;b<4;b++) {
              const overlap=intersectionVolume(oc,placed[a],placed[b]);
              report.gimbal.pairChecks++;
              report.gimbal.maxIntersectionMm3=Math.max(report.gimbal.maxIntersectionMm3,overlap);
              assert(overlap<1e-5, `Gimbal overlap ${assembly.parts[a].id}/${assembly.parts[b].id} at ${angles}: ${overlap} mm3`);
            }
            report.gimbal.poses++;
          } finally { placed.forEach(s=>s.delete()); }
        }
      }
      if (id==='kinetic-mobile' && !descriptorsOnly) {
        const placed=shapes.map((shape,i)=>{
          const [x,y,z]=assembly.parts[i].transform.rotationDeg.map(d=>d*Math.PI/180);
          return transformed(oc,shape,multiply(multiply(rx(x),ry(y)),rz(z)),assembly.parts[i].transform.positionMm);
        });
        try {
          for(let a=0;a<placed.length;a++) for(let b=a+1;b<placed.length;b++) {
            const overlap=intersectionVolume(oc,placed[a],placed[b]);
            report.mobile.pairChecks++;
            report.mobile.maxIntersectionMm3=Math.max(report.mobile.maxIntersectionMm3,overlap);
            assert(overlap<1e-5, `Mobile initial overlap ${assembly.parts[a].id}/${assembly.parts[b].id}: ${overlap} mm3`);
          }
          report.mobile.poses=1;
        } finally { placed.forEach(s=>s.delete()); }
      }
    } finally { shapes.forEach(s=>s.delete()); }
  }
  if (!selected.length && !descriptorsOnly) {
    fs.mkdirSync(new URL('../../docs/',import.meta.url),{recursive:true});
    fs.writeFileSync(new URL('../../docs/demo-geometry-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  }
  if(exportDescriptors) {
    fs.writeFileSync('/tmp/kineticad-demo-descriptors.json',JSON.stringify(descriptors));
    console.log('DEMO_DESCRIPTORS_WRITTEN /tmp/kineticad-demo-descriptors.json');
  }
  console.log('DEMO_GEOMETRY_RESULT '+JSON.stringify(report));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url) {
  try { await main(); }
  catch (error) { console.error('DEMO_GEOMETRY_FAILED '+(error instanceof Error ? error.message : String(error))); process.exitCode=1; }
}
