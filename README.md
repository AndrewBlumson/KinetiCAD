# KinetiCAD

Browser-native parametric CAD with B-rep geometry and live physics.

Built in a weekend during the Replit 10 Buildathon (May 2026) by Andrew Blumson ([@AndrewBlumson](https://github.com/AndrewBlumson)) using Replit Agent.

## Live demo

https://kineticad.replit.app

The pre-baked windmill demo can be loaded by pasting this in the browser console:

```js
fetch('/seed-windmill.js').then(r=>r.text()).then(code=>eval(code))
```

## Stack

- React 19, Vite 8, TypeScript 6
- Three.js r184 + WebGPU
- OpenCascade.js (B-rep geometry, Web Worker via Comlink)
- Rapier3D 0.12 (physics, Web Worker)
- Zustand state, Tailwind, Howler.js

## Status

Modeller pipeline working: sketching on global XY/XZ/YZ planes, multi-feature extrudes with boolean ops (Add/Cut/New Body), positive and negative extrude direction, face-edge picking for revolute mate creation, motor RPM configuration.

Physics simulation working: revolute joint with motor, mathematically clean rotation about an arbitrary axis between bodies with positional offsets.

## Verified

The pivot frame fix (worldToLocalPoint conversion at mate creation) was deployed and verified end-to-end on the seeded windmill demo:

Target: 30 RPM = π rad/s = 3.141592653589793

Measured at runtime:

| Channel | Value |
|---|---|
| `bodyBangvelMag` | 3.14159270 – 3.14159298 (range) |
| `bodyBangvel.x` | ~3e-16 (floating point precision floor) |
| `bodyBangvel.y` | ~4e-10 (floating point precision floor) |
| `bodyBangvel.z` | 3.14159 (pure Z-axis rotation) |

Stability across 23 seconds of simulated time: ±5e-7 rad/s. Off-axis components at the precision floor. No drift.

Industrial CNC machine tolerances aim for 1e-3 to 1e-5. This is two orders of magnitude tighter.

## Known issues

- Mate pivot picker requires the picked edge to be a full circle. If a body's geometry has its rim split by intersecting features (e.g. blades fused into a disc rim cutting it into arc segments), there's no full circle for the pivot picker. Workaround: add a separate cylindrical hub feature with a clean circular edge that doesn't get cut by the intersecting features, then mate to that.
- Sketch profiles cannot contain multiple closed loops (e.g. a plate with a hole through it).
- Hole feature position-pick clears face selection on second click.
- Sketch on selected face not yet implemented (XY/XZ/YZ globals only).
- No save/load to STEP, IGES, or native JSON.
- No undo/redo.

## Not yet tested in current build

These are documented as a contribution-area to-do list for anyone wanting to verify or improve coverage:

- Boolean Subtract and Intersect on within-part features (Boolean Union verified)
- Mate types other than Revolute and Fixed (Fixed verified in earlier phases)
- Multi-mate kinematic chains (more than one mate)
- Cross-browser testing beyond Chrome and Safari
- Performance on assemblies larger than 3 parts
- Mobile (currently unsupported, WebGPU only with no WebGL2 fallback)

## Roadmap and contribution opportunities

Pull requests genuinely welcome. The most useful contributions would be:

1. STEP / IGES / native JSON export for downstream 3D printing and CAD interop
2. Multi-loop sketch profiles (plates with holes, ring shapes)
3. Sketch on selected face
4. Hole feature position-pick fix
5. Save/load assembly state
6. Smarter mate pivot picker that uses the underlying circle centre when an arc is clicked (currently requires user to pick a full circle)
7. Undo/redo

CAD experience particularly valuable on items 1, 2, and 6.

## Built with

Built using [Replit](https://replit.com) and Replit Agent.

## Licence

MIT, see LICENSE file.
