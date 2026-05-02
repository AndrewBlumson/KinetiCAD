// Three.js scene factory helpers. Pure functions that return scene primitives
// (scene, camera, lights, grid, axes) so the React component can stay focused
// on lifecycle. All units are millimetres.

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export const COLOURS = {
  background: 0x0a0e1a,
  grid: 0x141b2e,
  axisX: 0xff4444,
  axisY: 0x44ff44,
  axisZ: 0x4488ff,
  defaultPart: 0xa0a8b5,
  orange: 0xff6b1a,
} as const;

export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLOURS.background);
  // Distance fog gives the grid a natural fade without a custom shader.
  scene.fog = new THREE.Fog(COLOURS.background, 200, 600);
  return scene;
}

export function createCamera(aspect: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(45, aspect, 1, 5000);
  camera.position.set(80, 60, 80);
  camera.lookAt(0, 0, 0);
  return camera;
}

export function createLights(scene: THREE.Scene) {
  // Soft fill so unlit faces aren't pure black under the directional key.
  const ambient = new THREE.AmbientLight(0xffffff, 0.15);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 0.6);
  key.position.set(50, 80, 30);
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
 * 200mm x 200mm grid floor with 10mm cells. Lying on the XZ plane (Y up),
 * matching the OCCT convention used in this project.
 */
export function createGrid(): THREE.GridHelper {
  // 20 divisions across 200mm = 10mm cells.
  const grid = new THREE.GridHelper(200, 20, COLOURS.grid, COLOURS.grid);
  const mat = grid.material as THREE.Material;
  mat.transparent = true;
  mat.opacity = 0.65;
  // Prevent grid lines from z-fighting with parts that sit on the floor.
  grid.position.y = -0.01;
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
 */
export function applyEnvironment(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
): () => void {
  // PMREMGenerator's typed surface is WebGLRenderer; the WebGPURenderer in
  // r184 exposes a compatible shape, so the call site casts before we get here.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envTexture = pmrem.fromScene(room, 0.04).texture;
  scene.environment = envTexture;
  return () => {
    envTexture.dispose();
    pmrem.dispose();
  };
}
