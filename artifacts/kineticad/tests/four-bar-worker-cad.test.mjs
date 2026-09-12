import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { readFileSync,writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Comlink from 'comlink';
import nodeEndpoint from 'comlink/dist/esm/node-adapter.mjs';
import { buildFourBarAssembly } from '../src/mechanisms/fourBarAssembly.ts';
import { preflightFourBarDocument } from '../src/mechanisms/fourBarPreflight.ts';
import { regeneratePartTip } from '../src/features/featureRegen.ts';
import { getVolumeData,massPropertiesForMaterial } from '../src/features/volumeCache.ts';
import { getMaterial } from '../src/cad/materials.ts';
import { fourBarCadCases,loadFourBarCad,fourBarCadSourceSha256 } from './helpers/four-bar-cad.mjs';
const sha=path=>createHash('sha256').update(readFileSync(new URL(path,import.meta.url))).digest('hex');
const close=(a,b,t=1e-7)=>assert(Number.isFinite(a)&&Math.abs(a-b)<=t,`${a} != ${b} ±${t}`);
function analyticLinkVolume(length,originZ){
  // Circle/rectangle union area, with exact overlaps. Both end circles are
  // separated by ≥15mm while diameter14; shafts/pins overlap their plates3mm.
  const area=10*length+2*(49*Math.PI-5*Math.sqrt(24)-49*Math.asin(5/7));
  return area*6+16*Math.PI*(originZ-11)+9*Math.PI*(55-originZ);
}

test('shipped CAD worker preflight returns one solid per factory body and exact independently integrated bed/link volumes',async()=>{
  const worker=new Worker(new URL('./helpers/cad-worker-node.mjs',import.meta.url)),cad=Comlink.wrap(nodeEndpoint(worker));
  const report={schemaVersion:1,generatedAt:new Date().toISOString(),sourceSha256:fourBarCadSourceSha256,
    cadWorkerSha256:sha('../src/cad/cadWorker.ts'),preflightSha256:sha('../src/mechanisms/fourBarPreflight.ts'),
    scope:'Actual shipped full-history CAD worker and preflight for default and optimiser-winner geometry. Independent exact area/volume integration for bed, crank and rocker; coupler uses the separately rebuilt exact CAD reference. Physical mass and full principal inertia are compared to that reference.',
    volumeToleranceMm3:1e-7,massToleranceKg:1e-10,inertiaToleranceKgMm2:1e-7,cases:[]};
  try{
    await cad.init();
    for(const p of [fourBarCadCases[0],fourBarCadCases[6]]){
      const expected=await loadFourBarCad(p),assembly=buildFourBarAssembly(p),document={version:9,state:{assembly}};
      await preflightFourBarDocument(document,cad,()=>{});
      const result={params:p,parts:[]};
      for(let i=0;i<4;i++){
        const part=assembly.parts[i],tip=await regeneratePartTip(part,cad);assert.equal(tip.mesh.solidCount,1);assert(tip.mesh.positions.every(Number.isFinite));
        const volume=getVolumeData(tip.hash);assert(volume);const props=massPropertiesForMaterial(volume,getMaterial(part.materialId).densityGcm3),ref=expected.descriptors[i];
        close(props.massKg,ref.massKg,1e-10);for(let j=0;j<3;j++){close(props.comLocal[j],ref.comLocal[j]);close(props.principalInertiaKgMm2[j],ref.principalInertiaKgMm2[j]);}
        // Eigenvector sign is immaterial; the frame quaternion may negate.
        close(Math.abs(props.principalInertiaLocalFrame.reduce((sum,v,j)=>sum+v*ref.principalInertiaLocalFrame[j],0)),1,1e-8);
        const analytic=i===0?(p.groundLengthMm+p.crankLengthMm+32)*(2*p.crankLengthMm+40)*6+2523*Math.PI:i===1?analyticLinkVolume(p.crankLengthMm,30):i===3?analyticLinkVolume(p.rockerLengthMm,42):undefined;
        if(analytic!==undefined)close(volume.volumeMm3,analytic);
        result.parts.push({id:part.id,solidCount:tip.mesh.solidCount,volumeMm3:volume.volumeMm3,analyticVolumeMm3:analytic,absoluteVolumeErrorMm3:analytic===undefined?undefined:Math.abs(volume.volumeMm3-analytic),massKg:props.massKg});
      }
      report.cases.push(result);
    }
    const part=structuredClone(buildFourBarAssembly(fourBarCadCases[0]).parts[0]);
    part.sketches.push({id:'detached-sketch',name:'Disconnected block',plane:'XY',primitives:[{type:'rectangle',corner:[500,500],width:5,height:5}]});
    part.features.push({id:'detached-feature',type:'extrude',sketchId:'detached-sketch',depthMm:5,direction:'forward',extrudeMode:'add'});
    await assert.rejects(preflightFourBarDocument({version:9,state:{assembly:{parts:[part]}}},cad,()=>{}),/connected|single|one solid|exactly one/i);
    report.disconnectedNativeCandidateRejected=true;
  }finally{await worker.terminate();}
  report.passed=true;writeFileSync(join(tmpdir(),'kineticad-four-bar-worker-cad-results.json'),JSON.stringify(report,null,2)+'\n');
});
