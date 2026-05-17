// Material definitions for the KinetiCAD material library.
//
// Phase 10: eight built-in materials. Each carries a display name, density
// (g/cm³, fed into the mass-properties pipeline) and PBR appearance
// (colour, metalness, roughness) for the Three.js MeshStandardMaterial
// on each part mesh.
//
// ID strings are stable — they are persisted in `Part.materialId` and must
// never be renamed without a corresponding store migration.

export type Material = {
  id: string;
  name: string;
  /** Density in grams per cubic centimetre. Used for mass-properties calc. */
  densityGcm3: number;
  /** sRGB hex colour for MeshStandardMaterial. */
  colour: number;
  metalness: number;
  roughness: number;
};

export const MATERIALS: Readonly<Record<string, Material>> = Object.freeze({
  'aluminium-6061': {
    id: 'aluminium-6061',
    name: 'Aluminium 6061',
    densityGcm3: 2.70,
    colour: 0xA8B0BC,
    metalness: 0.7,
    roughness: 0.35,
  },
  'steel-1018': {
    id: 'steel-1018',
    name: 'Steel 1018',
    densityGcm3: 7.87,
    colour: 0x8C8C90,
    metalness: 0.9,
    roughness: 0.25,
  },
  'brass-c36000': {
    id: 'brass-c36000',
    name: 'Brass C36000',
    densityGcm3: 8.50,
    colour: 0xC8A84B,
    metalness: 0.8,
    roughness: 0.30,
  },
  'titanium-grade5': {
    id: 'titanium-grade5',
    name: 'Titanium Grade 5',
    densityGcm3: 4.43,
    colour: 0x9BA5B0,
    metalness: 0.6,
    roughness: 0.40,
  },
  'nylon-6': {
    id: 'nylon-6',
    name: 'Nylon 6',
    densityGcm3: 1.14,
    colour: 0xE8E0D0,
    metalness: 0.0,
    roughness: 0.85,
  },
  'pla': {
    id: 'pla',
    name: 'PLA',
    densityGcm3: 1.25,
    colour: 0xC8D8E8,
    metalness: 0.0,
    roughness: 0.80,
  },
  'abs': {
    id: 'abs',
    name: 'ABS',
    densityGcm3: 1.04,
    colour: 0xD8D0C0,
    metalness: 0.0,
    roughness: 0.75,
  },
  'acrylic': {
    id: 'acrylic',
    name: 'Acrylic',
    densityGcm3: 1.18,
    colour: 0xB8D8F0,
    metalness: 0.0,
    roughness: 0.10,
  },
});

/** Ordered list for the material picker UI. */
export const MATERIAL_LIST: readonly Material[] = Object.freeze(
  Object.values(MATERIALS),
);

/** The default material id applied to new and migrated parts. */
export const DEFAULT_MATERIAL_ID = 'aluminium-6061';

/**
 * Look up a material by id. Falls back to aluminium-6061 when the id is
 * unrecognised, so unknown ids from future schema versions degrade
 * gracefully rather than crashing.
 */
export function getMaterial(id: string): Material {
  return MATERIALS[id] ?? MATERIALS[DEFAULT_MATERIAL_ID]!;
}
