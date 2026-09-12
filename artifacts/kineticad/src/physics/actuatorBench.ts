import RAPIER from '@dimforge/rapier3d-compat';

export type ActuatorBenchConfig = {
  /** Total moving mass represented by the block. */
  payloadKg: number;
  maxForceN: number;
  targetHeightMm: number;
  initialHeightMm?: number;
  durationMs?: number;
  timeStepMs?: number;
  gravityMPerSec2?: number;
  /** Limit on the commanded speed, not on gravity-driven actual motion. */
  maxSpeedMmPerSec?: number;
  /** False is reserved for independent free-base reaction/momentum tests. */
  baseFixed?: boolean;
};
export type ActuatorBenchSnapshot = {
  kind:'actuator'; simulatedTimeMs:number; dtMs:number; completed:boolean;
  stopReason:'duration'|'travel-boundary'|null;
  parameters:Required<ActuatorBenchConfig>;
  massKg:number;
  positionMm:[number,number,number]; velocityMmPerSec:[number,number,number];
  basePositionMm:[number,number,number]; baseVelocityMmPerSec:[number,number,number];
  appliedForceN:number; reactionForceN:number;
  accelerationMmPerSec2:number|null; inferredActuatorForceN:number|null;
  saturated:boolean; weightN:number; positionErrorMm:number;
  reference:{accelerationMmPerSec2:number;velocityMmPerSec:number;positionMm:number;valid:boolean;description:string};
  energyJ:{kinetic:number;potential:number;actuatorWork:number};
};
export const ACTUATOR_BENCH_PRESETS:ReadonlyArray<{id:string;title:string;description:string;config:ActuatorBenchConfig}>=[
  {id:'lift',title:'Lift',description:'A 16 N drive lifts 1 kg to the target and settles.',config:{payloadKg:1,maxForceN:16,initialHeightMm:300,targetHeightMm:380,durationMs:4000}},
  {id:'hold',title:'Hold',description:'The drive supplies the weight of a stationary 1 kg mass.',config:{payloadKg:1,maxForceN:16,initialHeightMm:300,targetHeightMm:300,durationMs:2000}},
  {id:'overload',title:'Overload',description:'A 2 kg mass needs 19.62 N. The 16 N drive cannot hold it.',config:{payloadKg:2,maxForceN:16,initialHeightMm:320,targetHeightMm:400,durationMs:500}},
];

export function validateActuatorBenchConfig(value:ActuatorBenchConfig):Required<ActuatorBenchConfig> {
  const c:Required<ActuatorBenchConfig>={initialHeightMm:300,durationMs:2000,timeStepMs:1000/120,gravityMPerSec2:9.81,maxSpeedMmPerSec:40,baseFixed:true,...value};
  const ranges:Record<string,[number,number]>={payloadKg:[0.1,10],maxForceN:[0.01,2000],initialHeightMm:[100,500],targetHeightMm:[100,500],durationMs:[100,10000],timeStepMs:[1,1000/60+1e-9],gravityMPerSec2:[0,20],maxSpeedMmPerSec:[1,100]};
  for(const [key,[min,max]]of Object.entries(ranges)){
    const v=c[key as keyof typeof c];if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error(`Actuator bench: ${key} must be between ${min} and ${max}.`);
  }
  if(typeof c.baseFixed!=='boolean')throw new Error('Actuator bench: baseFixed must be boolean.');
  const steps=c.durationMs/c.timeStepMs;if(Math.abs(steps-Math.round(steps))>1e-7)throw new Error('Actuator bench: duration must contain whole fixed steps.');
  return c;
}

let initialized:Promise<void>|undefined;
/** A separate educational rigid-body experiment. Its simple collider geometry
 * has no connection to a user's CAD assembly or the Stewart ideal controller. */
export async function createActuatorBench(input:ActuatorBenchConfig) {
  const config=validateActuatorBenchConfig(input);
  initialized??=RAPIER.init();await initialized;
  const world=new RAPIER.World({x:0,y:0,z:-config.gravityMPerSec2*1000});
  world.timestep=config.timeStepMs/1000;world.integrationParameters.numSolverIterations=32;
  const baseMassKg=4;
  const body=(fixed:boolean,mass:number,z:number,half:[number,number,number])=>{
    const desc=(fixed?RAPIER.RigidBodyDesc.fixed():RAPIER.RigidBodyDesc.dynamic()).setTranslation(0,0,z).setCanSleep(false);
    desc.setLinearDamping(0).setAngularDamping(0);
    if(!fixed){const [x,y,z]=half.map(v=>v*2);desc.setAdditionalMassProperties(mass,{x:0,y:0,z:0},{x:mass*(y*y+z*z)/12,y:mass*(x*x+z*z)/12,z:mass*(x*x+y*y)/12},{x:0,y:0,z:0,w:1});}
    const b=world.createRigidBody(desc);world.createCollider(RAPIER.ColliderDesc.cuboid(...half).setDensity(0).setSolverGroups(0x00010000),b);if(!fixed)b.recomputeMassPropertiesFromColliders();return b;
  };
  const base=body(config.baseFixed,baseMassKg,0,[60,50,10]);
  const moving=body(false,config.payloadKg,config.initialHeightMm,[20,20,20]);
  // Translation along Z is free; no configureMotor call is made.
  world.createImpulseJoint(RAPIER.JointData.prismatic({x:0,y:0,z:0},{x:0,y:0,z:-config.initialHeightMm},{x:0,y:0,z:1}),base,moving,true);
  const massKg=moving.mass(),maxSteps=Math.round(config.durationMs/config.timeStepMs),dt=config.timeStepMs/1000;
  let disposed=false,steps=0,accumulatorMs=0,stopReason:ActuatorBenchSnapshot['stopReason']=null;
  let appliedForceN=0,accelerationMmPerSec2:number|null=null,inferredActuatorForceN:number|null=null,saturated=false;
  let referencePosition=config.initialHeightMm,referenceVelocity=0,referenceAcceleration=0,actuatorWorkJ=0;
  const tuple=(v:{x:number;y:number;z:number}):[number,number,number]=>[v.x,v.y,v.z];
  const snapshot=(advancedMs=0):ActuatorBenchSnapshot=>{
    const pos=moving.translation(),vel=moving.linvel(),bp=base.translation(),bv=base.linvel();
    return {kind:'actuator',simulatedTimeMs:Math.min(steps*config.timeStepMs,config.durationMs),dtMs:advancedMs,completed:stopReason!==null,stopReason,parameters:config,massKg,
      positionMm:tuple(pos),velocityMmPerSec:tuple(vel),basePositionMm:tuple(bp),baseVelocityMmPerSec:tuple(bv),appliedForceN,reactionForceN:-appliedForceN,
      accelerationMmPerSec2,inferredActuatorForceN,saturated,weightN:massKg*config.gravityMPerSec2,positionErrorMm:config.targetHeightMm-(pos.z-bp.z),
      reference:{accelerationMmPerSec2:referenceAcceleration,velocityMmPerSec:referenceVelocity,positionMm:referencePosition,valid:true,
        description:'Newton reference integrates the applied force schedule independently of the measured positions and velocities. Overload has the constant acceleration Fmax/m − g; hold has zero acceleration.'},
      energyJ:{kinetic:0.5*massKg*(vel.x**2+vel.y**2+vel.z**2)/1e6+(config.baseFixed?0:0.5*baseMassKg*(bv.x**2+bv.y**2+bv.z**2)/1e6),
        potential:massKg*config.gravityMPerSec2*(pos.z-config.initialHeightMm)/1000+(config.baseFixed?0:baseMassKg*config.gravityMPerSec2*bp.z/1000),actuatorWork:actuatorWorkJ}};
  };
  return {
    step(requestedMs=config.timeStepMs):ActuatorBenchSnapshot {
      if(disposed)throw new Error('Actuator bench has been disposed.');
      if(!Number.isFinite(requestedMs)||requestedMs<0)throw new Error('Actuator bench step must be finite and non-negative.');
      if(stopReason || requestedMs===0)return snapshot();
      accumulatorMs+=requestedMs;
      const count=Math.min(120,maxSteps-steps,Math.floor((accumulatorMs+config.timeStepMs*1e-9)/config.timeStepMs));
      let advanced=0;
      for(let i=0;i<count;i++){
        const p=moving.translation(),b=base.translation(),v=moving.linvel(),bv=base.linvel();
        const height=p.z-b.z,relativeVelocity=v.z-bv.z;
        // Stop before a possible boundary crossing. This is an explicit test
        // cutoff, not an impact, hard stop, contact force or velocity clamp.
        const accelerationBound=config.maxForceN*(1/massKg+(config.baseFixed?0:1/baseMassKg))*1000+(config.baseFixed?config.gravityMPerSec2*1000:0);
        if(height+Math.min(0,relativeVelocity*dt)-accelerationBound*dt*dt<80 || height+Math.max(0,relativeVelocity*dt)+accelerationBound*dt*dt>550){stopReason='travel-boundary';break;}
        const targetVelocity=Math.max(-config.maxSpeedMmPerSec,Math.min(config.maxSpeedMmPerSec,4*(config.targetHeightMm-height)));
        const demandN=(config.baseFixed?massKg*config.gravityMPerSec2:0)+massKg*80*(targetVelocity-relativeVelocity)/1000;
        appliedForceN=Math.max(-config.maxForceN,Math.min(config.maxForceN,demandN));saturated=Math.abs(demandN)>=config.maxForceN;
        // Remove previous user forces/torques before applying this substep's
        // one actuator force pair. A common application point prevents a net
        // couple if constraint anchors differ by floating-point residuals.
        for(const body of [base,moving]){body.resetForces(true);body.resetTorques(true);}
        const commonPoint={x:(p.x+b.x)/2,y:(p.y+b.y)/2,z:(p.z+b.z)/2};
        moving.addForceAtPoint({x:0,y:0,z:appliedForceN*1000},commonPoint,true);
        base.addForceAtPoint({x:0,y:0,z:-appliedForceN*1000},commonPoint,true);
        referenceAcceleration=(appliedForceN/massKg-config.gravityMPerSec2)*1000;
        referencePosition+=referenceVelocity*dt+0.5*referenceAcceleration*dt*dt;referenceVelocity+=referenceAcceleration*dt;
        world.step();steps++;advanced++;
        const next=moving.translation(),nb=base.translation(),nv=moving.linvel();
        accelerationMmPerSec2=(nv.z-v.z)/dt;
        inferredActuatorForceN=massKg*(accelerationMmPerSec2/1000+config.gravityMPerSec2);
        actuatorWorkJ+=appliedForceN*((next.z-p.z)-(nb.z-b.z))/1000;
        if(![next.x,next.y,next.z,nv.x,nv.y,nv.z,inferredActuatorForceN].every(Number.isFinite))throw new Error('Actuator bench produced a non-finite solver result.');
      }
      accumulatorMs=Math.max(0,accumulatorMs-advanced*config.timeStepMs);
      if(steps>=maxSteps)stopReason='duration';
      if(stopReason)accumulatorMs=0;
      return snapshot(advanced*config.timeStepMs);
    },
    dispose(){if(!disposed){disposed=true;world.free();}},
  };
}
