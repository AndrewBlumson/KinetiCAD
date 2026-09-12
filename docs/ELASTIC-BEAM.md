# Scope of the elastic cantilever calculation

The Engineering tests panel includes an independent Euler–Bernoulli beam
calculation. It is not a finite-element solver or a deformable-body extension
of Rapier. The CAD assembly remains rigid and unchanged.

Choose a native part containing one rectangle sketch and one extrusion, or
enter a separate rectangular benchmark's dimensions. Imported STEP solids,
holes/modifiers and parts participating in assembly booleans are not reduced
to bounding boxes for analysis. Local length and force axes explicitly select
the section of eligible CAD parts; positioning a part does not create a clamp.

The model is a uniform, homogeneous, isotropic rectangular beam rigidly clamped
at one end, with one transverse point force at the free end. Enter Young's
modulus and an elastic stress limit from a material specification or measurement.
The CAD material's density is not used to infer either property. The optional
reference button explicitly supplies all dimensions, force and material numbers;
it does not identify them as measured properties of the selected CAD material.

## Equations and units

The equation and clamped-end boundary conditions follow the tip-loaded
cantilever example in [MIT 2.002, Euler–Bernoulli Beams, slides 7 and 9](https://www.ocw.mit.edu/courses/2-002-mechanics-and-materials-ii-spring-2004/bc25a56b5a91ad29ca5c7419616686f7_lec2.pdf).

Use millimetres, newtons and MPa. `1 MPa = 1 N/mm²`; an input modulus in GPa is
multiplied by 1000. For length `L`, width `b`, bending depth `h`, force `F` and
modulus `E`, the second moment is `I = bh³/12`.

The section moment `M(x) = F(L − x)` gives `EI y'' = M`. Integrating with
clamped boundary conditions `y(0) = y'(0) = 0` yields:

```text
y(x) = F x²(3L − x) / (6EI)
tip displacement = FL³ / (3EI)
tip slope = FL² / (2EI)
maximum bending stress = |F| Lh / (2I)
maximum elastic strain = maximum bending stress / E
clamp force reaction = −F
clamp moment reaction = −FL
```

The signed moment is a scalar in the bending plane; its positive normal follows
the selected length-axis cross force-axis convention. A reversed force reverses
displacement, slope and reactions; the maximum stress magnitude stays positive.

The plotted line is the calculated curve in physical millimetres. Its transverse
display scale is enlarged relative to the length scale and the actual factor is
labelled. It is not a cosmetic deformation of the CAD mesh.

## Accepted range and omitted effects

This tool explicitly flags any of these conditions:

- `L / max(b,h) < 10`: outside its conservative slender-beam range.
- `|tip displacement| / L > 0.02`: outside its accepted small-deflection range.
- Maximum bending stress greater than the user-supplied elastic limit.

Failed checks label the equation outputs as outside the physical model's
accepted range. The thresholds are declared tool limits, not a manufacturing
standard or a design safety factor. Passing them does not certify a component.
Self-weight, shear deformation, plasticity, buckling, contact, fatigue, stress
concentrations and general 3D material response are omitted.

## Repeatable verification

```sh
pnpm --filter @workspace/kineticad test:beam
```

Seven tests pass: a hand-calculated unit reference, the clamped/free-end and
midpoint curve values, signed load scaling, cubic depth/length effects and
linear width/modulus effects, explicit validity failures, rejected invalid
inputs, and native CAD axis/eligibility checks.

The explicit reference case is `L=300 mm`, `b=20 mm`, `h=10 mm`, `F=10 N`,
`E=200 GPa` and elastic limit `250 MPa`. It produces `I=1666.6666667 mm⁴`,
tip displacement `0.27 mm`, stress `9 MPa`, slope `0.00135 rad`, force reaction
`−10 N` and moment reaction `−3 N·m`. The midpoint displacement is `5/16`
of the tip value, providing an independent check of the plotted shape.
