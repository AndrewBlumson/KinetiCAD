// Phase 4 Split A — Topology picker.
//
// Imperative class instantiated by Scene.tsx once the kernel + part layers are
// ready. Listens for mouse events on the canvas and dispatches to the store
// based on the current `pickingMode`:
//   - 'idle'           → no-op (also clears any visible hover highlight).
//   - 'edges'          → screen-space proximity raycast over all visible
//                        parts' edge polylines. Hover updates EdgeHighlight,
//                        click dispatches `selectEdges`.
//   - 'faces'          → standard THREE.Raycaster against all visible part
//                        meshes; hit triangleIndex → faceForTriangle → faceId.
//                        Hover updates FaceHighlight, click dispatches
//                        `selectFace`.
//   - 'point-on-face'  → first click selects the face (same as 'faces'); a
//                        subsequent click on the same selected planar face
//                        computes UV from the face's plane basis and
//                        dispatches `selectPointOnFace`.
//
// Click-vs-drag: we record the mousedown screen point and only treat the
// mouseup as a pick if the cursor moved less than CLICK_PIXEL_TOL.

import * as THREE from "three";
import type { EdgeMetadata, FaceMetadata } from "@/cad/types";
import type {
  KinetiCADStore,
  PickFilter,
  PickingMode,
  Selection,
} from "@/state/store";
import type { PartMeshLayer, PartTopology } from "./PartMeshLayer";
import type { EdgeHighlightLayer } from "./EdgeHighlightLayer";
import type { FaceHighlightLayer } from "./FaceHighlightLayer";
import type { StoreApi } from "zustand";

const EDGE_PROXIMITY_PX = 8;
// When a pick filter is active (e.g. Revolute restricting to circle/arc),
// only inspector-valid edges are considered, so we can be much more generous
// about how close the cursor must be. Without this widening, mouseup jitter
// of even a few pixels can carry the cursor outside the 8 px band of the
// only filter-matching edge nearby — producing `hit: null` on click despite
// a clean hover highlight a moment earlier. The filter precludes wrong-type
// picks, so the larger window can't accidentally select something invalid.
const FILTERED_EDGE_PROXIMITY_PX = 24;
const CLICK_PIXEL_TOL = 4;

export type TopologyPicker = {
  /** Update screen-space resolution (used by edge proximity calculations). */
  setResolution: (w: number, h: number) => void;
  dispose: () => void;
};

type EdgeHit = {
  partId: string;
  edge: EdgeMetadata;
};

type FaceHit = {
  partId: string;
  face: FaceMetadata;
  /** World-space hit point on the face. */
  point: THREE.Vector3;
};

export function createTopologyPicker(opts: {
  domElement: HTMLElement;
  camera: THREE.Camera;
  partMeshLayer: PartMeshLayer;
  edgeLayer: EdgeHighlightLayer;
  faceLayer: FaceHighlightLayer;
  store: StoreApi<KinetiCADStore>;
}): TopologyPicker {
  const { domElement, camera, partMeshLayer, edgeLayer, faceLayer, store } =
    opts;

  let widthPx = domElement.clientWidth || window.innerWidth;
  let heightPx = domElement.clientHeight || window.innerHeight;

  let pickingMode: PickingMode = store.getState().pickingMode;
  let pickFilter: PickFilter | null = store.getState().pickFilter;
  const unsubscribe = store.subscribe((state, prev) => {
    if (state.pickingMode !== prev.pickingMode) {
      pickingMode = state.pickingMode;
      if (pickingMode === "idle") {
        // Clear hover highlights immediately so the user sees the mode change.
        edgeLayer.setHover(null);
        faceLayer.setHover(null);
      }
    }
    if (state.pickFilter !== prev.pickFilter) {
      pickFilter = state.pickFilter;
    }
  });

  // Diagnostic captured by the most recent findEdgeHit call. Logged on click
  // so QA can see, when hit is null, whether candidates were filtered out,
  // none existed, or the cursor was just outside the proximity window.
  let edgePickDiag: {
    considered: number;
    bestDistAll: number;
    proximity: number;
    totalEdges: number;
    typeHistogram: Record<string, number>;
  } = {
    considered: 0,
    bestDistAll: Infinity,
    proximity: EDGE_PROXIMITY_PX,
    totalEdges: 0,
    typeHistogram: {},
  };

  // Phase 9.5 — predicates derived from the active pick filter. Both hover
  // and click feed through these so the user can never visually highlight
  // an entity that the click handler would later reject.
  const edgeAllowed = (e: EdgeMetadata): boolean => {
    const allow = pickFilter?.edgeTypes;
    return !allow || allow.includes(e.type);
  };
  const faceAllowed = (f: FaceMetadata): boolean => {
    const allow = pickFilter?.faceTypes;
    return !allow || allow.includes(f.type);
  };

  // Click-vs-drag tracking.
  let mouseDownAt: { x: number; y: number; shift: boolean } | null = null;

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  const eventToCss = (ev: MouseEvent): { x: number; y: number } => {
    const rect = domElement.getBoundingClientRect();
    return {
      x: ev.clientX - rect.left,
      y: ev.clientY - rect.top,
    };
  };

  const cssToNdc = (css: { x: number; y: number }): void => {
    ndc.x = (css.x / widthPx) * 2 - 1;
    ndc.y = -((css.y / heightPx) * 2 - 1);
  };

  /**
   * Project a world-space point to CSS pixels (relative to the canvas's
   * top-left), or return null if the point is behind the camera.
   */
  const projectToPx = (
    out: THREE.Vector3,
    p0: number,
    p1: number,
    p2: number,
  ): { x: number; y: number; behind: boolean } => {
    out.set(p0, p1, p2);
    out.project(camera);
    return {
      x: ((out.x + 1) * widthPx) / 2,
      y: ((1 - out.y) * heightPx) / 2,
      behind: out.z > 1 || out.z < -1, // outside [-1,1] = clipped
    };
  };

  // Pre-allocate working vectors for projection to avoid GC churn.
  const worldA = new THREE.Vector3();
  const worldB = new THREE.Vector3();

  /** Screen-space distance from the cursor to the polyline, in CSS pixels. */
  const polylineDistancePx = (
    poly: Float32Array,
    cursor: { x: number; y: number },
  ): number => {
    let best = Infinity;
    if (poly.length < 6) return best;
    let prev: { x: number; y: number; behind: boolean } | null = projectToPx(
      worldA,
      poly[0],
      poly[1],
      poly[2],
    );
    for (let i = 1; i < poly.length / 3; i++) {
      const curr = projectToPx(
        worldB,
        poly[3 * i],
        poly[3 * i + 1],
        poly[3 * i + 2],
      );
      if (prev && !prev.behind && !curr.behind) {
        const d = pointToSegmentDistance(
          cursor.x,
          cursor.y,
          prev.x,
          prev.y,
          curr.x,
          curr.y,
        );
        if (d < best) best = d;
      }
      prev = { x: curr.x, y: curr.y, behind: curr.behind };
    }
    return best;
  };

  const findEdgeHit = (cursor: { x: number; y: number }): EdgeHit | null => {
    // Box the result in a single-slot object so TypeScript's control-flow
    // analysis doesn't narrow `best` to `null` after the closure callback
    // (it can't reason across callback boundaries). Using a property write
    // sidesteps that without resorting to non-null assertions.
    const slot: {
      value: { dist: number; hit: EdgeHit } | null;
      considered: number;
      bestDistAll: number;
      totalEdges: number;
      typeHistogram: Record<string, number>;
    } = {
      value: null,
      considered: 0,
      bestDistAll: Infinity,
      totalEdges: 0,
      typeHistogram: {},
    };
    const proximity =
      pickFilter?.edgeTypes && pickFilter.edgeTypes.length > 0
        ? FILTERED_EDGE_PROXIMITY_PX
        : EDGE_PROXIMITY_PX;
    partMeshLayer.forEachVisible((partId, _mesh, topology: PartTopology) => {
      for (const edge of topology.edges) {
        // Tally pre-filter so the diagnostic shows what actually exists
        // in the scene, not just what the filter accepts. If 'circle'/'arc'
        // are missing despite the user clicking what looks like a round
        // edge, the part's geometry is classified as 'spline'/'other'
        // (e.g. revolved profile, imported step body, non-exact curve)
        // and the hover that "worked" pre-filter was a line seam, not a
        // true circular edge.
        slot.totalEdges++;
        slot.typeHistogram[edge.type] =
          (slot.typeHistogram[edge.type] ?? 0) + 1;
        if (!edgeAllowed(edge)) continue;
        slot.considered++;
        const d = polylineDistancePx(edge.polyline, cursor);
        if (d < slot.bestDistAll) slot.bestDistAll = d;
        if (d < proximity && (!slot.value || d < slot.value.dist)) {
          slot.value = { dist: d, hit: { partId, edge } };
        }
      }
    });
    edgePickDiag = {
      considered: slot.considered,
      bestDistAll: slot.bestDistAll,
      proximity,
      totalEdges: slot.totalEdges,
      typeHistogram: slot.typeHistogram,
    };
    return slot.value ? slot.value.hit : null;
  };

  const findFaceHit = (cursor: { x: number; y: number }): FaceHit | null => {
    cssToNdc(cursor);
    raycaster.setFromCamera(ndc, camera as THREE.PerspectiveCamera);

    const meshes: THREE.Mesh[] = [];
    const partIdByMeshUuid = new Map<string, string>();
    partMeshLayer.forEachVisible((partId, mesh) => {
      meshes.push(mesh);
      partIdByMeshUuid.set(mesh.uuid, partId);
    });
    if (meshes.length === 0) return null;

    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return null;
    const first = hits[0];
    const triangleIndex = first.faceIndex;
    if (triangleIndex == null) return null;

    const partId = partIdByMeshUuid.get(first.object.uuid);
    if (!partId) return null;
    const topology = partMeshLayer.getPartTopology(partId);
    if (!topology) return null;
    if (triangleIndex >= topology.faceForTriangle.length) return null;

    const faceIdx = topology.faceForTriangle[triangleIndex];
    if (faceIdx === 0xffffffff) return null;
    const face = topology.faces[faceIdx];
    if (!face) return null;
    if (!faceAllowed(face)) return null;
    return { partId, face, point: first.point.clone() };
  };

  const onMouseMove = (ev: MouseEvent): void => {
    if (pickingMode === "idle") return;
    const css = eventToCss(ev);

    if (pickingMode === "edges") {
      const hit = findEdgeHit(css);
      edgeLayer.setHover(hit ? hit.edge.polyline : null);
      faceLayer.setHover(null);
      return;
    }
    // 'faces' or 'point-on-face': hover faces.
    const hit = findFaceHit(css);
    if (!hit) {
      faceLayer.setHover(null);
      edgeLayer.setHover(null);
      return;
    }
    const mesh = partMeshLayer.getPartMesh(hit.partId);
    const positions = (
      mesh?.geometry.getAttribute("position") as THREE.BufferAttribute | null
    )?.array as Float32Array | undefined;
    const indices = (mesh?.geometry.getIndex() as THREE.BufferAttribute | null)
      ?.array as Uint32Array | undefined;
    if (!positions || !indices) {
      faceLayer.setHover(null);
      return;
    }
    faceLayer.setHover({
      triangles: hit.face.triangles,
      positions,
      indices,
    });
    edgeLayer.setHover(null);
  };

  const onMouseDown = (ev: MouseEvent): void => {
    if (pickingMode === "idle") return;
    if (ev.button !== 0) return;
    const css = eventToCss(ev);
    mouseDownAt = { x: css.x, y: css.y, shift: ev.shiftKey };
  };

  const onMouseUp = (ev: MouseEvent): void => {
    if (!mouseDownAt) return;
    if (pickingMode === "idle") {
      mouseDownAt = null;
      return;
    }
    if (ev.button !== 0) {
      mouseDownAt = null;
      return;
    }
    const css = eventToCss(ev);
    const dx = css.x - mouseDownAt.x;
    const dy = css.y - mouseDownAt.y;
    const moved = Math.hypot(dx, dy);
    const shift = mouseDownAt.shift || ev.shiftKey;
    mouseDownAt = null;
    if (moved > CLICK_PIXEL_TOL) return; // it was a drag, not a pick

    const state = store.getState();

    if (pickingMode === "edges") {
      const hit = findEdgeHit(css);
      // eslint-disable-next-line no-console
      console.log("[mate-click] edge pick", {
        hit: hit
          ? { partId: hit.partId, edgeId: hit.edge.id, edgeType: hit.edge.type }
          : null,
        filter: pickFilter,
        diag: edgePickDiag,
      });
      if (!hit) {
        if (!shift) state.clearSelection();
        return;
      }
      state.selectEdges(hit.partId, [hit.edge.id], shift);
      return;
    }

    // 'faces' or 'point-on-face' modes
    const hit = findFaceHit(css);
    // eslint-disable-next-line no-console
    console.log("[mate-click] face pick", {
      hit: hit
        ? { partId: hit.partId, faceId: hit.face.id, faceType: hit.face.type }
        : null,
      filter: pickFilter,
      mode: pickingMode,
    });
    if (!hit) {
      if (!shift) state.clearSelection();
      return;
    }

    if (pickingMode === "faces") {
      state.selectFace(hit.partId, hit.face.id);
      return;
    }

    // 'point-on-face': second click on the same selected face commits the UV.
    const sel: Selection = state.selection;
    const sameFaceSelected =
      sel?.kind === "face" &&
      sel.partId === hit.partId &&
      sel.faceId === hit.face.id;
    if (sameFaceSelected && hit.face.planeBasis) {
      const basis = hit.face.planeBasis;
      const dx0 = hit.point.x - basis.origin[0];
      const dy0 = hit.point.y - basis.origin[1];
      const dz0 = hit.point.z - basis.origin[2];
      const u =
        dx0 * basis.u[0] + dy0 * basis.u[1] + dz0 * basis.u[2];
      const v =
        dx0 * basis.v[0] + dy0 * basis.v[1] + dz0 * basis.v[2];
      state.selectPointOnFace(hit.partId, hit.face.id, [u, v]);
    } else {
      // First click selects the face (no UV yet).
      state.selectFace(hit.partId, hit.face.id);
    }
  };

  const onMouseLeave = (): void => {
    edgeLayer.setHover(null);
    faceLayer.setHover(null);
    mouseDownAt = null;
  };

  domElement.addEventListener("mousemove", onMouseMove);
  domElement.addEventListener("mousedown", onMouseDown);
  // mouseup on window so a drag that ended off the canvas still resets state.
  window.addEventListener("mouseup", onMouseUp);
  domElement.addEventListener("mouseleave", onMouseLeave);

  return {
    setResolution: (w, h) => {
      widthPx = w;
      heightPx = h;
    },
    dispose: () => {
      unsubscribe();
      domElement.removeEventListener("mousemove", onMouseMove);
      domElement.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      domElement.removeEventListener("mouseleave", onMouseLeave);
    },
  };
}

/** Squared 2-D distance from a point to a line segment, returning the
 *  unsquared min distance. */
function pointToSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const segLenSq = dx * dx + dy * dy;
  if (segLenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / segLenSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}
