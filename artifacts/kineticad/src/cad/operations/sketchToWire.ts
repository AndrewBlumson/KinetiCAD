// Build a closed OCCT TopoDS_Wire from a list of 2D sketch primitives.
//
// The sketch is on a cardinal plane (XY/XZ/YZ), so we lift each 2D point
// (u, v) into world coordinates before constructing OCCT geometry. The
// resulting wire is the topological boundary used as input to extrude /
// revolve operations.
//
// Algorithm:
//   1. Expand each primitive into one or more "raw edges", each tagged with
//      its 3D start and end world points (or marked closed for circles).
//   2. Special-case: a sketch consisting of a single circle is its own
//      closed wire — build it directly.
//   3. Mixed sketches that contain a closed primitive (circle) are rejected
//      because they cannot share endpoints with anything else.
//   4. Walk the raw edges to order them end-to-end, allowing edges to be
//      reversed to fit the chain. Two endpoints within VERTEX_TOL_MM are
//      treated as the same vertex.
//   5. Build OCCT edges in chain order from each primitive's geometry, add
//      them to a BRepBuilderAPI_MakeWire, and verify the resulting wire is
//      closed.
//
// Memory hygiene: every gp_Pnt / gp_Dir / gp_Ax2 / gp_Circ / MakeEdge /
// MakeWire we instantiate is `.delete()`-d before return. The returned
// TopoDS_Wire is owned by the caller and must be `.delete()`-d after use.

import type { CardinalPlane } from "@/sketch/plane";
import type { SketchPrimitive } from "@/state/schemas";

/** Two endpoints within this distance (mm) are considered coincident. */
export const VERTEX_TOL_MM = 0.001;

type Vec3 = readonly [number, number, number];

type RawEdge = {
  /** True iff this primitive forms a complete closed wire on its own. */
  closed: boolean;
  /** Start point in world space. Unused when closed. */
  start: Vec3;
  /** End point in world space. Unused when closed. */
  end: Vec3;
  /**
   * Build the OCCT TopoDS_Edge for this primitive in its natural direction.
   * Returns the edge wrapper (caller responsible for `.delete()`-ing it
   * after adding to the wire). The returned object is `any` because the
   * OCCT-typed surface is opaque.
   */
  build: () => any;
};

/** Compute the 3D world-space position for a [u, v] point on the given plane. */
function planeToWorld3D(plane: CardinalPlane, uv: readonly [number, number]): Vec3 {
  const [u, v] = uv;
  switch (plane) {
    case "XY":
      return [u, v, 0];
    case "XZ":
      return [u, 0, v];
    case "YZ":
      return [0, u, v];
  }
}

/** Outward normal to the given plane in world space (right-hand rule). */
export function planeNormal(plane: CardinalPlane): Vec3 {
  switch (plane) {
    case "XY":
      return [0, 0, 1];
    case "XZ":
      return [0, 1, 0];
    case "YZ":
      return [1, 0, 0];
  }
}

function distSq(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}

function pointsEq(a: Vec3, b: Vec3): boolean {
  return distSq(a, b) <= VERTEX_TOL_MM * VERTEX_TOL_MM;
}

/** Build a gp_Pnt and a small disposer for it. */
function makePnt(oc: any, p: Vec3): any {
  return new oc.gp_Pnt_3(p[0], p[1], p[2]);
}

function expandPrimitive(
  oc: any,
  plane: CardinalPlane,
  prim: SketchPrimitive,
): RawEdge[] {
  switch (prim.type) {
    case "line": {
      const start = planeToWorld3D(plane, prim.start);
      const end = planeToWorld3D(plane, prim.end);
      return [
        {
          closed: false,
          start,
          end,
          build: () => {
            const p1 = makePnt(oc, start);
            const p2 = makePnt(oc, end);
            try {
              const builder = new oc.BRepBuilderAPI_MakeEdge_3(p1, p2);
              const edge = builder.Edge();
              builder.delete();
              return edge;
            } finally {
              p1.delete();
              p2.delete();
            }
          },
        },
      ];
    }

    case "rectangle": {
      // 4 lines in CCW order around the corners.
      const [cu, cv] = prim.corner;
      const c0 = planeToWorld3D(plane, [cu, cv]);
      const c1 = planeToWorld3D(plane, [cu + prim.width, cv]);
      const c2 = planeToWorld3D(plane, [cu + prim.width, cv + prim.height]);
      const c3 = planeToWorld3D(plane, [cu, cv + prim.height]);
      const corners: Array<[Vec3, Vec3]> = [
        [c0, c1],
        [c1, c2],
        [c2, c3],
        [c3, c0],
      ];
      return corners.map(([s, e]) => ({
        closed: false,
        start: s,
        end: e,
        build: () => {
          const p1 = makePnt(oc, s);
          const p2 = makePnt(oc, e);
          try {
            const builder = new oc.BRepBuilderAPI_MakeEdge_3(p1, p2);
            const edge = builder.Edge();
            builder.delete();
            return edge;
          } finally {
            p1.delete();
            p2.delete();
          }
        },
      }));
    }

    case "arc": {
      const [cu, cv] = prim.centre;
      const startUV: [number, number] = [
        cu + prim.radius * Math.cos(prim.startAngle),
        cv + prim.radius * Math.sin(prim.startAngle),
      ];
      const endUV: [number, number] = [
        cu + prim.radius * Math.cos(prim.endAngle),
        cv + prim.radius * Math.sin(prim.endAngle),
      ];
      const start = planeToWorld3D(plane, startUV);
      const end = planeToWorld3D(plane, endUV);
      const centre = planeToWorld3D(plane, prim.centre);
      const normal = planeNormal(plane);
      return [
        {
          closed: false,
          start,
          end,
          build: () => {
            const c = makePnt(oc, centre);
            const dir = new oc.gp_Dir_4(normal[0], normal[1], normal[2]);
            const ax2 = new oc.gp_Ax2_3(c, dir);
            const circ = new oc.gp_Circ_2(ax2, prim.radius);
            try {
              const builder = new oc.BRepBuilderAPI_MakeEdge_9(
                circ,
                prim.startAngle,
                prim.endAngle,
              );
              const edge = builder.Edge();
              builder.delete();
              return edge;
            } finally {
              circ.delete();
              ax2.delete();
              dir.delete();
              c.delete();
            }
          },
        },
      ];
    }

    case "circle": {
      const centre = planeToWorld3D(plane, prim.centre);
      const normal = planeNormal(plane);
      return [
        {
          closed: true,
          start: centre, // unused for closed primitives
          end: centre,
          build: () => {
            const c = makePnt(oc, centre);
            const dir = new oc.gp_Dir_4(normal[0], normal[1], normal[2]);
            const ax2 = new oc.gp_Ax2_3(c, dir);
            const circ = new oc.gp_Circ_2(ax2, prim.radius);
            try {
              const builder = new oc.BRepBuilderAPI_MakeEdge_8(circ);
              const edge = builder.Edge();
              builder.delete();
              return edge;
            } finally {
              circ.delete();
              ax2.delete();
              dir.delete();
              c.delete();
            }
          },
        },
      ];
    }
  }
}

/**
 * Order raw edges end-to-end, flipping individual edges as needed to make a
 * connected loop. Throws if no chain is possible.
 *
 * Returns an array of `{ raw, reversed }` in chain order. The chain's last
 * edge's tail must coincide (within VERTEX_TOL_MM) with the first edge's head;
 * otherwise the wire is open.
 */
function orderEdges(edges: RawEdge[]): Array<{ raw: RawEdge; reversed: boolean }> {
  if (edges.length === 0) return [];

  const used = new Array<boolean>(edges.length).fill(false);
  const chain: Array<{ raw: RawEdge; reversed: boolean }> = [];

  // Seed with the first edge in its natural direction.
  used[0] = true;
  chain.push({ raw: edges[0], reversed: false });
  let currentEnd: Vec3 = edges[0].end;

  while (chain.length < edges.length) {
    let foundIdx = -1;
    let foundReversed = false;
    for (let i = 0; i < edges.length; i++) {
      if (used[i]) continue;
      const e = edges[i];
      if (pointsEq(e.start, currentEnd)) {
        foundIdx = i;
        foundReversed = false;
        break;
      }
      if (pointsEq(e.end, currentEnd)) {
        foundIdx = i;
        foundReversed = true;
        break;
      }
    }
    if (foundIdx === -1) {
      throw new Error(
        "Sketch has gap: no primitive connects to the current chain end. " +
          "Use endpoint snap when drawing.",
      );
    }
    const e = edges[foundIdx];
    used[foundIdx] = true;
    chain.push({ raw: e, reversed: foundReversed });
    currentEnd = foundReversed ? e.start : e.end;
  }

  return chain;
}

/**
 * Build a closed TopoDS_Wire from the given sketch primitives. Throws on
 * empty / open / gappy sketches with a message safe to surface to the UI.
 *
 * Caller owns the returned wire and must `.delete()` it.
 */
export function sketchToWire(
  oc: unknown,
  plane: CardinalPlane,
  primitives: SketchPrimitive[],
): unknown {
  const ocAny = oc as any;

  if (primitives.length === 0) {
    throw new Error("Sketch is empty.");
  }

  // Expand all primitives into raw edges first so we can validate before
  // touching OCCT for the real edge build.
  const rawAll = primitives.flatMap((p) => expandPrimitive(ocAny, plane, p));

  const closedOnes = rawAll.filter((e) => e.closed);
  const openOnes = rawAll.filter((e) => !e.closed);

  if (closedOnes.length > 0 && openOnes.length > 0) {
    throw new Error(
      "Sketch mixes a circle with other primitives. Draw the closed shape on its own.",
    );
  }
  if (closedOnes.length > 1) {
    throw new Error(
      "Sketch has multiple closed primitives. Only one closed loop is supported.",
    );
  }

  // Closed-only path: a single circle becomes its own wire.
  if (closedOnes.length === 1) {
    const edge = closedOnes[0].build();
    const wireBuilder = new ocAny.BRepBuilderAPI_MakeWire_1();
    try {
      wireBuilder.Add_1(edge);
      if (!wireBuilder.IsDone()) {
        throw new Error("Failed to build wire from closed primitive.");
      }
      const wire = wireBuilder.Wire();
      // Sanity: a circle wire should always report closed.
      if (!wire.Closed()) {
        wire.delete();
        throw new Error("Circle wire reported as open by OCCT (unexpected).");
      }
      return wire;
    } finally {
      edge.delete();
      wireBuilder.delete();
    }
  }

  // Open-edge path: order, build, and assemble.
  const chain = orderEdges(openOnes);
  // Final closure check before paying the OCCT edge-build cost.
  const firstStart = chain[0].reversed ? chain[0].raw.end : chain[0].raw.start;
  const last = chain[chain.length - 1];
  const lastEnd = last.reversed ? last.raw.start : last.raw.end;
  if (!pointsEq(firstStart, lastEnd)) {
    throw new Error(
      "Sketch is not closed. The last endpoint must meet the first within " +
        `${VERTEX_TOL_MM} mm.`,
    );
  }

  const wireBuilder = new ocAny.BRepBuilderAPI_MakeWire_1();
  const builtEdges: any[] = [];
  try {
    for (const { raw, reversed } of chain) {
      const edge = raw.build();
      builtEdges.push(edge);
      if (reversed) {
        // edge.Reversed() returns a TopoDS_Shape with TopAbs_REVERSED
        // orientation. We must wrap as a TopoDS_Edge for MakeWire. Each
        // step here can throw, so the shape and edge wrappers each get
        // their own try/finally to guarantee cleanup.
        const reversedShape = edge.Reversed();
        try {
          const reversedEdge = ocAny.TopoDS.Edge_1(reversedShape);
          try {
            wireBuilder.Add_1(reversedEdge);
          } finally {
            reversedEdge.delete();
          }
        } finally {
          reversedShape.delete();
        }
      } else {
        wireBuilder.Add_1(edge);
      }
    }
    if (!wireBuilder.IsDone()) {
      throw new Error(
        "Failed to assemble wire — OCCT rejected one of the edges.",
      );
    }
    const wire = wireBuilder.Wire();
    if (!wire.Closed()) {
      wire.delete();
      throw new Error(
        "Sketch is not closed. Use endpoint snap so adjacent primitives share endpoints.",
      );
    }
    return wire;
  } finally {
    for (const e of builtEdges) e.delete();
    wireBuilder.delete();
  }
}
