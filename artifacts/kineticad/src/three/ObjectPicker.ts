import * as THREE from 'three';
import type { StoreApi } from 'zustand';
import type { KinetiCADStore, Selection } from '../state/store';
import type { PartMeshLayer, PartTopology } from './PartMeshLayer';
import type { BooleanResultLayer } from './BooleanResultLayer';

export type ObjectPickBody = {
  selection: Exclude<Selection, null> & ({ kind: 'part' } | { kind: 'boolean' });
  mesh: THREE.Mesh;
  topology: PartTopology;
};
type Layers = { partMeshLayer: PartMeshLayer; booleanResultLayer?: BooleanResultLayer };
const CLICK_PIXEL_TOLERANCE = 4;

export function objectIsVisible(object: THREE.Object3D): boolean {
  for (let current: THREE.Object3D | null = object; current; current = current.parent) {
    if (!current.visible) return false;
  }
  return true;
}

/** Display selection includes compound Boolean results. It deliberately does
 * not use the separate, single-solid-only mate topology iterator. */
export function visibleObjectBodies(state: Pick<KinetiCADStore, 'assembly'>, layers: Layers): ObjectPickBody[] {
  const result: ObjectPickBody[] = [];
  const hiddenInputs = new Set(state.assembly.booleanFeatures.flatMap(feature => feature.hideInputs ? feature.inputPartIds : []));
  const parts = new Map(state.assembly.parts.map(part => [part.id, part]));
  if (objectIsVisible(layers.partMeshLayer.group)) layers.partMeshLayer.forEachVisible((partId, mesh, topology) => {
    if (parts.get(partId)?.visible && !hiddenInputs.has(partId) && objectIsVisible(mesh)) {
      result.push({ selection: { kind: 'part', partId }, mesh, topology });
    }
  });
  const features = new Map(state.assembly.booleanFeatures.map(feature => [`boolean:${feature.id}`, feature]));
  for (const body of layers.booleanResultLayer?.getVisiblePartMeshes() ?? []) {
    const feature = features.get(body.partId);
    if (feature && objectIsVisible(body.mesh)) result.push({ selection: { kind: 'boolean', booleanId: feature.id }, mesh: body.mesh, topology: body.topology });
  }
  return result;
}

export function canSelectObjects(state: KinetiCADStore): boolean {
  return state.mode === 'modeller' && state.pickingMode === 'idle' && !state.simulation.running
    && !state.historyBusy && !state.sketchSession.active && !state.sketchDimensionsEditing
    && !state.featureEditor.open && !state.booleanEditor.open && !state.mateEditor.open;
}

/** Real mesh intersections preserve front-to-back occlusion and holes. Only
 * candidate body meshes participate: grid, axes, highlights and handles cannot
 * become selected CAD objects. Coplanar ties prefer the finished result. */
export function pickObjectAtNdc(camera: THREE.Camera, ndc: THREE.Vector2, bodies: readonly ObjectPickBody[]): ObjectPickBody | null {
  camera.updateWorldMatrix(true, false);
  for (const body of bodies) body.mesh.updateWorldMatrix(true, false);
  const byMesh = new Map(bodies.map(body => [body.mesh, body]));
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(bodies.filter(body => objectIsVisible(body.mesh)).map(body => body.mesh), false);
  if (!hits.length) return null;
  const nearest = hits[0].distance;
  for (const hit of hits) {
    if (hit.distance > nearest + 1e-7) break;
    const body = byMesh.get(hit.object as THREE.Mesh);
    if (body?.selection.kind === 'boolean') return body;
  }
  return byMesh.get(hits[0].object as THREE.Mesh) ?? null;
}

/** Highlight coordinates come from the same live mesh matrix as raycasting.
 * The source arrays and shared material are never modified. */
export function objectOutlineInWorld(body: ObjectPickBody): Float32Array[] {
  body.mesh.updateWorldMatrix(true, false);
  const point = new THREE.Vector3();
  return body.topology.edges.map(edge => {
    const positions = new Float32Array(edge.polyline.length);
    for (let i = 0; i < positions.length; i += 3) point.fromArray(edge.polyline, i).applyMatrix4(body.mesh.matrixWorld).toArray(positions, i);
    return positions;
  });
}

export function selectedObjectBody(selection: Selection, bodies: readonly ObjectPickBody[]): ObjectPickBody | undefined {
  return bodies.find(body => selection?.kind === 'part' && body.selection.kind === 'part'
    ? selection.partId === body.selection.partId
    : selection?.kind === 'boolean' && body.selection.kind === 'boolean' && selection.booleanId === body.selection.booleanId);
}

/** Normal-mode pointer selection stays separate from feature/mate picking. */
export function createObjectPicker(options: Layers & {
  domElement: HTMLElement;
  camera: THREE.Camera;
  store: StoreApi<KinetiCADStore>;
  /** TransformControls registers first; latch its claim before pointer-up resets dragging. */
  isGizmoActive: () => boolean;
  eventTarget?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
}) {
  const { domElement, store, camera } = options;
  const eventTarget = options.eventTarget ?? window;
  let down: { pointerId: number; x: number; y: number; moved: boolean; claimed: boolean } | null = null;
  const allowed = () => canSelectObjects(store.getState());
  const inside = (event: PointerEvent) => {
    const rect = domElement.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && event.clientX >= rect.left && event.clientX < rect.right
      && event.clientY >= rect.top && event.clientY < rect.bottom;
  };
  const move = (event: PointerEvent) => {
    if (!down || event.pointerId !== down.pointerId) return;
    down.moved ||= Math.hypot(event.clientX - down.x, event.clientY - down.y) > CLICK_PIXEL_TOLERANCE;
    down.claimed ||= options.isGizmoActive();
  };
  const start = (event: PointerEvent) => {
    down = null;
    if (event.button !== 0 || event.isPrimary === false || !allowed() || !inside(event)) return;
    down = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false, claimed: options.isGizmoActive() };
  };
  const finish = (event: PointerEvent) => {
    if (!down || event.pointerId !== down.pointerId) return;
    move(event);
    const gesture = down;
    down = null;
    if (event.button !== 0 || gesture.moved || gesture.claimed || !allowed() || !inside(event)) return;
    const rect = domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    const state = store.getState();
    const selected = pickObjectAtNdc(camera, ndc, visibleObjectBodies(state, options))?.selection;
    if (selected?.kind === 'part') state.selectPart(selected.partId);
    else if (selected?.kind === 'boolean') state.selectBoolean(selected.booleanId);
    else state.clearSelection();
  };
  const cancel = () => { down = null; };
  const unsubscribe = store.subscribe((state, previous) => {
    if (!canSelectObjects(state) || state.assembly !== previous.assembly) cancel();
  });
  domElement.addEventListener('pointerdown', start);
  domElement.addEventListener('pointerleave', cancel);
  eventTarget.addEventListener('pointermove', move as EventListener);
  eventTarget.addEventListener('pointerup', finish as EventListener);
  eventTarget.addEventListener('pointercancel', cancel);
  eventTarget.addEventListener('blur', cancel);
  return { dispose() {
    cancel(); unsubscribe();
    domElement.removeEventListener('pointerdown', start);
    domElement.removeEventListener('pointerleave', cancel);
    eventTarget.removeEventListener('pointermove', move as EventListener);
    eventTarget.removeEventListener('pointerup', finish as EventListener);
    eventTarget.removeEventListener('pointercancel', cancel);
    eventTarget.removeEventListener('blur', cancel);
  } };
}
