// Persistent overlay for sketches that have been finished and pushed into
// the assembly. Renders each Sketch in `assembly.parts[].sketches` as a thin
// orange overlay. Sketch geometry is local to its part, just like CAD meshes.
// Consumed profiles stay hidden unless selected; unused sketches remain visible.
//
// Rebuilds whenever the assembly changes. This naturally covers:
// - finishing a sketch in this session
// - reloading from localStorage (the rehydrated assembly triggers a sync)
// - cancelling (no change, layer remains as-is)

import * as THREE from "three";
import type { Assembly, Sketch, SketchPrimitive } from "@/state/schemas";
import { isCardinalPlane, type CardinalPlane } from "./plane";
import { buildPrimitiveLine } from "./sketchPrimitiveRenderer";

const FINISHED_STYLE = {
  color: 0xff6b1a,
  linewidth: 1.5,
  opacity: 0.6,
  dashed: false,
  dashSize: 0,
  gapSize: 0,
} as const;

type SketchEntry = {
  sketchId: string;
  primitiveSig: string;
  plane: CardinalPlane;
  group: THREE.Group;
  disposers: Array<() => void>;
};

export type FinishedSketchesLayer = {
  group: THREE.Group;
  sync: (assembly: Assembly, selectedSketch?: { partId: string; sketchId: string } | null) => void;
  setResolution: (widthPx: number, heightPx: number) => void;
  dispose: () => void;
};

export function createFinishedSketchesLayer(
  initialResolution: { widthPx: number; heightPx: number },
): FinishedSketchesLayer {
  const group = new THREE.Group();
  group.name = "FinishedSketchesLayer";
  group.renderOrder = 15;

  const entries = new Map<string, SketchEntry>();
  let widthPx = Math.max(1, initialResolution.widthPx);
  let heightPx = Math.max(1, initialResolution.heightPx);

  const sync: FinishedSketchesLayer['sync'] = (assembly, selectedSketch) => {
    const seen = new Set<string>();

    for (const part of assembly.parts) {
      const consumed = new Set(part.features.flatMap((feature) =>
        feature.type === 'extrude' || feature.type === 'revolve' ? [feature.sketchId] : [],
      ));
      for (const sketch of part.sketches) {
        if (!isCardinalPlane(sketch.plane)) continue; // skip custom planes (later phases)
        const key = `${part.id}:${sketch.id}`;
        seen.add(key);

        const sig = primitiveSig(sketch.primitives);
        let entry = entries.get(key);
        if (entry && (entry.primitiveSig !== sig || entry.plane !== sketch.plane)) {
          removeEntry(entry);
          entries.delete(key);
          entry = undefined;
        }
        if (!entry) {
          entry = buildSketchEntry(sketch, sketch.plane, { widthPx, heightPx });
          entries.set(key, entry);
          group.add(entry.group);
        }
        // Reconcile transforms even when primitive geometry is unchanged.
        // Previously the cache fast path left translated/rotated sketches at
        // the global origin, including the gyroscope's rings 98 mm below it.
        entry.group.position.fromArray(part.transform.positionMm);
        const [rx, ry, rz] = part.transform.rotationDeg.map(THREE.MathUtils.degToRad);
        entry.group.rotation.set(rx, ry, rz, 'XYZ');
        entry.group.visible = part.visible && (!consumed.has(sketch.id) ||
          (selectedSketch?.partId === part.id && selectedSketch.sketchId === sketch.id));
      }
    }

    // Remove sketches that no longer exist.
    for (const [id, entry] of entries) {
      if (!seen.has(id)) {
        removeEntry(entry);
        entries.delete(id);
      }
    }
  };

  const setResolution = (w: number, h: number): void => {
    widthPx = Math.max(1, w);
    heightPx = Math.max(1, h);
    group.traverse((obj) => {
      const mat =
        (obj as { material?: { resolution?: THREE.Vector2 } }).material;
      if (mat && mat.resolution) {
        mat.resolution.set(widthPx, heightPx);
      }
    });
  };

  const dispose = (): void => {
    for (const [, entry] of entries) removeEntry(entry);
    entries.clear();
  };

  const removeEntry = (entry: SketchEntry): void => {
    group.remove(entry.group);
    for (const d of entry.disposers) d();
  };

  return { group, sync, setResolution, dispose };
}

function buildSketchEntry(
  sketch: Sketch,
  plane: CardinalPlane,
  resolution: { widthPx: number; heightPx: number },
): SketchEntry {
  const sketchGroup = new THREE.Group();
  sketchGroup.name = `FinishedSketch:${sketch.id}`;
  const disposers: Array<() => void> = [];

  for (const p of sketch.primitives) {
    const built = buildPrimitiveLine(p, plane, FINISHED_STYLE, resolution);
    if (!built) continue;
    sketchGroup.add(built.line);
    disposers.push(built.dispose);
  }

  return {
    sketchId: sketch.id,
    primitiveSig: primitiveSig(sketch.primitives),
    plane,
    group: sketchGroup,
    disposers,
  };
}

/**
 * Cheap signature for a primitive list — used to detect whether a sketch's
 * geometry has changed since the last sync. Stable JSON keyed on a stable
 * primitive ordering (the array order itself).
 */
function primitiveSig(primitives: ReadonlyArray<SketchPrimitive>): string {
  return JSON.stringify(primitives);
}
