// Imperative builder for sketch primitive rendering using Line2 / LineGeometry
// / LineMaterial. One renderer instance manages: zero-or-one in-flight dashed
// rubber-band, plus the committed solid-orange primitive lines for the active
// (un-finished) sketch. The persistent post-finish overlay is handled
// separately by `finishedSketchesLayer.ts`.
//
// Why Line2 instead of THREE.Line: GPU line width on the default Line is
// pinned to 1px on most platforms regardless of `linewidth`. Line2 implements
// thick lines as instanced quads in a screen-space shader, which gives us
// reliable 1.5–2px lines and dashed patterns.

import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/webgpu/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { Line2NodeMaterial } from "three/webgpu";
import type { SketchPrimitive } from "@/state/schemas";
import { planeToWorld, type CardinalPlane } from "./plane";
import { arcSegmentCount, sampleArcPoints } from "./arcGeometry";

const ORANGE = 0xff6b1a;

const COMMITTED_OPTIONS = {
  color: ORANGE,
  linewidth: 2.0,
  opacity: 1.0,
  dashed: false,
  dashSize: 0,
  gapSize: 0,
} as const;

const IN_FLIGHT_OPTIONS = {
  color: ORANGE,
  linewidth: 1.5,
  opacity: 0.7,
  dashed: true,
  dashSize: 0.5,
  gapSize: 0.3,
} as const;

const CIRCLE_SEGMENTS = 64;

type LineStyle = {
  color: number;
  linewidth: number;
  opacity: number;
  dashed: boolean;
  dashSize: number;
  gapSize: number;
};

type ManagedLine = {
  line: Line2;
  geometry: LineGeometry;
  material: Line2NodeMaterial;
};

function setMaterialResolution(
  m: Line2NodeMaterial,
  widthPx: number,
  heightPx: number,
): void {
  // Older Line2NodeMaterial revisions expose `.resolution` directly; newer
  // ones bind it via the viewport node. Guard so either works without
  // crashing.
  const r = (m as unknown as {
    resolution?: { set: (w: number, h: number) => void };
  }).resolution;
  r?.set(widthPx, heightPx);
}

export type SketchPrimitiveRenderer = {
  /** Group to add to the scene; owns all lines for this renderer. */
  group: THREE.Group;
  setPlane: (plane: CardinalPlane) => void;
  setInFlight: (primitive: SketchPrimitive | null) => void;
  setCommitted: (primitives: ReadonlyArray<SketchPrimitive>) => void;
  setResolution: (widthPx: number, heightPx: number) => void;
  dispose: () => void;
};

/**
 * Build a renderer for the active sketch. Caller adds `group` to the scene.
 */
export function createSketchPrimitiveRenderer(
  initialPlane: CardinalPlane,
  initialResolution: { widthPx: number; heightPx: number },
): SketchPrimitiveRenderer {
  const group = new THREE.Group();
  group.name = "ActiveSketchPrimitives";
  // Render after the sketch overlay (renderOrder 10) so primitives are
  // always visible on top of the plane indicator and grid.
  group.renderOrder = 20;

  let plane: CardinalPlane = initialPlane;
  let inFlight: ManagedLine | null = null;
  const committed: ManagedLine[] = [];
  let widthPx = Math.max(1, initialResolution.widthPx);
  let heightPx = Math.max(1, initialResolution.heightPx);

  const setResolution = (w: number, h: number): void => {
    widthPx = Math.max(1, w);
    heightPx = Math.max(1, h);
    if (inFlight) setMaterialResolution(inFlight.material, widthPx, heightPx);
    for (const m of committed) {
      setMaterialResolution(m.material, widthPx, heightPx);
    }
  };

  const setInFlight = (primitive: SketchPrimitive | null): void => {
    if (inFlight) {
      group.remove(inFlight.line);
      disposeManaged(inFlight);
      inFlight = null;
    }
    if (!primitive) return;
    inFlight = buildManagedLine(primitive, plane, IN_FLIGHT_OPTIONS, {
      widthPx,
      heightPx,
    });
    if (inFlight) group.add(inFlight.line);
  };

  const setCommitted = (primitives: ReadonlyArray<SketchPrimitive>): void => {
    for (const m of committed) {
      group.remove(m.line);
      disposeManaged(m);
    }
    committed.length = 0;
    for (const p of primitives) {
      const m = buildManagedLine(p, plane, COMMITTED_OPTIONS, {
        widthPx,
        heightPx,
      });
      if (m) {
        committed.push(m);
        group.add(m.line);
      }
    }
  };

  const setPlane = (next: CardinalPlane): void => {
    plane = next;
    // Rebuild every line so positions match the new plane orientation.
    if (inFlight) {
      const prim = inFlight.line.userData.primitive as SketchPrimitive;
      group.remove(inFlight.line);
      disposeManaged(inFlight);
      inFlight = buildManagedLine(prim, plane, IN_FLIGHT_OPTIONS, {
        widthPx,
        heightPx,
      });
      if (inFlight) group.add(inFlight.line);
    }
    const oldCommitted = committed.map(
      (m) => m.line.userData.primitive as SketchPrimitive,
    );
    setCommitted(oldCommitted);
  };

  const dispose = (): void => {
    if (inFlight) {
      group.remove(inFlight.line);
      disposeManaged(inFlight);
      inFlight = null;
    }
    for (const m of committed) {
      group.remove(m.line);
      disposeManaged(m);
    }
    committed.length = 0;
  };

  return {
    group,
    setPlane,
    setInFlight,
    setCommitted,
    setResolution,
    dispose,
  };
}

/**
 * Public helper used by `finishedSketchesLayer.ts` so it doesn't need to
 * duplicate the primitive→positions geometry logic. Builds a single Line2
 * with the supplied style.
 */
export function buildPrimitiveLine(
  primitive: SketchPrimitive,
  plane: CardinalPlane,
  style: LineStyle,
  resolution: { widthPx: number; heightPx: number },
): { line: Line2; dispose: () => void } | null {
  const m = buildManagedLine(primitive, plane, style, resolution);
  if (!m) return null;
  return {
    line: m.line,
    dispose: () => disposeManaged(m),
  };
}

// ---- internals ----

function buildManagedLine(
  primitive: SketchPrimitive,
  plane: CardinalPlane,
  style: LineStyle,
  resolution: { widthPx: number; heightPx: number },
): ManagedLine | null {
  const flatPositions = primitiveToFlatPositions(primitive, plane);
  if (!flatPositions || flatPositions.length < 6) return null;

  const geometry = new LineGeometry();
  geometry.setPositions(flatPositions);

  const material = new Line2NodeMaterial({
    color: style.color,
    linewidth: style.linewidth,
    opacity: style.opacity,
    transparent: true,
    dashed: style.dashed,
    dashSize: style.dashSize,
    gapSize: style.gapSize,
    worldUnits: false,
    depthTest: true,
    alphaToCoverage: false,
    // Line2NodeMaterial defaults to NoBlending under WebGPU which silently
    // drops opacity — force NormalBlending so the rubber-band's 0.7 opacity
    // and the committed lines actually render.
    blending: THREE.NormalBlending,
  });
  setMaterialResolution(
    material,
    Math.max(1, resolution.widthPx),
    Math.max(1, resolution.heightPx),
  );

  const line = new Line2(geometry, material);
  line.userData.primitive = primitive;
  // Per Three.js docs: Line2 needs computeLineDistances() for any dashed
  // rendering, and it's a no-op for solid lines so always safe to call.
  line.computeLineDistances();
  return { line, geometry, material };
}

/**
 * Flatten a primitive's plane-local UVs into a flat [x,y,z, x,y,z, ...] array
 * in world coordinates for the chosen plane. Handles closed shapes (rectangle,
 * circle) by repeating the first point at the end.
 */
function primitiveToFlatPositions(
  primitive: SketchPrimitive,
  plane: CardinalPlane,
): number[] | null {
  switch (primitive.type) {
    case "line":
      return [
        ...uvToWorld(plane, primitive.start),
        ...uvToWorld(plane, primitive.end),
      ];

    case "rectangle": {
      const { corner, width, height } = primitive;
      const [x, y] = corner;
      const corners: Array<[number, number]> = [
        [x, y],
        [x + width, y],
        [x + width, y + height],
        [x, y + height],
        [x, y], // closed
      ];
      return corners.flatMap((c) => uvToWorld(plane, c));
    }

    case "circle": {
      const out: number[] = [];
      for (let i = 0; i <= CIRCLE_SEGMENTS; i++) {
        const a = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
        const u = primitive.centre[0] + primitive.radius * Math.cos(a);
        const v = primitive.centre[1] + primitive.radius * Math.sin(a);
        out.push(...uvToWorld(plane, [u, v]));
      }
      return out;
    }

    case "arc": {
      const segs = arcSegmentCount({
        centre: primitive.centre,
        radius: primitive.radius,
        startAngle: primitive.startAngle,
        endAngle: primitive.endAngle,
      });
      const points = sampleArcPoints(
        {
          centre: primitive.centre,
          radius: primitive.radius,
          startAngle: primitive.startAngle,
          endAngle: primitive.endAngle,
        },
        segs,
      );
      return points.flatMap((p) => uvToWorld(plane, p));
    }
  }
}

function uvToWorld(
  plane: CardinalPlane,
  uv: readonly [number, number],
): [number, number, number] {
  const v = planeToWorld(plane, uv);
  return [v.x, v.y, v.z];
}

function disposeManaged(m: ManagedLine): void {
  m.geometry.dispose();
  m.material.dispose();
}
