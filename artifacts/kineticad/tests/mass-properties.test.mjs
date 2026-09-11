import assert from "node:assert/strict";
import { afterEach, before, test } from "node:test";
import { computeMassProperties, principalInertia } from "../src/cad/operations/massProperties.ts";
import { massPropertiesForMaterial, volumeDataFromMassProperties } from "../src/features/volumeCache.ts";

let oc, RAPIER;
const objects = [];
const own = (object) => { objects.push(object); return object; };
before(async () => {
  console.info("[mass-tests] Initialising the installed OCCT kernel.");
  const { default: initOpenCascade } = await import("opencascade.js/dist/node.js");
  oc = await initOpenCascade();
  console.info("[mass-tests] OCCT ready; initialising Rapier.");
  ({ default: RAPIER } = await import("@dimforge/rapier3d-compat"));
  await RAPIER.init();
});
afterEach(() => { for (const object of objects.splice(0).reverse()) object.delete(); });

function close(actual, expected, tolerance = 1e-9) {
  assert(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} differs from ${expected}`);
}

function rotationFromQuaternion([x, y, z, w]) {
  return [
    [1 - 2 * (y*y + z*z), 2 * (x*y - z*w), 2 * (x*z + y*w)],
    [2 * (x*y + z*w), 1 - 2 * (x*x + z*z), 2 * (y*z - x*w)],
    [2 * (x*z - y*w), 2 * (y*z + x*w), 1 - 2 * (x*x + y*y)],
  ];
}

function rotatedTensor(r, diagonal) {
  return r.map((row, i) => row.map((_, j) => diagonal.reduce((sum, v, k) => sum + r[i][k] * v * r[j][k], 0)));
}

function verifyTensor(props, expected) {
  close(Math.hypot(...props.principalInertiaLocalFrame), 1);
  const actual = rotatedTensor(rotationFromQuaternion(props.principalInertiaLocalFrame), props.principalInertiaKgMm2);
  expected.forEach((row, i) => row.forEach((value, j) => close(actual[i][j], value)));
}

function box(dx, dy, dz) {
  return own(own(new oc.BRepPrimAPI_MakeBox_2(dx, dy, dz)).Shape());
}

function physicalBox() {
  // General 3D frame: local Z=(1,2,3)/sqrt(14), local X=(2,-1,0)/sqrt(5).
  const x = [2 / Math.sqrt(5), -1 / Math.sqrt(5), 0];
  const z = [1 / Math.sqrt(14), 2 / Math.sqrt(14), 3 / Math.sqrt(14)];
  const y = [z[1]*x[2]-z[2]*x[1], z[2]*x[0]-z[0]*x[2], z[0]*x[1]-z[1]*x[0]];
  const r = x.map((_, i) => [x[i], y[i], z[i]]);
  const origin = own(new oc.gp_Pnt_3(-40, 70, 15));
  const axis = own(new oc.gp_Ax2_2(origin, own(new oc.gp_Dir_4(...z)), own(new oc.gp_Dir_4(...x))));
  const shape = own(own(new oc.BRepPrimAPI_MakeBox_5(axis, 20, 30, 40)).Shape());
  const mass = 20 * 30 * 40 * 2.7e-6;
  const diagonal = [mass*(30**2+40**2)/12, mass*(20**2+40**2)/12, mass*(20**2+30**2)/12];
  return { shape, r, diagonal, mass };
}

test("OCCT cuboid volume, mass, centroid and all three anisotropic moments match analytic values", () => {
  const props = computeMassProperties(oc, box(20, 30, 40), 2.7);
  close(props.volumeMm3, 24_000);
  close(props.massKg, 0.0648);
  props.comLocal.forEach((value, i) => close(value, [10, 15, 20][i]));
  verifyTensor(props, [[13.5,0,0],[0,10.8,0],[0,0,7.02]]);
  assert(props.principalInertiaKgMm2[2] / props.principalInertiaKgMm2[0] > 1.9, "must not revert to isotropic sphere inertia");
});

test("translated and generally rotated cuboid retains centroidal tensor, including off-diagonal terms", () => {
  const { shape, r, diagonal } = physicalBox();
  const props = computeMassProperties(oc, shape, 2.7);
  const centroid = r.map((row, i) => [-40, 70, 15][i] + row.reduce((sum, v, k) => sum + v * [10,15,20][k], 0));
  centroid.forEach((value, i) => close(props.comLocal[i], value));
  verifyTensor(props, rotatedTensor(r, diagonal));
  assert(props.principalInertiaLocalFrame.slice(0,3).some((v) => Math.abs(v) > 0.1));
});

test("solid cylinder moments match axial and transverse analytic inertia", () => {
  const radius = 15, height = 8, density = 7.87;
  const shape = own(own(new oc.BRepPrimAPI_MakeCylinder_1(radius, height)).Shape());
  const props = computeMassProperties(oc, shape, density);
  const mass = Math.PI * radius**2 * height * density * 1e-6;
  const axial = mass * radius**2 / 2;
  const transverse = mass * (3 * radius**2 + height**2) / 12;
  close(props.massKg, mass);
  verifyTensor(props, [[transverse,0,0],[0,transverse,0],[0,0,axial]]);
});

test("bored ring retains removed-volume effects in its axial and transverse inertia", () => {
  const outerRadius = 35, innerRadius = 26, height = 6, density = 2.7;
  const outer = own(own(new oc.BRepPrimAPI_MakeCylinder_1(outerRadius, height)).Shape());
  const inner = own(own(new oc.BRepPrimAPI_MakeCylinder_1(innerRadius, height)).Shape());
  const cut = own(new oc.BRepAlgoAPI_Cut_3(outer, inner, own(new oc.Message_ProgressRange_1())));
  assert(cut.IsDone());
  const props = computeMassProperties(oc, own(cut.Shape()), density);
  const mass = Math.PI * (outerRadius**2 - innerRadius**2) * height * density * 1e-6;
  const axial = mass * (outerRadius**2 + innerRadius**2) / 2;
  const transverse = mass * (3 * (outerRadius**2 + innerRadius**2) + height**2) / 12;
  close(props.massKg, mass);
  verifyTensor(props, [[transverse,0,0],[0,transverse,0],[0,0,axial]]);
});

test("warm cache and a material change preserve the full tensor and principal frame", () => {
  const { shape } = physicalBox();
  const aluminium = computeMassProperties(oc, shape, 2.7);
  const cached = volumeDataFromMassProperties(aluminium, 2.7);
  const warm = massPropertiesForMaterial(cached, 2.7);
  const steel = massPropertiesForMaterial(cached, 7.87);
  const directSteel = computeMassProperties(oc, shape, 7.87);
  warm.principalInertiaKgMm2.forEach((v, i) => close(v, aluminium.principalInertiaKgMm2[i]));
  steel.principalInertiaKgMm2.forEach((v, i) => close(v, directSteel.principalInertiaKgMm2[i]));
  assert.deepEqual(steel.principalInertiaLocalFrame, aluminium.principalInertiaLocalFrame);
  close(steel.massKg / aluminium.massKg, 7.87 / 2.7);
});

test("Rapier torque impulse follows the full rotated inertia inverse, not part-local diagonal axes", () => {
  const { shape, r, diagonal } = physicalBox();
  const props = computeMassProperties(oc, shape, 2.7);
  const [ix,iy,iz] = props.principalInertiaKgMm2;
  const [x,y,z,w] = props.principalInertiaLocalFrame;
  const world = new RAPIER.World({x:0,y:0,z:0});
  try {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic());
    world.createCollider(RAPIER.ColliderDesc.ball(1).setDensity(0), body);
    body.setAdditionalMassProperties(props.massKg, {x:props.comLocal[0],y:props.comLocal[1],z:props.comLocal[2]}, {x:ix,y:iy,z:iz}, {x,y,z,w}, true);
    body.recomputeMassPropertiesFromColliders();
    const impulse = [2,-3,5];
    body.applyTorqueImpulse({x:impulse[0],y:impulse[1],z:impulse[2]}, true);
    const inverse = rotatedTensor(r, diagonal.map((i) => 1 / i));
    const expected = inverse.map((row) => row.reduce((sum,v,k) => sum + v * impulse[k], 0));
    const actual = body.angvel();
    [actual.x,actual.y,actual.z].forEach((v,i) => close(v,expected[i],3e-6));
    close(body.mass(), props.massKg, 1e-6);
  } finally { world.free(); }
});

test("eigensolver handles tiny and large units and rejects non-physical tensors", () => {
  for (const scale of [1e-12, 1, 1e12]) {
    const tensor = [[2*scale,0.3*scale,0],[0.3*scale,2*scale,0],[0,0,3*scale]];
    const result = principalInertia(tensor);
    const restored = rotatedTensor(rotationFromQuaternion(result.frame), result.moments);
    tensor.forEach((row,i) => row.forEach((v,j) => assert(Math.abs(restored[i][j]-v) <= scale*1e-10)));
  }
  assert.throws(() => principalInertia([[1,0,0],[0,1,0],[0,0,5]]), /triangle inequality/);
  assert.throws(() => principalInertia([[-1,0,0],[0,1,0],[0,0,1]]), /positive definite/);
  assert.throws(() => principalInertia([[1,NaN,0],[NaN,1,0],[0,0,1]]), /finite/);
});

test("empty geometry and invalid density fail instead of creating fictitious physical bodies", () => {
  const empty = own(new oc.TopoDS_Compound());
  own(new oc.BRep_Builder()).MakeCompound(empty);
  assert.throws(() => computeMassProperties(oc, empty, 2.7), /positive closed-solid volume/);
  assert.throws(() => computeMassProperties(oc, box(20,20,10), 0), /density/);
  assert.throws(() => computeMassProperties(oc, box(20,20,10), NaN), /density/);
});
