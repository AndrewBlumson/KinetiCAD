// Persistent overlay for sketches that have been finished and pushed into
// the assembly. Renders each Sketch in `assembly.parts[].sketches` as a thin
// orange overlay (linewidth 1.5, opacity 0.6) visible from any camera angle,
// per the Phase 2 spec.
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
  sync: (assembly: Assembly) => void;
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

  const sync = (assembly: Assembly): void => {
    const seen = new Set<string>();

    for (const part of assembly.parts) {
      for (const sketch of part.sketches) {
        if (!isCardinalPlane(sketch.plane)) continue; // skip custom planes (later phases)
        seen.add(sketch.id);

        const sig = primitiveSig(sketch.primitives);
        const existing = entries.get(sketch.id);
        if (existing && existing.primitiveSig === sig) {
          // Geometry unchanged — nothing to do.
          continue;
        }

        // Drop the stale entry (if any) and rebuild from scratch.
        if (existing) removeEntry(existing);

        const entry = buildSketchEntry(sketch, sketch.plane, {
          widthPx,
          heightPx,
        });
        entries.set(sketch.id, entry);
        group.add(entry.group);
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
