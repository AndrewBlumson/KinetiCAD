// Map raw error messages thrown by the CAD worker (sketchToWire / extrude /
// revolve / fillet / chamfer / hole / OCCT) into user-facing copy that the
// inspector surfaces in red.
//
// Matches are deliberately substring-based on the messages defined in:
//   src/cad/operations/sketchToWire.ts
//   src/cad/operations/extrude.ts
//   src/cad/operations/revolve.ts
//   src/cad/operations/fillet.ts
//   src/cad/operations/chamfer.ts
//   src/cad/operations/hole.ts
// so any future tightening of those throws still gets a sensible default.

export type KernelErrorCode =
  | "wire-not-closed"
  | "wire-empty"
  | "wire-multiple-closed"
  | "wire-mixed"
  | "wire-gap"
  | "self-intersection"
  | "depth-invalid"
  | "angle-invalid"
  | "edge-not-found"
  | "face-not-found"
  | "fillet-radius-too-large"
  | "fillet-self-intersect"
  | "chamfer-size-too-large"
  | "boolean-failed"
  | "occt-internal"
  | "unknown";

export type MappedError = { code: KernelErrorCode; message: string };

const MESSAGES: Record<KernelErrorCode, string> = {
  "wire-not-closed":
    "Sketch must be closed. Connect all endpoints before extruding.",
  "wire-empty": "Sketch is empty. Add primitives before extruding.",
  "wire-multiple-closed":
    "Sketch contains multiple closed loops. Only one loop is supported in v1.",
  "wire-mixed":
    "Sketch mixes open and closed primitives. All primitives must form a single closed loop.",
  "wire-gap":
    "Sketch has a gap. Use endpoint snap so adjacent primitives share endpoints.",
  "self-intersection":
    "Revolve failed: sketch crosses the revolution axis.",
  "depth-invalid": "Depth must be positive.",
  "angle-invalid": "Angle must be between 1° and 360°.",
  "edge-not-found":
    "One or more selected edges no longer exist on the upstream shape. Re-pick the edges.",
  "face-not-found":
    "The selected face no longer exists on the upstream shape. Re-pick the face.",
  "fillet-radius-too-large":
    "Fillet radius is too large for these edges. Try a smaller radius.",
  "fillet-self-intersect":
    "Fillet would self-intersect. Reduce the radius or pick fewer edges.",
  "chamfer-size-too-large":
    "Chamfer size is too large for these edges. Try a smaller size.",
  "boolean-failed":
    "Hole boolean operation failed. The hole may exit the part or sit on a curved area.",
  "occt-internal":
    "Operation failed. Try a simpler sketch or different parameters.",
  unknown: "Operation failed. Try a simpler sketch or different parameters.",
};

/** Pattern → code, in priority order. First match wins. */
const PATTERNS: Array<[RegExp, KernelErrorCode]> = [
  [/sketch is empty/i, "wire-empty"],
  [/multiple closed primitives/i, "wire-multiple-closed"],
  [/mixes a circle/i, "wire-mixed"],
  [/sketch is not closed|circle wire reported as open/i, "wire-not-closed"],
  [/sketch has gap|no primitive connects/i, "wire-gap"],
  [/cross(es|ing) (the )?(revolution )?axis/i, "self-intersection"],
  [/extrude depth must be positive/i, "depth-invalid"],
  [/revolve angle must be in/i, "angle-invalid"],
  [/edge-not-found/i, "edge-not-found"],
  [/face-not-found/i, "face-not-found"],
  [/fillet-self-intersect|fillet.*self.?intersect/i, "fillet-self-intersect"],
  [/fillet-radius-too-large|fillet.*radius/i, "fillet-radius-too-large"],
  [/chamfer-size-too-large|chamfer.*size/i, "chamfer-size-too-large"],
  [/boolean-failed|boolean.*fail|cut.*fail/i, "boolean-failed"],
  [
    /makeprism|makerevol|makeface|makefillet|makechamfer|makecylinder|failed to (build|translate|assemble)/i,
    "occt-internal",
  ],
];

export function mapKernelError(raw: string): MappedError {
  if (!raw) return { code: "unknown", message: MESSAGES.unknown };
  for (const [re, code] of PATTERNS) {
    if (re.test(raw)) return { code, message: MESSAGES[code] };
  }
  return { code: "unknown", message: MESSAGES.unknown };
}
