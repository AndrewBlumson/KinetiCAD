// Map raw error messages thrown by the CAD worker (sketchToWire / extrude /
// revolve / OCCT) into user-facing copy that the inspector surfaces in red.
//
// Matches are deliberately substring-based on the messages defined in:
//   src/cad/operations/sketchToWire.ts
//   src/cad/operations/extrude.ts
//   src/cad/operations/revolve.ts
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
  [/cross(es|ing) (the )?(revolution )?axis|self.?intersect/i, "self-intersection"],
  [/extrude depth must be positive/i, "depth-invalid"],
  [/revolve angle must be in/i, "angle-invalid"],
  [
    /makeprism|makerevol|makeface|failed to (build|translate|assemble)/i,
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
