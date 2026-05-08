# KinetiCAD

Browser-native parametric CAD with B-rep geometry and live physics.

Built originally during the Replit 10 Buildathon (May 2026) by Andrew Blumson ([@AndrewBlumson](https://github.com/AndrewBlumson)) using Replit Agent. Co-built with Kevin Blumson ([@KevinBlumson](https://github.com/KevinBlumson)).

## Live demo

https://kineticad.replit.app

The pre-baked windmill demo can be loaded by pasting this in the browser console:

```js
fetch('/seed-windmill.js').then(r => r.text()).then(code => eval(code))
```

## Stack

- React 19, Vite 8, TypeScript 6
- Three.js r184 + WebGPU
- OpenCascade.js 2.0.0-beta.94e2944 (B-rep geometry, Web Worker via Comlink)
- Rapier3D 0.12.0 (physics, Web Worker)
- Zustand state, Tailwind, Sonner toasts, Howler.js
- Coordinate system: Z-up, mm units. Locale: en-GB.

## Status

Phase 4 (STEP support) complete as of 08/05/2026.

**Modeller pipeline:** sketching on global XY/XZ/YZ planes, multi-feature extrudes with boolean ops (Add/Cut/New Body), positive and negative extrude directions, face-edge picking for revolute mate creation, motor RPM configuration.

**Physics simulation:** revolute joint with motor, mathematically clean rotation about an arbitrary axis between bodies with positional offsets.

**File interop:** STL export (binary). STEP import (single-part and multi-part assembly). STEP export. Full STEP round-trip with geometry, hierarchy, and relative positions preserved. Auto-ground imported parts to the Z=0 plane.

## Verified

### Windmill canary regression

The pivot frame fix (worldToLocalPoint conversion at mate creation) was deployed and verified end-to-end on the seeded windmill demo:

Target: 30 RPM = π rad/s = 3.141592653589793

| Channel | Value |
|---|---|
| `bodyBangvelMag` | 3.14159270 to 3.14159298 (range) |
| `bodyBangvel.x` | ~3e-16 (floating point precision floor) |
| `bodyBangvel.y` | ~4e-10 (floating point precision floor) |
| `bodyBangvel.z` | 3.14159 (pure Z-axis rotation) |

Stability across 23 seconds of simulated time: ±5e-7 rad/s. Off-axis components at the precision floor. No drift.

Industrial CNC machine tolerances aim for 1e-3 to 1e-5. This is two orders of magnitude tighter.

### File interop verification (08/05/2026)

**STL export:**
- macOS Preview rendered the windmill STL correctly
- Programmatic check: binary format, 408 triangles, 20,484 bytes, watertight per-part, zero degenerate triangles
- Bambu Studio sliced 454 layers (1h13m print plan, £0.19 cost on Bambu Lab A1 with 0.20mm layer height); supported 707 layers with tree-auto

**STEP import:**
- McMaster M3 socket-head screw (91290A115): single-part imported and grounded
- McMaster torque-limiting coupling (9132K11): 12-part assembly imported with relative positions preserved

**STEP round-trip:**
- KinetiCAD-exported STEP files re-import cleanly into KinetiCAD
- Geometry, hierarchy, and relative positions preserved
- Verified at single-part (M3 screw) and multi-part (coupling) complexity

## Known issues

### STEP format limitations (apply to all CAD tools using STEP)

- STEP files do not carry mate or joint information. Round-tripping an assembly through STEP loses the kinematic relationships. Mates must be re-established after import. This applies equally to Onshape, Solidworks, and Fusion.
- STEP export flattens compound-of-solids hierarchy on round-trip. Geometry preserved, sub-assembly grouping lost.

### KinetiCAD-specific

- Imported STEP parts do not survive page refresh. B-rep shapes live in WASM memory which clears on reload. Sketch-based parts survive via the feature regen pipeline. IndexedDB persistence for raw STEP bytes is on the roadmap.
- Mate pivot picker requires the picked edge to be a full circle. If a body's geometry has its rim split by intersecting features (e.g. blades fused into a disc rim cutting it into arc segments), there is no full circle for the pivot picker. Workaround: add a separate cylindrical hub feature with a clean circular edge that is not cut by intersecting features, then mate to that.
- Sketch profiles cannot contain multiple closed loops (e.g. a plate with a hole through it).
- Hole feature position-pick clears face selection on second click.
- Sketch on selected face not yet implemented (XY/XZ/YZ globals only).
- Only Revolute and Fixed mate types implemented.
- No undo/redo.

## Not yet tested in current build

Documented as a contribution-area to-do list for anyone wanting to verify or improve coverage:

- Boolean Subtract and Intersect on within-part features (Boolean Union verified)
- Multi-mate kinematic chains (more than one mate)
- Cross-browser testing beyond Chrome and Safari
- Performance on assemblies larger than 3 parts
- Mobile (currently unsupported, WebGPU only, no WebGL2 fallback)

## Roadmap and contribution opportunities

Pull requests genuinely welcome. The most useful contributions would be:

1. IndexedDB persistence layer so imported STEP parts survive page refresh
2. IGES import and export for additional CAD interop
3. Native JSON save/load of full assembly state
4. Multi-loop sketch profiles (plates with holes, ring shapes)
5. Sketch on selected face
6. Hole feature position-pick fix
7. Other mate types: Prismatic, Planar, Spherical, Cylindrical
8. Smarter mate pivot picker for arc edges (code in, verification pending)
9. Undo/redo via Zustand history middleware
10. WebGL2 fallback for browsers without WebGPU
11. Mobile responsive layout
12. STEP entity name preservation (parts currently named after the source filename rather than their STEP PRODUCT entity name)

CAD experience particularly valuable on items 2, 4, and 8.

## Demo files for testing

Real-world STEP files for verification. All free.

- **[McMaster-Carr](https://www.mcmaster.com):** industrial parts catalogue. Search any part number, scroll to "Product CAD", download STEP. Single-part files like 91290A115 (M3 socket-head screw, ~50KB) and assemblies like 9132K11 (torque-limiting coupling, multi-part) are good test cases.
- **[GrabCAD](https://grabcad.com):** community-uploaded parts and assemblies. Free with signup.

## Built with

Built using [Replit](https://replit.com) and Replit Agent.

## Author

Andrew Blumson ([@AndrewBlumson](https://github.com/AndrewBlumson) on GitHub and X, [LinkedIn](https://linkedin.com/in/andrewblumson))  
Adevious AI Ltd. UK Replit Ambassador. Builds in public.

Co-built with Kevin Blumson ([@KevinBlumson](https://github.com/KevinBlumson)).

## Licence

MIT, see LICENSE for full text.
