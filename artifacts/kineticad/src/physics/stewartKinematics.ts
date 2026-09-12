/** Bounded pose planning for the bundled rigid-body Stewart mechanism.
 * Kinematics produces actuator targets, never poses assigned to simulated bodies.
 * Millimetres, seconds, intrinsic XYZ degrees; quaternions are [x,y,z,w]. */
import type { Mate } from '../state/schemas';
import type { PartDescriptor } from './types';

export type StewartVector = [number, number, number];
export type StewartQuaternion = [number, number, number, number];
export type StewartPoseTarget = { translationMm: StewartVector; rotationDeg: StewartVector };
export type StewartMotionConfig = {
  kind: 'six-axis';
  target: StewartPoseTarget;
  moveDurationMs: number;
  settleDurationMs: number;
};
export type StewartPose = { positionMm: StewartVector; rotationQuat: StewartQuaternion };
export const STEWART_CONTROL_LIMITS = Object.freeze({
  translationMm: 5,
  rotationDeg: 2,
  minStrokeMm: -12,
  maxStrokeMm: 20,
  maxActuatorVelocityMmPerSec: 8,
  maxBearingDeflectionDeg: 8,
  maxJacobianCondition: 100,
  positionToleranceMm: 0.05,
  orientationToleranceDeg: 0.05,
  legToleranceMm: 0.05,
});
export const STEWART_MOTION_PRESETS: ReadonlyArray<{ id: string; title: string; target: StewartPoseTarget }> = [
  { id: 'home', title: 'Home', target: { translationMm: [0, 0, 0], rotationDeg: [0, 0, 0] } },
  { id: 'surge', title: 'Slide X', target: { translationMm: [5, 0, 0], rotationDeg: [0, 0, 0] } },
  { id: 'sway', title: 'Slide Y', target: { translationMm: [0, 5, 0], rotationDeg: [0, 0, 0] } },
  { id: 'heave', title: 'Lift Z', target: { translationMm: [0, 0, 5], rotationDeg: [0, 0, 0] } },
  { id: 'roll', title: 'Roll', target: { translationMm: [0, 0, 0], rotationDeg: [2, 0, 0] } },
  { id: 'pitch', title: 'Pitch', target: { translationMm: [0, 0, 0], rotationDeg: [0, 2, 0] } },
  { id: 'yaw', title: 'Yaw', target: { translationMm: [0, 0, 0], rotationDeg: [0, 0, 2] } },
  { id: 'combined', title: 'Combined motion', target: { translationMm: [4, -3, 4], rotationDeg: [1.5, -1, 2] } },
];

const fail = (message: string): never => { throw new Error(`Stewart controller: ${message}`); };
const vector = (value: unknown, label: string): StewartVector => {
  if (!Array.isArray(value) || value.length !== 3 || value.some(v => typeof v !== 'number' || !Number.isFinite(v))) fail(`${label} must contain three finite numbers.`);
  return [...value as StewartVector];
};
export function validateStewartMotionConfig(value: unknown): StewartMotionConfig {
  if (!value || typeof value !== 'object') fail('motion configuration is missing.');
  const v = value as StewartMotionConfig;
  if (v.kind !== 'six-axis' || !v.target) fail('unsupported motion configuration.');
  const translationMm = vector(v.target.translationMm, 'Translation');
  const rotationDeg = vector(v.target.rotationDeg, 'Rotation');
  if (translationMm.some(v => Math.abs(v) > STEWART_CONTROL_LIMITS.translationMm)) fail('translation is outside the ±5 mm workspace.');
  if (rotationDeg.some(v => Math.abs(v) > STEWART_CONTROL_LIMITS.rotationDeg)) fail('rotation is outside the ±2° workspace.');
  if (!Number.isFinite(v.moveDurationMs) || v.moveDurationMs < 1000 || v.moveDurationMs > 30000) fail('move duration must be 1–30 seconds.');
  if (!Number.isFinite(v.settleDurationMs) || v.settleDurationMs < 1000 || v.settleDurationMs > 10000) fail('settling duration must be 1–10 seconds.');
  return { kind: 'six-axis', target: { translationMm, rotationDeg }, moveDurationMs: v.moveDurationMs, settleDurationMs: v.settleDurationMs };
}

export const stewartAdd = (a: StewartVector, b: StewartVector): StewartVector => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
export const stewartSubtract = (a: StewartVector, b: StewartVector): StewartVector => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const scale = (a: StewartVector, k: number): StewartVector => [a[0]*k, a[1]*k, a[2]*k];
const dot = (a: StewartVector, b: StewartVector) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a: StewartVector, b: StewartVector): StewartVector => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit = (a: StewartVector) => scale(a,1/Math.hypot(...a));
export function stewartQuaternion(rotationDeg: StewartVector): StewartQuaternion {
  const [x,y,z] = rotationDeg.map(v=>v*Math.PI/360);
  const [a,b,c,d,e,f] = [Math.cos(x),Math.sin(x),Math.cos(y),Math.sin(y),Math.cos(z),Math.sin(z)];
  return [b*c*e+a*d*f,a*d*e-b*c*f,a*c*f+b*d*e,a*c*e-b*d*f];
}
export function stewartRotate(q: StewartQuaternion, v: StewartVector): StewartVector {
  const t = scale(cross([q[0],q[1],q[2]],v),2);
  return stewartAdd(stewartAdd(v,scale(t,q[3])),cross([q[0],q[1],q[2]],t));
}
export const stewartOrientationErrorDeg = (a: StewartQuaternion, b: StewartQuaternion): number => {
  const aa=Math.hypot(...a),bb=Math.hypot(...b);
  // atan2 is stable for tiny rotations, including float32 quaternions with w=1.
  const sign=a.reduce((s,v,i)=>s+v*b[i],0)<0?-1:1;
  const difference=Math.hypot(...a.map((v,i)=>v/aa-sign*b[i]/bb));
  const sum=Math.hypot(...a.map((v,i)=>v/aa+sign*b[i]/bb));
  return 4*Math.atan2(difference,sum)*180/Math.PI;
};
const inverse = (q: StewartQuaternion): StewartQuaternion => [-q[0],-q[1],-q[2],q[3]];
export function stewartEulerDeg(q0: StewartQuaternion): StewartVector {
  const n=Math.hypot(...q0); const [x,y,z,w]=q0.map(v=>v/n);
  return [Math.atan2(2*(x*w-y*z),1-2*(x*x+y*y)),Math.asin(Math.max(-1,Math.min(1,2*(x*z+y*w)))),Math.atan2(2*(z*w-x*y),1-2*(y*y+z*z))].map(v=>v*180/Math.PI) as StewartVector;
}
const worldPoint = (part: PartDescriptor, point: StewartVector) => stewartAdd(part.transform.positionMm,stewartRotate(stewartQuaternion(part.transform.rotationDeg),point));
const angleDeg = (a: StewartVector,b: StewartVector) => Math.acos(Math.max(-1,Math.min(1,dot(unit(a),unit(b)))))*180/Math.PI;

export type StewartLeg = {
  mateId: string; barrelId: string; rodId: string;
  baseAnchor: StewartVector; deckAnchorLocal: StewartVector;
  initialDirection: StewartVector; initialDeckDirection: StewartVector;
  initialLengthMm: number;
};
export type StewartGeometry = { home: StewartPose; deckId: string; legs: StewartLeg[]; characteristicLengthMm: number };

/** Restrict this controller to the proven fixture topology and reference frames.
 * Edited anchors/frame geometry must be revalidated, never silently treated as the demo. */
export function deriveStewartGeometry(parts: PartDescriptor[], mates: Mate[]): StewartGeometry {
  if (parts.length!==14 || mates.length!==18) fail('requires the complete 14-part, 18-joint Stewart assembly.');
  const byPart = new Map(parts.map(p=>[p.id,p]));
  const byMate = new Map(mates.map(m=>[m.id,m]));
  const base=byPart.get('stewart-base'),deck=byPart.get('stewart-platform');
  if (!base?.isGround || !deck || deck.isGround) fail('base must be fixed and the deck must be dynamic.');
  const fixedBase=base!, movingDeck=deck!;
  if (Math.hypot(...fixedBase.transform.positionMm)>1e-7 || Math.hypot(...fixedBase.transform.rotationDeg)>1e-7
    || Math.hypot(...stewartSubtract(movingDeck.transform.positionMm,[0,0,160]))>1e-7 || Math.hypot(...movingDeck.transform.rotationDeg)>1e-7) fail('restore the bundled base/deck home frames before using six-axis control.');
  const home={positionMm:[...movingDeck.transform.positionMm] as StewartVector,rotationQuat:stewartQuaternion(movingDeck.transform.rotationDeg)};
  const legs: StewartLeg[]=[];
  const baseAngles=[15,105,135,225,255,345],deckAngles=[45,75,165,195,285,315];
  for(let i=1;i<=6;i++) {
    const lower=byMate.get(`stewart-base-ball-${i}`), slider=byMate.get(`stewart-slider-${i}`), upper=byMate.get(`stewart-deck-ball-${i}`);
    const barrel=byPart.get(`stewart-barrel-${i}`),rod=byPart.get(`stewart-rod-${i}`);
    if (!barrel || !rod || barrel.isGround || rod.isGround || lower?.type!=='spherical' || slider?.type!=='prismatic' || upper?.type!=='spherical') fail(`leg ${i} has missing or incompatible components.`);
    const b=barrel!,r=rod!;
    if (lower!.partA!==fixedBase.id || lower!.partB!==b.id || slider!.partA!==b.id || slider!.partB!==r.id || upper!.partA!==r.id || upper!.partB!==movingDeck.id) fail(`leg ${i} has altered joint connectivity.`);
    const lo=lower as Extract<Mate,{type:'spherical'}>,hi=upper as Extract<Mate,{type:'spherical'}>,sl=slider as Extract<Mate,{type:'prismatic'}>;
    const baseAnchor=worldPoint(fixedBase,lo.pivotA.localPoint),deckAnchorLocal=hi.pivotB.localPoint;
    const expectedBase:StewartVector=[110*Math.cos(baseAngles[i-1]*Math.PI/180),110*Math.sin(baseAngles[i-1]*Math.PI/180),12];
    const expectedDeck:StewartVector=[75*Math.cos(deckAngles[i-1]*Math.PI/180),75*Math.sin(deckAngles[i-1]*Math.PI/180),0];
    if(Math.hypot(...stewartSubtract(baseAnchor,expectedBase))>1e-6 || Math.hypot(...stewartSubtract(deckAnchorLocal,expectedDeck))>1e-6) fail(`leg ${i} anchor edits require new workspace validation.`);
    const top=worldPoint(movingDeck,deckAnchorLocal), delta=stewartSubtract(top,baseAnchor), initialLengthMm=Math.hypot(...delta);
    const close=(a:StewartVector,b:StewartVector)=>Math.hypot(...stewartSubtract(a,b))<1e-6;
    if (!close(worldPoint(b,lo.pivotB.localPoint),baseAnchor) || !close(worldPoint(r,hi.pivotA.localPoint),top)
      || !close(sl.axisLocal,[0,0,1]) || !close(sl.pivotA.localPoint,[0,0,96]) || !close(sl.pivotB.localPoint,[0,0,96])
      || !close(lo.pivotB.localPoint,[0,0,0]) || !close(hi.pivotA.localPoint,[0,0,initialLengthMm])
      || !close(b.transform.positionMm,baseAnchor) || !close(r.transform.positionMm,baseAnchor)
      || stewartOrientationErrorDeg(stewartQuaternion(b.transform.rotationDeg),stewartQuaternion(r.transform.rotationDeg))>1e-6
      || !close(stewartRotate(stewartQuaternion(b.transform.rotationDeg),[0,0,1]),unit(delta))) fail(`leg ${i} reference frames or joint anchors were edited.`);
    legs.push({mateId:sl.id,barrelId:b.id,rodId:r.id,baseAnchor,deckAnchorLocal,initialDirection:unit(delta),initialDeckDirection:stewartRotate(inverse(home.rotationQuat),unit(delta)),initialLengthMm});
  }
  return {home,deckId:movingDeck.id,legs,characteristicLengthMm:75};
}

/** Infinity-norm condition estimate of the length Jacobian. Rotational columns
 * use a 75 mm characteristic lever arm so units do not determine the result. */
export function stewartJacobianCondition(rows:number[][]):number {
  const n=6, a=rows.map((r,i)=>[...r,...Array.from({length:n},(_,j)=>Number(i===j))]);
  const norm=Math.max(...rows.map(r=>r.reduce((s,v)=>s+Math.abs(v),0)));
  for(let c=0;c<n;c++) {
    let best=c;for(let r=c+1;r<n;r++)if(Math.abs(a[r][c])>Math.abs(a[best][c]))best=r;
    if(Math.abs(a[best][c])<1e-10)return Infinity;
    [a[c],a[best]]=[a[best],a[c]];const pivot=a[c][c];a[c]=a[c].map(v=>v/pivot);
    for(let r=0;r<n;r++)if(r!==c){const f=a[r][c];a[r]=a[r].map((v,j)=>v-f*a[c][j]);}
  }
  return norm*Math.max(...a.map(r=>r.slice(n).reduce((s,v)=>s+Math.abs(v),0)));
}
export function stewartInverseKinematics(geometry:StewartGeometry,pose:StewartPose) {
  const rows:number[][]=[];
  const legs=geometry.legs.map(leg=>{
    const offset=stewartRotate(pose.rotationQuat,leg.deckAnchorLocal), top=stewartAdd(pose.positionMm,offset);
    const delta=stewartSubtract(top,leg.baseAnchor),lengthMm=Math.hypot(...delta),direction=unit(delta),extensionMm=lengthMm-leg.initialLengthMm;
    const baseDeflectionDeg=angleDeg(direction,leg.initialDirection),deckDeflectionDeg=angleDeg(stewartRotate(inverse(pose.rotationQuat),direction),leg.initialDeckDirection);
    rows.push([...direction,...scale(cross(offset,direction),1/geometry.characteristicLengthMm)]);
    return {lengthMm,extensionMm,baseDeflectionDeg,deckDeflectionDeg};
  });
  return {legs,jacobianCondition:stewartJacobianCondition(rows)};
}

/** Smooth zero-speed/zero-acceleration endpoints. Small-angle slerp follows the
 * shortest quaternion path; translation and orientation share the same clock. */
export function stewartDesiredPose(geometry:StewartGeometry,config:StewartMotionConfig,timeMs:number):StewartPose {
  const t=Math.max(0,Math.min(1,timeMs/config.moveDurationMs)),s=t*t*t*(10+t*(-15+6*t));
  const target=stewartQuaternion(config.target.rotationDeg),theta=Math.acos(Math.max(-1,Math.min(1,target[3])));
  const k=theta<1e-8?s:Math.sin(s*theta)/Math.sin(theta);
  return {positionMm:stewartAdd(geometry.home.positionMm,scale(config.target.translationMm,s)),rotationQuat:[target[0]*k,target[1]*k,target[2]*k,Math.cos(s*theta)]};
}

export function validateStewartTrajectory(geometry:StewartGeometry,config:StewartMotionConfig):void {
  const radius=Math.max(...geometry.legs.map(l=>Math.hypot(...l.deckAnchorLocal)));
  const angularDistance=stewartOrientationErrorDeg(geometry.home.rotationQuat,stewartQuaternion(config.target.rotationDeg))*Math.PI/180;
  const speedBound=1.875*(Math.hypot(...config.target.translationMm)+radius*angularDistance)/(config.moveDurationMs/1000);
  if(speedBound>STEWART_CONTROL_LIMITS.maxActuatorVelocityMmPerSec)fail(`trajectory requires up to ${speedBound.toFixed(2)} mm/s; increase move duration (limit 8 mm/s).`);
  for(let i=0;i<=128;i++) {
    const result=stewartInverseKinematics(geometry,stewartDesiredPose(geometry,config,config.moveDurationMs*i/128));
    if(!Number.isFinite(result.jacobianCondition)||result.jacobianCondition>STEWART_CONTROL_LIMITS.maxJacobianCondition)fail('trajectory is too close to a singular configuration.');
    for(const leg of result.legs) {
      if(leg.extensionMm<STEWART_CONTROL_LIMITS.minStrokeMm || leg.extensionMm>STEWART_CONTROL_LIMITS.maxStrokeMm)fail('trajectory exceeds an actuator stroke limit.');
      if(Math.max(leg.baseDeflectionDeg,leg.deckDeflectionDeg)>STEWART_CONTROL_LIMITS.maxBearingDeflectionDeg)fail('trajectory exceeds the validated bearing angular envelope.');
    }
  }
}
