// Three.js scene factory helpers. Pure functions that return scene primitives
// (scene, camera, lights, grid, axes) so the React component can stay focused
// on lifecycle. All units are millimetres.

import * as THREE from "three";
import {
  PMREMGenerator as WebGPUPMREMGenerator,
  type Renderer as WebGPUBaseRenderer,
  type WebGPURenderer,
} from "three/webgpu";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export const COLOURS = {
  background: 0x0a0e1a,
  // World grid (10mm major spacing) — brighter so it reads against the
  // near-black background without competing with sketch primitives or parts.
  grid: 0x3a4560,
  // Sketch-overlay finer tiers (1mm + 5mm). Distinctly dimmer than the
  // major grid lines.
  gridMinor: 0x252d42,
  axisX: 0xff4444,
  axisY: 0x44ff44,
  axisZ: 0x4488ff,
  defaultPart: 0xa0a8b5,
  orange: 0xff6b1a,
  // Topology picker highlights — yellow on hover, KinetiCAD orange on selection.
  highlightHover: 0xffd24a,
  highlightSelected: 0xff6b1a,
} as const;

export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLOURS.background);
  // Distance fog gives the grid a natural fade without a custom shader.
  scene.fog = new THREE.Fog(COLOURS.background, 200, 600);
  return scene;
}

export function createCamera(aspect: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(45, aspect, 1, 2000);
  // Z-up convention (mechanical CAD: SolidWorks/Onshape). World X=right,
  // Y=forward, Z=up. Floor is the XY plane at Z=0.
  // IMPORTANT: set camera.up BEFORE OrbitControls is constructed — the
  // controls cache an internal quaternion from object.up at construction
  // time and use it for all spherical orbit math.
  camera.up.set(0, 0, 1);
  camera.position.set(80, -80, 60);
  camera.lookAt(0, 0, 0);
  return camera;
}

export function createLights(scene: THREE.Scene) {
  // Soft fill so unlit faces aren't pure black under the directional key.
  const ambient = new THREE.AmbientLight(0xffffff, 0.15);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 0.6);
  // Z-up: "above and slightly to the side" → high Z, modest X/Y.
  key.position.set(50, 30, 80);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 500;
  key.shadow.camera.left = -100;
  key.shadow.camera.right = 100;
  key.shadow.camera.top = 100;
  key.shadow.camera.bottom = -100;
  key.shadow.bias = -0.0005;
  scene.add(key);

  return { ambient, key };
}

/**
 * 200mm x 200mm grid floor with 10mm cells. Lying on the world XY plane
 * (Z=0), matching the Z-up convention used by mechanical CAD packages.
 *
 * THREE.GridHelper is built in the XZ plane by default; we rotate it +90°
 * around the X axis so its normal flips from +Y to +Z and the lines lie
 * flat on the floor.
 */
export function createGrid(): THREE.GridHelper {
  // 20 divisions across 200mm = 10mm cells.
  const grid = new THREE.GridHelper(200, 20, COLOURS.grid, COLOURS.grid);
  const mat = grid.material as THREE.Material;
  mat.transparent = true;
  mat.opacity = 0.65;
  // Re-orient from default XZ plane → XY plane (floor in Z-up).
  grid.rotation.x = Math.PI / 2;
  // Sit just below Z=0 so grid lines don't z-fight with parts whose
  // bottom face is exactly on the floor.
  grid.position.z = -0.01;
  return grid;
}

/**
 * Origin axes implemented as thin cylinders rather than lines, because GPU line
 * width is unreliable across renderers.
 */
export function createAxes(lengthMm: number = 50): THREE.Group {
  const group = new THREE.Group();
  group.name = "OriginAxes";

  const radius = 0.35;
  const segments = 12;

  const make = (colour: number, axis: "x" | "y" | "z"): THREE.Mesh => {
    const geom = new THREE.CylinderGeometry(radius, radius, lengthMm, segments);
    const mat = new THREE.MeshBasicMaterial({ color: colour });
    const mesh = new THREE.Mesh(geom, mat);
    // Cylinder defaults to Y-aligned, centred on origin. Shift so it starts at
    // the origin and rotate to point down the requested axis.
    mesh.position.set(0, lengthMm / 2, 0);
    if (axis === "x") {
      const pivot = new THREE.Group();
      pivot.add(mesh);
      pivot.rotation.z = -Math.PI / 2;
      return pivot as unknown as THREE.Mesh;
    }
    if (axis === "z") {
      const pivot = new THREE.Group();
      pivot.add(mesh);
      pivot.rotation.x = Math.PI / 2;
      return pivot as unknown as THREE.Mesh;
    }
    return mesh;
  };

  group.add(make(COLOURS.axisX, "x"));
  group.add(make(COLOURS.axisY, "y"));
  group.add(make(COLOURS.axisZ, "z"));

  // Origin marker: small white sphere.
  const origin = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  group.add(origin);

  return group;
}

/**
 * Recursively dispose every geometry and material reachable under the given
 * Object3D. Use for grouped helpers (axes, sub-mesh hierarchies) on unmount.
 */
export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const material = mesh.material as
      | THREE.Material
      | THREE.Material[]
      | undefined;
    if (Array.isArray(material)) {
      material.forEach((m) => m.dispose());
    } else if (material) {
      material.dispose();
    }
  });
}

/**
 * Build a PBR environment map from the bundled RoomEnvironment scene and
 * assign it to scene.environment. Returns a disposer for cleanup.
 *
 * IMPORTANT: must be called *after* `await renderer.init()` has resolved.
 * The WebGPU renderer's backend isn't populated until init completes, and
 * PMREMGenerator reads renderer-internal buffers immediately.
 *
 * Uses the WebGPU-specific PMREMGenerator from `three/webgpu`. The legacy
 * `THREE.PMREMGenerator` from `'three'` is the WebGL one and crashes with
 * "Cannot read properties of undefined (reading 'buffers')" when handed a
 * WebGPURenderer.
 */
export function applyEnvironment(
  scene: THREE.Scene,
  renderer: WebGPURenderer,
): () => void {
  const room = new RoomEnvironment();
  try {
    // The webgpu PMREMGenerator constructor wants a `Renderer` (the
    // three/webgpu base class). WebGPURenderer extends it, but the
    // structural typing diverges across r184 type bundles, so cast through
    // the base type to keep things explicit and lint-clean.
    const pmrem = new WebGPUPMREMGenerator(
      renderer as unknown as WebGPUBaseRenderer,
    );
    const envTexture = pmrem.fromScene(room, 0.04).texture;
    scene.environment = envTexture;
    return () => {
      envTexture.dispose();
      pmrem.dispose();
    };
  } catch (err) {
    // Fallback: if PMREM filtering fails for any r184/WebGPU reason, assign
    // the room scene directly as the environment. The visual difference is
    // an unfiltered/sharper reflection, which is acceptable for a CAD tool.
    // eslint-disable-next-line no-console
    console.warn(
      "[SCENE] PMREM filtering failed; falling back to direct RoomEnvironment:",
      err,
    );
    scene.environment = room as unknown as THREE.Texture;
    return () => {
      // RoomEnvironment is a Scene; recursively dispose its meshes.
      disposeObject3D(room);
    };
  }
}
