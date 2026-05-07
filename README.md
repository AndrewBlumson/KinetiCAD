# KinetiCAD

Browser-native parametric CAD with B-rep geometry and live physics.

Built in a weekend during the Replit 10 Buildathon (May 2026) by Andrew Blumson
([@AndrewBlumson](https://www.linkedin.com/in/andrewblumson/)) using Replit Agent.

## Live demo
https://kineticad.replit.app

## Stack
- React 19, Vite 8, TypeScript 6
- Three.js r184 + WebGPU
- OpenCascade.js (B-rep geometry, Web Worker via Comlink)
- Rapier3D 0.12 (physics, Web Worker)
- Zustand state, Tailwind, Howler.js

## Status
Modeller pipeline is working: sketching, multi-feature extrudes with boolean
ops (Add/Cut/New Body), face-edge picking for revolute mate creation, motor
RPM configuration. Physics simulation has a remaining joint-axis bug related
to OCCT polyline winding and Rapier frame derivation between bodies with
non-identity relative orientation. See HANDOVER.md for technical details.

## Known issues
- Revolute joint axis tips below true vertical when bodies have any positional
  offset
- Sketch profiles cannot contain multiple closed loops (e.g. a plate with a hole)
- Hole feature position-pick clears face selection on second click
- Sketch on selected face not yet implemented (XY/XZ/YZ globals only)

## Contributing
Pull requests welcome. CAD experience particularly valuable on the joint-axis
fix and on multi-loop sketch profiles.

## Built with
Built using [Replit](https://replit.com) and Replit Agent.

## Licence
MIT, see LICENSE file.
