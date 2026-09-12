// Metadata only: importing this module does not load or execute OpenCascade.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const root = new URL('../../', import.meta.url);
export const geometryReportPath = new URL('docs/demo-geometry-results.json', root);
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const read = path => fs.readFileSync(new URL(path, root));
export function geometrySourceSnapshot() {
  const paths = ['scripts/src/verify-demo-geometry.mjs',
    ...['sketchToWire', 'extrude', 'revolve', 'boolean', 'massProperties', 'tessellate'].map(name => `artifacts/kineticad/src/cad/operations/${name}.ts`),
    'artifacts/kineticad/src/cad/materials.ts'];
  return Object.fromEntries(paths.map(path => [path, sha256(read(path))]));
}

export function measuredGeometryPayload(report) {
  return Object.fromEntries(['description','overlapToleranceMm3','fixtureSha256','solids','gimbal','mobile'].map(key => [key, report[key]]));
}

/** Preserve measured provenance when refreshing links; never stamp current
 * source hashes onto a previous numerical run. Separate reports keep their own
 * measured revisions and dates, even when refreshed after an unrelated edit. */
export function completeGeometryReport(report, {generatedAt, provenance} = {}) {
  const payload = measuredGeometryPayload(report);
  for (const [id, hash] of Object.entries(payload.fixtureSha256)) {
    assert.equal(sha256(read(`artifacts/kineticad/public/demos/${id}.json`)), hash, `Geometry report has a stale ${id} fixture; rerun OCCT.`);
  }
  const records = payload.solids;
  assert(records.every(row => row.valid && row.volumeMm3 > 0), 'Cannot summarize invalid geometry as passing.');
  const newRecords = records.filter(row => !['windmill','orrery'].includes(row.demo));
  assert(newRecords.every(row => row.solids === 1), 'A new demo contains disconnected solids.');
  const output = {...payload, schemaVersion: 2,
    generatedAt: generatedAt ?? report.generatedAt,
    provenance: {...(provenance ?? report.provenance),
      measurementPayloadSha256: sha256(JSON.stringify(payload, null, 2)+'\n'),
      relatedReportsRefreshedAt: new Date().toISOString(),
      relatedReports: {}},
    summary: {
      fixtureCount: Object.keys(payload.fixtureSha256).length,
      partCount: records.length,
      validPartCount: records.filter(row => row.valid).length,
      singleSolidPartCount: records.filter(row => row.solids === 1).length,
      newDemoSingleSolidPartCount: newRecords.length,
      preservedLegacyCompounds: records.filter(row => row.solids > 1).map(row => ({demo:row.demo,part:row.part,solidCount:row.solids})),
    },
    passed: true,
  };
  assert(output.generatedAt && output.provenance.measurementSource, 'Original run date/source provenance is required; do not infer a fresh measurement.');
  for (const [key,path,id] of [
    ['material','docs/material-clearance-results.json','material-studio'],
    ['stewartClearance','docs/stewart-clearance-results.json','stewart-platform'],
    ['stewartWorkspace','docs/stewart-workspace-results.json','stewart-platform'],
  ]) {
    if (!payload.fixtureSha256[id]) continue;
    let bytes;
    try { bytes=read(path); } catch { output.provenance.relatedReports[key]={report:path,status:'not available; run its separate verifier'}; continue; }
    const related=JSON.parse(bytes);
    const link={report:path,reportSha256:sha256(bytes),generatedAt:related.generatedAt,fixtureSha256:related.fixtureSha256,
      status:related.passed && related.fixtureSha256===payload.fixtureSha256[id] ? 'passing report for identical fixture bytes' : 'not a passing report for this fixture',
      scope:related.method};
    output.provenance.relatedReports[key]=link;
    if (!related.passed || related.fixtureSha256!==payload.fixtureSha256[id]) continue;
    const summary={poses:related.poses?.length ?? related.exactSpots?.length,
      pairChecks:related.totalPairChecks ?? related.exactSpots?.reduce((n,p)=>n+p.checks.length,0),
      maxIntersectionMm3:related.maxIntersectionVolumeMm3 ?? Math.max(0,...(related.exactSpots ?? []).flatMap(p=>p.checks.map(c=>c.intersectionVolumeMm3))),
      sourceReport:path,sourceReportSha256:link.reportSha256};
    if (key==='material') output.material={...summary,minimumSampleLaneSeparationMm:related.minimumSampleLaneSeparationMm};
    if (key==='stewartClearance') output.stewart={...summary,limitations:related.limitations};
    if (key==='stewartWorkspace') output.stewartWorkspace={...summary,limitations:related.limitations};
  }
  return output;
}
