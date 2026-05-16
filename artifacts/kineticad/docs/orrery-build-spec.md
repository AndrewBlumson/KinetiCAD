# KinetiCAD Orrery: Build Spec

**Purpose:** A nested planetary model, built as the second registered KinetiCAD seed. A showcase build for social media (LinkedIn, X), and the build that finally exercises KinetiCAD's untested multi-mate kinematic chains and large-assembly handling.

**Date:** 16/05/2026
**Status:** Spec approved, not yet built.
**Builds on:** Seed registry (seed #1 windmill, shipped 16/05/2026). The orrery is seed #2.

---

## 1. What the orrery is

A central sun sits at the world origin. Eight arms radiate outward in a horizontal plane, each carrying a planet, each rotating about the vertical axis at its own speed. Three of the planets carry a moon on a short arm of its own, so those planets are nested rotation chains. An asteroid ring orbits in the gap between the inner and outer planets. Every motion in the build is a revolute joint driven by a motor.

It is a flat horizontal mechanism, like a tabletop orrery. Viewed in KinetiCAD's simulator it should look like a living clockwork solar system, tuned so every layer of motion reads clearly in a 20 to 30 second screen recording.

---

## 2. Constraints and what this build stresses

KinetiCAD capabilities the orrery works within:

- Revolute and Fixed mates only. Every orrery joint is revolute. No sliding parts.
- Parts are built from sketches plus Extrude and Revolve features. No imported geometry.
- Z-up coordinate system, millimetre units, en-GB locale.

KinetiCAD areas the orrery deliberately stresses, all currently listed as not yet tested in the README:

- Multi-mate kinematic chains, more than one mate. The orrery has twelve.
- Assemblies larger than three parts. The orrery has roughly thirteen bodies.
- Nested rotation, three joints deep on the mooned planets.

This is intentional. The orrery doubles as the stress test that proves those untested items, or surfaces the bugs in them. The phased build plan in section 11 exists so that failure at any scale leaves a smaller working orrery to fall back on.

---

## 3. Design overview

Kinematic tree. Indentation is parent to child. Every joint axis is the world Z axis.

```
Sun (grounded, Fixed)
├── Arm+Planet 1
├── Arm+Planet 2  ──→ Moon 2
├── Arm+Planet 3
├── Arm+Planet 4  ──→ Moon 4
├── Asteroid ring (own joint to Sun)
├── Arm+Planet 5
├── Arm+Planet 6  ──→ Moon 6
├── Arm+Planet 7
└── Arm+Planet 8
```

Body count at full scale: 1 sun, 8 arm-plus-planet bodies, 3 moon bodies, 1 asteroid ring. Thirteen rigid bodies.

Joint count at full scale: 8 planet-to-sun joints, 3 moon-to-planet joints, 1 ring-to-sun joint. Twelve revolute joints, all motorised.

For comparison the windmill is 2 bodies and 1 joint.

---

## 4. Coordinate system and orbital plane

The sun centre is the world origin, [0, 0, 0].

The orbital plane is the world XY plane, horizontal. Every planet, every moon and the asteroid ring rotates about an axis parallel to world Z, [0, 0, 1]. This matches the windmill, whose rotor also spins about Z, so the orrery reuses a rotation axis KinetiCAD is known to handle correctly.

All arms radiate outward in the XY plane. The whole mechanism is flat, with a small vertical offset only if needed to stop bodies overlapping in Z, see section 5.

---

## 5. Parts and geometry

All geometry is expressed in KinetiCAD's sketch-plus-feature vocabulary. The generator must follow the exact feature schema used by the windmill seed; Agent should read `public/seeds/windmill.js` for working feature definitions before writing the generator.

### 5.1 Sun

A sphere at the world origin, default radius 25 mm. Grounded with a Fixed mate, the same role the windmill post plays.

Built as a Revolve feature: a semicircular profile revolved 360 degrees about its straight edge.

### 5.2 Arm-plus-planet part (eight of these)

One rigid body per planet, holding both the arm and the planet, the same way the windmill rotor holds the disc, hub and four blades in one part.

- Local origin at the rotation centre. When the part is placed, its origin coincides with the sun centre.
- Arm: a thin cylinder, default radius 2.5 mm, running from the local origin along local +X out to the planet.
- Planet: a sphere at the far end of the arm, centred at local [orbitRadius, 0, 0].
- Planet radii vary for visual interest, default range 8 mm to 16 mm across the eight planets.

### 5.3 Moon part (three of these)

One rigid body per moon, on planets 2, 4 and 6.

- Local origin at the moon's orbit centre. When placed, its origin coincides with its planet's centre.
- A short thin arm plus a small sphere, default moon radius 5 mm.

### 5.4 Asteroid ring

One single rigid body, not many separate asteroids. This is a deliberate decision: dozens of individual asteroid bodies would mean dozens of joints and would very likely exceed KinetiCAD's performance ceiling. One part gives the look at a fraction of the cost.

- Local origin at the sun centre.
- Default 24 small spheres, radius 3 mm, arranged evenly in a circle at the ring radius. Many sphere features in one part.

### 5.5 Geometry fallback

Spheres are the target for the sun, planets, moons and asteroid lumps. If the Revolve feature proves awkward to express in seed form, the generator falls back to low-height cylinders, flat discs, for the round bodies. A disc still reads as a planet token in a 3D view. This fallback is a Phase 1 decision point: Agent confirms whether Revolve features work cleanly in a hardcoded seed, and if not, uses discs. Push cutting edge, scale down only on failure, applies to geometry as well as kinematics.

---

## 6. Layout mathematics

All values below are generator defaults. Every one is a parameter, tunable in Phase 5.

### 6.1 Planet orbit radii

```
orbitRadius(i) = R_base + (i - 1) * R_step      for i = 1 to 8
R_base = 70 mm
R_step = 42 mm
```

Giving radii: 70, 112, 154, 196, 238, 280, 322, 364 mm.

### 6.2 Asteroid ring radius

```
ringRadius = 224 mm
```

This sits in the gap between planet 4 at 196 mm and planet 5 at 238 mm, echoing the real asteroid belt between Mars and Jupiter.

### 6.3 Initial fan-out

Each arm-plus-planet part is placed with an initial rotation about world Z so the eight arms fan out evenly rather than starting stacked.

```
initialAngle(i) = (i - 1) * 45 degrees           for i = 1 to 8
```

### 6.4 Moon placement

Moons sit on planets 2, 4 and 6. A moon's orbit centre is its planet's centre. In the parent arm-plus-planet part's local coordinates that centre is [orbitRadius, 0, 0].

```
moonOrbitRadius = 22 mm        (moon's distance from its planet centre)
```

### 6.5 Joint pivots

Every joint is revolute, axis [0, 0, 1].

- Planet-to-sun joint: pivot on the sun is the sun's local centre [0, 0, 0]; pivot on the arm-plus-planet body is that body's local origin [0, 0, 0].
- Moon-to-planet joint: pivot on the parent arm-plus-planet body is [orbitRadius, 0, 0] in that body's local frame, the planet centre; pivot on the moon body is its local origin [0, 0, 0].
- Ring-to-sun joint: pivot on the sun is [0, 0, 0]; pivot on the ring body is its local origin [0, 0, 0].

The generator must compute these correctly. The hardcoded seed writes joints directly, so geometric correctness of the pivot values is the generator's responsibility; there is no UI pick step to fall back on.

---

## 7. Joints and motors

Twelve revolute joints, all motorised, all axis [0, 0, 1].

| Joint | Connects | Pivot on parent | Pivot on child |
|---|---|---|---|
| Planet joints, 8 | Sun to arm-plus-planet i | [0,0,0] | [0,0,0] |
| Moon joints, 3 | Arm-plus-planet to moon | [orbitRadius,0,0] | [0,0,0] |
| Ring joint, 1 | Sun to asteroid ring | [0,0,0] | [0,0,0] |

Motor speeds are set per the speed scheme in section 8.

---

## 8. Speed scheme

The chosen brief is tuned to look best on video, not realistic orbital ratios. The aim: in a 20 to 30 second screen recording every layer of motion is clearly visible and distinct.

### 8.1 Planet orbit speeds

Inner planets faster, outer planets slower, which keeps the pleasing orrery rhythm without being astronomically accurate. Default orbit periods run from 5 seconds inner to 13 seconds outer, linearly interpolated.

```
period(i) = 5 + (i - 1) * (13 - 5) / 7     seconds,  for i = 1 to 8
rpm(i)    = 60 / period(i)
```

Giving approximately:

| Planet | Period | RPM |
|---|---|---|
| 1 | 5.00 s | 12.00 |
| 2 | 6.14 s | 9.77 |
| 3 | 7.29 s | 8.24 |
| 4 | 8.43 s | 7.12 |
| 5 | 9.57 s | 6.27 |
| 6 | 10.71 s | 5.60 |
| 7 | 11.86 s | 5.06 |
| 8 | 13.00 s | 4.62 |

### 8.2 Moon speeds

Each moon orbits faster than any planet, default period 2.5 seconds, roughly 24 RPM, so the nested motion reads distinctly against the slower planet orbit carrying it.

### 8.3 Asteroid ring speed

A slow steady drift, default period 18 seconds, roughly 3.33 RPM.

All speeds above are generator defaults and are the main thing tuned in Phase 5 once the full orrery can be watched running.

---

## 9. The generator

The orrery seed is not hand-authored. A parametric generator produces it.

- The generator is a script in the repo, suggested location `scripts/generate-orrery-seed.ts` or similar. Agent decides the exact location and language to fit the workspace.
- It is parametric from the start. Parameters include: planet count, which planets carry moons, asteroid ring on or off, all radii, all speeds, all body sizes.
- Running the generator emits `public/seeds/orrery.js`, a self-contained IIFE in the same structure as `public/seeds/windmill.js`.
- The generator stays in the repo so the orrery can be retuned by changing parameters and re-running. The committed seed is the generator's output.

Later build phases mostly change generator parameters and re-run; the generator itself is written once, in Phase 1.

---

## 10. Seed output format

`public/seeds/orrery.js` must match the windmill seed's structure exactly:

- A self-contained IIFE.
- Builds a plain state object: parts with their sketches and features, and the revolute mates with pivots, axes and motor speeds.
- Calls `localStorage.setItem("kineticad-state", JSON.stringify({ state, version: N }))`.
- Calls `location.reload()`.

The `version: N` value must match the current Zustand persist version in `store.ts` at build time. The windmill seed currently uses 8. Check `store.ts` before writing the orrery seed; do not assume 8 if the store has since migrated.

Registry entry to add to `public/seed-registry.js`:

```
{ id: 'orrery', name: 'Orrery', description: 'Nested planetary model: sun, 8 planets, 3 moons, asteroid ring. 13 bodies, 12 revolute joints.' }
```

Loaded with `window.loadSeed('orrery')`.

---

## 11. Phased build plan

Build one phase at a time. For each phase: plan mode first, then implement, then verify, then commit. Do not tell the Replit Agent to push; Replit handles git internally and pushing is a manual step taken later.

Each phase scales the orrery up. If a phase fails, the previous phase remains a working, showable orrery.

### Phase 1: Parametric generator, minimal orrery

- Write the full parametric generator.
- Run it at minimal settings: 2 planets, no moons, no ring.
- Confirm whether Revolve features work cleanly in seed form; if not, switch round bodies to discs, section 5.5.
- Emit `public/seeds/orrery.js`. Add the registry entry.
- **Verify:** `window.loadSeed('orrery')` loads a 3-body, 2-joint scene. Both planets orbit the sun about Z. No console errors. Already exceeds the windmill in scale.

### Phase 2: Scale to eight planets

- Run the generator at 8 planets, still no moons, no ring.
- **Verify:** 9 bodies, 8 joints. All eight planets orbit at the differentiated speeds from section 8.1. Frame rate holds on the target machine. This proves the larger-than-three-parts case.

### Phase 3: Add moons, nested chains

- Enable moons on planets 2, 4 and 6.
- **Verify:** 12 bodies, 11 joints. Each moon orbits its planet while the planet orbits the sun. Three-deep kinematic chains hold together. This is the highest-risk phase; it proves the multi-mate chain case.

### Phase 4: Add the asteroid ring

- Enable the asteroid ring, one part, one joint.
- **Verify:** 13 bodies, 12 joints. The ring rotates as a unit between planets 4 and 5, reading as a lumpy belt.

### Phase 5: Tune for video

- Tune motor speeds, body sizes and radii for the best look in a 20 to 30 second screen recording.
- Optional visual polish: vary planet sizes and any colour options the build supports.
- **Verify:** the full orrery runs smoothly, every layer of motion is clearly visible and distinct, recording-ready.

### Verification method

The windmill canary checks one motor against pi rad/s. The orrery has many motors at many speeds, so the equivalent check is per body: each motorised body's measured angular velocity magnitude should match its motor setting, `bodyAngvelMag` approximately equal to `2 * pi * rpm / 60`, within the same numerical tolerance band the windmill canary uses. Reuse the existing step-diag logging. This keeps mathematical correctness verifiable, which is the showcase brand differentiator.

---

## 12. Risks and fallbacks

- **Multi-mate chains may not hold.** Untested in KinetiCAD. If Phase 3 nested chains fail, fall back to the Phase 2 flat 8-planet orrery, which is still a strong showcase.
- **Body count may hit a performance wall.** Untested past 3 parts. If frame rate collapses at Phase 2 or 4, reduce planet count or asteroid lump count via generator parameters.
- **Revolve in seed form may be awkward.** Fall back to discs and cylinders for round bodies, section 5.5.
- **Non-identity initial transforms.** The arms are placed with initial Z rotations. A secondary frame-mismatch issue was noted in `RevoluteMateInspector.tsx` for parts with non-identity world transforms, but that is a UI pick-flow bug; the orrery seed writes joints directly and should sidestep it. If seeded joints on rotated parts behave wrongly, this is the first thing to investigate.

---

## 13. Acronym Index

- IIFE: Immediately Invoked Function Expression
- RPM: Revolutions Per Minute
- UI: User Interface
