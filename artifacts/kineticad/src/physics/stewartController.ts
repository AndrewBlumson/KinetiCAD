import RAPIER from '@dimforge/rapier3d-compat';
import type { BuildWorldArgs, StewartMeasurement } from './types';
import {
  deriveStewartGeometry, validateStewartMotionConfig, validateStewartTrajectory,
  STEWART_CONTROL_LIMITS, stewartAdd, stewartSubtract, stewartRotate,
  stewartDesiredPose, stewartInverseKinematics, stewartOrientationErrorDeg, stewartEulerDeg,
} from './stewartKinematics.ts';
import type { StewartQuaternion, StewartVector, StewartPose } from './stewartKinematics';

type BodyMap = Map<string,RAPIER.RigidBody>;
const position = (body:RAPIER.RigidBody):StewartVector => {const p=body.translation();return [p.x,p.y,p.z];};
const quaternion = (body:RAPIER.RigidBody):StewartQuaternion => {const q=body.rotation(),n=Math.hypot(q.x,q.y,q.z,q.w);return [q.x/n,q.y/n,q.z/n,q.w/n];};
const anchor = (body:RAPIER.RigidBody,local:{x:number;y:number;z:number}):StewartVector => stewartAdd(position(body),stewartRotate(quaternion(body),[local.x,local.y,local.z]));

/** Actuates six physical prismatic joints once per fixed solver substep.
 * Velocity feedback is deliberately bounded. This remains an ideal servo,
 * without a force/torque, bearing-friction or payload-capacity model. */
export function createStewartController(args:BuildWorldArgs,bodies:BodyMap,joints:Map<string,RAPIER.ImpulseJoint>,motorGain:number) {
  const config=validateStewartMotionConfig(args.stewartMotion);
  if(args.gravity.some(v=>v!==0) || (args.appliedForces?.length??0)>0) throw new Error('Stewart controller: six-axis workspace is verified with zero gravity and no external loads.');
  if(args.timeStepMs>1000/60+1e-9 || args.timeStepMs<1000/1000) throw new Error('Stewart controller: use a fixed timestep between 1 and 16.667 ms.');
  const geometry=deriveStewartGeometry(args.parts,args.mates);
  validateStewartTrajectory(geometry,config);
  const totalDurationMs=config.moveDurationMs+config.settleDurationMs;
  if(args.durationMs!==undefined && Math.abs(args.durationMs-totalDurationMs)>1e-6) throw new Error('Stewart controller: run duration must equal movement plus settling time.');
  const stepCount=totalDurationMs/args.timeStepMs;
  if(Math.abs(stepCount-Math.round(stepCount))>1e-7) throw new Error('Stewart controller: movement plus settling time must fit whole fixed timesteps.');
  const drives=geometry.legs.map(leg=>{
    const joint=joints.get(leg.mateId) as RAPIER.PrismaticImpulseJoint | undefined;
    if(!joint) throw new Error(`Stewart controller: missing actuator ${leg.mateId}.`);
    joint.setLimits(STEWART_CONTROL_LIMITS.minStrokeMm,STEWART_CONTROL_LIMITS.maxStrokeMm);
    joint.configureMotorModel(RAPIER.MotorModel.AccelerationBased);
    joint.configureMotorVelocity(0,motorGain);
    return {leg,joint,commandVelocityMmPerSec:0};
  });
  const deck=bodies.get(geometry.deckId)!;
  let peakPositionErrorMm=0,peakOrientationErrorDeg=0;
  const actualPose=():StewartPose=>({positionMm:position(deck),rotationQuat:quaternion(deck)});
  const actualExtension=(drive:typeof drives[number])=>{
    const a=drive.joint.body1(),b=drive.joint.body2();
    const difference=stewartSubtract(anchor(b,drive.joint.anchor2()),anchor(a,drive.joint.anchor1()));
    const axis=stewartRotate(quaternion(a),[0,0,1]);
    return difference.reduce((sum,v,i)=>sum+v*axis[i],0);
  };
  const finalTargetPose=stewartDesiredPose(geometry,config,config.moveDurationMs);
  const measurement=(timeMs:number):StewartMeasurement=>{
    const pose=actualPose(),requestedPose=stewartDesiredPose(geometry,config,timeMs);
    const requested=stewartInverseKinematics(geometry,requestedPose),actual=stewartInverseKinematics(geometry,pose);
    const positionErrorMm=Math.hypot(...stewartSubtract(pose.positionMm,requestedPose.positionMm));
    const orientationErrorDeg=stewartOrientationErrorDeg(pose.rotationQuat,requestedPose.rotationQuat);
    peakPositionErrorMm=Math.max(peakPositionErrorMm,positionErrorMm);peakOrientationErrorDeg=Math.max(peakOrientationErrorDeg,orientationErrorDeg);
    const actuators=drives.map((drive,i)=>({mateId:drive.leg.mateId,targetLengthMm:requested.legs[i].lengthMm,
      actualLengthMm:actual.legs[i].lengthMm,targetExtensionMm:requested.legs[i].extensionMm,
      actualExtensionMm:actualExtension(drive),commandVelocityMmPerSec:drive.commandVelocityMmPerSec}));
    const phase=timeMs>=totalDurationMs-1e-6?'complete':timeMs>=config.moveDurationMs-1e-6?'settling':'moving';
    const reached=timeMs>=config.moveDurationMs-1e-6 && positionErrorMm<=STEWART_CONTROL_LIMITS.positionToleranceMm
      && orientationErrorDeg<=STEWART_CONTROL_LIMITS.orientationToleranceDeg
      && actuators.every(a=>Math.abs(a.actualLengthMm-a.targetLengthMm)<=STEWART_CONTROL_LIMITS.legToleranceMm);
    return {phase,requestedPose,finalTargetPose,actualPose:pose,actualTranslationMm:stewartSubtract(pose.positionMm,geometry.home.positionMm),
      actualRotationDeg:stewartEulerDeg(pose.rotationQuat),positionErrorMm,orientationErrorDeg,peakPositionErrorMm,peakOrientationErrorDeg,
      jacobianCondition:actual.jacobianCondition,reached,actuators};
  };
  return {
    durationMs:totalDurationMs,
    ownsJoint:(id:string)=>drives.some(d=>d.leg.mateId===id),
    beforeStep(timeMs:number,dtMs:number) {
      const now=stewartInverseKinematics(geometry,stewartDesiredPose(geometry,config,timeMs));
      const next=stewartInverseKinematics(geometry,stewartDesiredPose(geometry,config,timeMs+dtMs));
      drives.forEach((drive,i)=>{
        const extension=actualExtension(drive);
        if(!Number.isFinite(extension) || extension<STEWART_CONTROL_LIMITS.minStrokeMm-0.1 || extension>STEWART_CONTROL_LIMITS.maxStrokeMm+0.1) throw new Error(`Stewart controller: ${drive.leg.mateId} exceeded its stroke envelope.`);
        const feedForward=(next.legs[i].extensionMm-now.legs[i].extensionMm)/(dtMs/1000);
        const feedback=16*(now.legs[i].extensionMm-extension);
        const speed=Math.max(-STEWART_CONTROL_LIMITS.maxActuatorVelocityMmPerSec,Math.min(STEWART_CONTROL_LIMITS.maxActuatorVelocityMmPerSec,feedForward+feedback));
        drive.commandVelocityMmPerSec=speed;
        drive.joint.configureMotorVelocity(speed,motorGain);
      });
    },
    afterStep(timeMs:number) {
      const current=measurement(timeMs);
      if(!Number.isFinite(current.jacobianCondition) || current.jacobianCondition>STEWART_CONTROL_LIMITS.maxJacobianCondition
        || !Number.isFinite(current.positionErrorMm) || current.positionErrorMm>2 || current.orientationErrorDeg>1) throw new Error('Stewart controller: measured motion left the validated tracking envelope; simulation stopped.');
      return current;
    },
    measurement,
  };
}
