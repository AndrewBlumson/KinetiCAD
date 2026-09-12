import type { Assembly } from '../state/schemas';

// Compare source solids as well as joint frames: valid anchor positions alone
// cannot establish clearance after a user makes a barrel or deck larger.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value)
    .filter(([key]) => key !== 'name').sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

export function validateStewartSourceGeometry(assembly: Assembly, reference: Assembly): void {
  const fail = () => { throw new Error('Six-axis control requires the original Stewart geometry and joints. Reset the demo to use its validated workspace.'); };
  if (assembly.parts.length !== reference.parts.length || assembly.groundPartId !== reference.groundPartId
    || assembly.booleanFeatures.length || canonical(assembly.mates) !== canonical(reference.mates)) fail();
  for (const expected of reference.parts) {
    const part = assembly.parts.find(p => p.id === expected.id);
    if (!part || !part.visible || canonical(part.transform) !== canonical(expected.transform)
      || canonical(part.sketches) !== canonical(expected.sketches)
      || canonical(part.features) !== canonical(expected.features)) fail();
  }
}

let reference: Promise<Assembly> | undefined;
export async function verifyBundledStewartGeometry(assembly: Assembly, base: string): Promise<void> {
  reference ??= fetch(`${base.replace(/\/+$/, '')}/demos/stewart-platform.json`).then(async response => {
    if (!response.ok) throw new Error('Could not read the Stewart geometry reference.');
    const document = await response.json();
    if (!document?.state?.assembly?.parts) throw new Error('The Stewart geometry reference is invalid.');
    return document.state.assembly as Assembly;
  }).catch(error => { reference = undefined; throw error; });
  validateStewartSourceGeometry(assembly, await reference);
}
