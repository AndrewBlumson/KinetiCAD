# KinetiCAD

Browser-native parametric CAD with B-rep geometry and live physics simulation.

Built during the Replit 10 Buildathon (May 2026) by Andrew Blumson (@AndrewBlumson) using Replit Agent. Co-built with Kevin Blumson (@KevinBlumson).

## Live demo

https://kineticad.replit.app

Landing page: https://kineticad.replit.app/ — Terms of Service at `/terms`, Privacy Policy at `/privacy`.

Two pre-built demo assemblies load from the browser console:

```
window.loadSeed('windmill')
window.loadSeed('orrery')
```

`windmill` is a single motor-driven revolute joint, used as the physics regression canary. `orrery` is a 13-body solar-system mechanism with 12 motorised revolute joints.

## Stack

- React 19, Vite 8, TypeScript 6
- Three.js r184 with WebGPURenderer
- OpenCascade.js 2.0.0-beta.94e2944 for B-rep geometry, in a Web Worker via Comlink
- Rapier3D 0.12.0 for physics, in a separate Web Worker
- Zustand state, Tailwind, Sonner toasts, Howler.js
- Coordinate system: Z-up, millimetre units. Locale: en-GB.

## What works

Modeller:

- Sketching on the global XY, XZ and YZ planes (line, rectangle, three-point arc, circle) with a snap engine
- Extrude and Revolve features, with forward, backward and symmetric extrude directions
- Modifier features: Fillet, Chamfer, Hole
- Boolean operations at assembly level: Union, Subtract, Intersect
- Multi-part assemblies with per-part visibility and a translate/rotate transform gizmo
- Edge and face picking for mate creation
- Five mate types: Revolute, Prismatic, Spherical, Fixed, Planar
- Motor configuration in RPM on Revolute and Prismatic mates
- Save and Load: full assembly state to and from a JSON file

Physics:

- Real-time rigid-body simulation via Rapier3D, driven by the mate joints
- Four mate types actuate in simulation: Revolute, Prismatic, Spherical, Fixed
- Motorised joints sustain a commanded velocity
- Mass properties derived from the B-rep geometry

File interop:

- STL export, binary
- STEP import, single-part and multi-part assembly
- STEP export
- Full STEP round-trip with geometry, hierarchy and relative positions preserved
- Imported parts auto-grounded to the Z=0 plane

The build follows a 12-phase spec; phases 0 to 9 are complete, with later post-phase work covering the seed registry, the orrery, and Save/Load. See `replit.md` at the repository root for the phase-by-phase log.

## Verified

### Windmill physics canary

The windmill seed is the standing physics regression test. Target: 30 RPM, which is pi rad/s, 3.141592653589793.

| Channel | Value |
|---|---|
| bodyBangvelMag | 3.14159270 to 3.14159298 |
| bodyBangvel.x | approximately 3e-16 (floating-point precision floor) |
| bodyBangvel.y | approximately 4e-10 (floating-point precision floor) |
| bodyBangvel.z | 3.14159 (pure Z-axis rotation) |

Stable to plus or minus 5e-7 rad/s with no drift. Off-axis components sit at the single-precision floor.

### Multi-mate kinematic chains

The orrery seed runs 13 rigid bodies connected by 12 motorised revolute joints in nested chains: planet arms on a central hub, with moons on three of the planet arms. It confirms the mate and motor system holds up under a non-trivial multi-joint assembly.

### File interop (08/05/2026)

STL export: the windmill STL renders correctly in macOS Preview; a programmatic check confirms binary format, 408 triangles, 20,484 bytes, watertight per part, zero degenerate triangles. Bambu Studio sliced it to a complete print plan.

STEP import: a McMaster-Carr M3 socket-head screw (91290A115) imported as a single grounded part; a McMaster-Carr torque-limiting coupling (9132K11) imported as a 12-part assembly with relative positions preserved.

STEP round-trip: KinetiCAD-exported STEP files re-import cleanly with geometry, hierarchy and relative positions intact.

## Known issues and limitations

### STEP format limitations (apply to all CAD tools)

STEP files do not carry mate or joint information. Round-tripping an assembly through STEP loses the kinematic relationships; mates must be re-established after import. This affects Onshape, SolidWorks and Fusion equally.

STEP export flattens compound-of-solids hierarchy. Geometry is preserved, sub-assembly grouping is lost.

### KinetiCAD-specific

Imported STEP parts do not survive a page refresh. B-rep shapes live in WebAssembly memory, which clears on reload. Sketch-based parts survive because the feature regeneration pipeline rebuilds them; imported parts have no regeneration path. Save and Load persists sketch-based parts, features and mates, but not imported B-rep geometry. An IndexedDB layer for raw STEP bytes is on the roadmap.

Imported parts are named after the source filename. STEP files do carry a PRODUCT entity name per component, but reading it back is not possible in this OpenCascade.js binding. This was investigated and confirmed to be a binding limitation, not a roadmap item. File-stem naming is permanent documented behaviour.

Arc-edge pivots: the underlying fix is in. topology.ts now emits the true geometric circle centre for circle and arc edges; previously the centre was computed but never written to the emitted metadata, so callers fell back to an arc centroid that is offset for partial arcs. The windmill canary holds pi after this fix. The end-to-end pick path for a partial-arc edge, that is, clicking an arc on a cut rim through the mate inspector, is not yet verified.

Other known issues:

- Boolean result meshes can be selected only from the BOOLEANS sidebar, not by clicking in the 3D view
- The Hole feature position-picker clears the face selection on the second click
- Sketch profiles cannot contain multiple closed loops, for example a plate with a hole
- Sketches can be created only on the global XY, XZ and YZ planes; sketch on a selected face is not implemented
- The Planar mate can be created in the Modeller but does not actuate in simulation; Rapier 0.12 has no native planar joint
- No undo/redo

### Not yet covered

A contribution to-do list for anyone wanting to extend test coverage:

- Cross-browser testing beyond Chrome and Safari
- Performance on assemblies larger than a handful of parts
- Mobile, currently unsupported: WebGPU only, no WebGL2 fallback

## Roadmap and contribution opportunities

Pull requests are genuinely welcome. The most useful contributions:

- IndexedDB persistence so imported STEP parts survive a page refresh
- End-to-end verification of the arc-edge pivot pick path
- Multi-loop sketch profiles (plates with holes, ring shapes)
- Sketch on a selected face
- Hole feature position-pick fix
- IGES import and export for wider CAD interop
- Undo/redo via Zustand history middleware
- WebGL2 fallback for browsers without WebGPU
- Mobile responsive layout
- 3D click-to-select on boolean result meshes

CAD or graphics experience is particularly valuable on the sketch-on-face, multi-loop sketch and arc-pivot items.

## Demo files for testing

Real-world STEP files for verification, all free:

- McMaster-Carr: industrial parts catalogue. Search any part number, open Product CAD, download the STEP file. Good single-part and assembly test cases include 91290A115 (M3 socket-head screw) and 9132K11 (torque-limiting coupling).
- GrabCAD: community-uploaded parts and assemblies, free with signup.

## Local development

```
git clone https://github.com/AndrewBlumson/KinetiCAD.git
cd KinetiCAD
pnpm install
cd artifacts/kineticad
pnpm dev
```

The dev server runs at http://localhost:5173. WebGPU is required: use Chrome on an M-series Mac. The Replit preview iframe does not support WebGPU and will show a "WebGPU required" message; test on the deployed URL instead.

Build for production with `pnpm build`.

## Built with

Replit and Replit Agent.

## Author

Andrew Blumson (@AndrewBlumson on GitHub and X). Adevious AI Ltd. UK Replit Ambassador. Co-built with Kevin Blumson (@KevinBlumson).

## Licence

MIT. See LICENSE for the full text.

## Acronym index

B-rep: Boundary Representation
CAD: Computer-Aided Design
IGES: Initial Graphics Exchange Specification
JSON: JavaScript Object Notation
MIT: Massachusetts Institute of Technology
RPM: Revolutions Per Minute
STEP: Standard for the Exchange of Product Model Data
STL: Stereolithography
URL: Uniform Resource Locator
WebGPU: browser graphics and compute API
