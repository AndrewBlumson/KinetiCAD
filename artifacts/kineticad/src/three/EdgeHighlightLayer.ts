// Phase 4 Split A — Edge highlight overlay.
//
// Renders thick coloured polylines on top of the part meshes for two slots:
//   - "hover": a single edge under the cursor (semi-transparent).
//   - "selected": one or more edges currently in the Selection.
//
// Implementation: three/examples webgpu Line2 + LineGeometry +
// Line2NodeMaterial (WebGPU-native; the legacy LineMaterial from
// three/examples/jsm/lines/LineMaterial.js logs
// `THREE.NodeBuilder: Material "LineMaterial" is not compatible.` per frame
// under the WebGPU renderer in r184).
//
// Line2NodeMaterial defaults to NoBlending and ignores opacity until we
// override blending — we explicitly set NormalBlending so the hover line's
// 0.6 opacity actually shows through. Resolution is auto-bound to the
// viewport node, so the legacy `material.resolution.set(w,h)` call is no
// longer required (kept guarded for forward compatibility).
//
// Lifecycle: shared materials live on the layer, geometries are recreated
// per-frame when the highlighted polyline changes. `dispose()` releases all
// of them.

import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/webgpu/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { Line2NodeMaterial } from "three/webgpu";
import { COLOURS } from "./sceneSetup";

const HOVER_COLOR = new THREE.Color(COLOURS.highlightHover ?? 0xffaa00);
const SELECTED_COLOR = new THREE.Color(COLOURS.highlightSelected ?? 0xff7700);

const HOVER_WIDTH_PX = 3;
const SELECTED_WIDTH_PX = 4;

export type EdgeHighlightLayer = {
  group: THREE.Group;
  /** Update the screen-space line width resolution; call on canvas resize. */
  setResolution: (widthPx: number, heightPx: number) => void;
  /** Show a single hover polyline (xyz triplets), or clear it with `null`. */
  setHover: (polyline: Float32Array | null) => void;
  /** Show one or more selected polylines (each xyz triplets). */
  setSelected: (polylines: Float32Array[]) => void;
  dispose: () => void;
};

function buildLine(
  polyline: Float32Array,
  material: Line2NodeMaterial,
): Line2 {
  const geom = new LineGeometry();
  geom.setPositions(Array.from(polyline));
  const line = new Line2(geom, material);
  line.computeLineDistances();
  // Render on top of the part meshes (depthTest false would be loud — we
  // settle for renderOrder + a depth-test-on material with polygon offset).
  line.renderOrder = 999;
  return line;
}

function makeHighlightMaterial(
  color: number,
  widthPx: number,
  opacity: number,
): Line2NodeMaterial {
  const mat = new Line2NodeMaterial({
    color,
    linewidth: widthPx,
    transparent: opacity < 1,
    opacity,
    depthTest: true,
    depthWrite: false,
    // Default is NoBlending under WebGPU which silently drops opacity.
    blending: THREE.NormalBlending,
  });
  // Older three.js Line2NodeMaterial revisions used `material.resolution`
  // imperatively; newer ones bind it via the viewport node. Guard so either
  // works.
  const maybeRes = (mat as unknown as {
    resolution?: { set: (w: number, h: number) => void };
  }).resolution;
  maybeRes?.set(window.innerWidth, window.innerHeight);
  return mat;
}

export function createEdgeHighlightLayer(): EdgeHighlightLayer {
  const group = new THREE.Group();
  group.name = "EdgeHighlightLayer";

  const hoverMaterial = makeHighlightMaterial(
    HOVER_COLOR.getHex(),
    HOVER_WIDTH_PX,
    0.6,
  );
  const selectedMaterial = makeHighlightMaterial(
    SELECTED_COLOR.getHex(),
    SELECTED_WIDTH_PX,
    1.0,
  );

  let hoverLine: Line2 | null = null;
  const selectedLines: Line2[] = [];

  const clearHover = (): void => {
    if (hoverLine) {
      group.remove(hoverLine);
      hoverLine.geometry.dispose();
      hoverLine = null;
    }
  };

  const clearSelected = (): void => {
    for (const l of selectedLines) {
      group.remove(l);
      l.geometry.dispose();
    }
    selectedLines.length = 0;
  };

  const setResolution = (widthPx: number, heightPx: number): void => {
    const setOn = (m: Line2NodeMaterial) => {
      const r = (m as unknown as {
        resolution?: { set: (w: number, h: number) => void };
      }).resolution;
      r?.set(widthPx, heightPx);
    };
    setOn(hoverMaterial);
    setOn(selectedMaterial);
  };

  const setHover = (polyline: Float32Array | null): void => {
    clearHover();
    if (!polyline || polyline.length < 6) return;
    hoverLine = buildLine(polyline, hoverMaterial);
    group.add(hoverLine);
  };

  const setSelected = (polylines: Float32Array[]): void => {
    clearSelected();
    for (const p of polylines) {
      if (p.length < 6) continue;
      const line = buildLine(p, selectedMaterial);
      selectedLines.push(line);
      group.add(line);
    }
  };

  const dispose = (): void => {
    clearHover();
    clearSelected();
    hoverMaterial.dispose();
    selectedMaterial.dispose();
    if (group.parent) group.parent.remove(group);
  };

  return {
    group,
    setResolution,
    setHover,
    setSelected,
    dispose,
  };
}
