// xcaf-api-probe.ts -- 16/05/2026
// Discover which XCAF name-extraction APIs are available in the installed
// opencascade.js WASM build. Tests the original six candidates plus two
// additional paths found during d.ts analysis:
//   7. Handle_TDataStd_Name_2 raw-pointer coercion (pass TDF_Attribute* as TDataStd_Name*)
//   8. TDF_AttributeIterator PtrValue().Get() duck-typing
//
// Run: pnpm --filter @workspace/scripts run xcaf-api-probe

import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ocRoot = path.resolve(
  __dirname,
  '../../artifacts/kineticad/node_modules/opencascade.js/dist',
);
const nodeJsUrl = pathToFileURL(path.join(ocRoot, 'node.js')).href;
const { default: ocFactoryRaw } = await import(nodeJsUrl) as {
  default: (opts?: Record<string, unknown>) => Promise<unknown>;
};

function report(api: string, available: boolean, reason?: string): void {
  if (available) {
    console.log(`[xcaf-api-probe] ${api}: AVAILABLE`);
  } else {
    console.log(`[xcaf-api-probe] ${api}: NOT AVAILABLE: ${reason ?? 'undefined'}`);
  }
}

function listKeys(label: string, obj: unknown): void {
  if (obj == null) {
    console.log(`[xcaf-api-probe] ${label}: object does not exist on oc`);
    return;
  }
  const own = Object.keys(obj as object);
  const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(obj as object) ?? {});
  const all = [...new Set([...own, ...proto])].filter(k => k !== 'constructor');
  console.log(`[xcaf-api-probe] ${label} keys: ${all.join(', ') || '(none)'}`);
}

// Build an ExtendedString. Returns [instance, cleanup] or null on failure.
function makeExtStr(
  ocAny: Record<string, unknown>,
  value: string,
): { extStr: unknown; cleanup(): void } | null {
  const candidates: Array<[string, unknown[]]> = [
    ['TCollection_ExtendedString_2', [value, false]], // (const char*, bool isMultiByte)
    ['TCollection_ExtendedString_1', []],             // () -- empty string, still accepted by Set_1
  ];
  for (const [ctor, args] of candidates) {
    if (typeof ocAny[ctor] === 'function') {
      try {
        const extStr = new (ocAny[ctor] as new (...a: unknown[]) => { delete(): void })(...args);
        return { extStr, cleanup: () => { try { (extStr as { delete(): void }).delete(); } catch { /* ignore */ } } };
      } catch {
        continue;
      }
    }
  }
  return null;
}

// Create a TDF_Data + root + one child label ready to hold attributes.
// Returns { data, childLabel } or throws.
function makeTestLabel(
  ocAny: Record<string, unknown>,
): { data: { delete(): void }; childLabel: unknown } {
  const data = new (ocAny.TDF_Data as new () => { delete(): void })();
  // Root() returns TDF_Label. Use NewChild() on it so we get a proper
  // non-root label -- the OCCT root label should not have user attributes.
  const root = (data as unknown as { Root(): { NewChild(): unknown } }).Root();
  const childLabel = root.NewChild();
  return { data, childLabel };
}

// Attach a TDataStd_Name to childLabel and return the typed handle.
// Returns null if no suitable Set variant or string constructor is found.
function attachName(
  ocAny: Record<string, unknown>,
  childLabel: unknown,
  value: string,
): { typedHandle: unknown; cleanup(): void } | null {
  const setVariants = ['Set_1', 'Set'];
  let setFn: string | null = null;
  for (const v of setVariants) {
    if (typeof (ocAny.TDataStd_Name as Record<string, unknown>)?.[v] === 'function') {
      setFn = v;
      break;
    }
  }
  if (!setFn) return null;

  const made = makeExtStr(ocAny, value);
  if (!made) return null;

  const { extStr, cleanup: cleanupStr } = made;
  let typedHandle: unknown;
  try {
    typedHandle = (ocAny.TDataStd_Name as Record<string, (...a: unknown[]) => unknown>)[setFn](
      childLabel,
      extStr,
    );
  } finally {
    cleanupStr();
  }

  return {
    typedHandle,
    cleanup: () => {
      try { (typedHandle as { delete?(): void })?.delete?.(); } catch { /* ignore */ }
    },
  };
}

// ------------------------------------------------------------------
// Test 6: classic duck-typing -- fixed to use a child label, not Root().
// ------------------------------------------------------------------
async function tryDuckTyping(ocAny: Record<string, unknown>): Promise<boolean> {
  let data: { delete(): void } | null = null;
  let baseHandle: { delete(): void } | null = null;

  try {
    const { data: d, childLabel } = makeTestLabel(ocAny);
    data = d;

    const attached = attachName(ocAny, childLabel, 'ProbeLabel');
    if (!attached) {
      report('duck-typing: baseHandle.get().Get() after FindAttribute_1', false,
        'could not attach TDataStd_Name (no Set variant or ExtendedString constructor)');
      return false;
    }
    attached.cleanup(); // typed handle not needed here; we test base-handle path

    baseHandle = new (ocAny.Handle_TDF_Attribute_1 as new () => { delete(): void })();
    const found = (childLabel as {
      FindAttribute_1(id: unknown, h: unknown): boolean;
    }).FindAttribute_1(
      (ocAny.TDataStd_Name as { GetID(): unknown }).GetID(),
      baseHandle,
    );

    if (!found) {
      report('duck-typing: baseHandle.get().Get() after FindAttribute_1', false,
        'FindAttribute_1 returned false even on child label after Set_1');
      return false;
    }

    const attr = (baseHandle as unknown as { get(): unknown }).get();
    const hasGet = attr != null && typeof (attr as Record<string, unknown>).Get === 'function';

    if (hasGet) {
      const ext = (attr as { Get(): { Length(): number; Value(k: number): number } }).Get();
      let name = '';
      for (let k = 1; k <= ext.Length(); k++) {
        name += String.fromCharCode(ext.Value(k));
      }
      report('duck-typing: baseHandle.get().Get() after FindAttribute_1', true);
      console.log(`[xcaf-api-probe]   read value: "${name.trim()}"`);
      return true;
    } else {
      const keys = attr != null ? Object.keys(attr as object).join(', ') : 'null';
      report('duck-typing: baseHandle.get().Get() after FindAttribute_1', false,
        `attr has no .Get() -- attr keys: ${keys}`);
      return false;
    }
  } catch (e) {
    report('duck-typing: baseHandle.get().Get() after FindAttribute_1', false,
      `threw: ${e}`);
    return false;
  } finally {
    try { baseHandle?.delete(); } catch { /* ignore */ }
    try { data?.delete(); } catch { /* ignore */ }
  }
}

// ------------------------------------------------------------------
// Test 7: Handle_TDataStd_Name_2 raw-pointer coercion.
// After FindAttribute_1 fills a base handle, try passing the TDF_Attribute*
// returned by baseHandle.get() into Handle_TDataStd_Name_2(thePtr: TDataStd_Name).
// If embind does not reject the type mismatch we get a typed handle for free.
// ------------------------------------------------------------------
async function tryRawPtrCoercion(ocAny: Record<string, unknown>): Promise<void> {
  const TEST = 'Handle_TDataStd_Name_2 raw-pointer coercion';
  if (typeof ocAny.Handle_TDataStd_Name_2 !== 'function') {
    report(TEST, false, 'Handle_TDataStd_Name_2 not found on oc');
    return;
  }

  let data: { delete(): void } | null = null;
  let baseHandle: { delete(): void } | null = null;
  let typedHandleCoerced: { delete(): void } | null = null;

  try {
    const { data: d, childLabel } = makeTestLabel(ocAny);
    data = d;

    const attached = attachName(ocAny, childLabel, 'CoercionProbe');
    if (!attached) {
      report(TEST, false, 'could not attach TDataStd_Name to test label');
      return;
    }
    attached.cleanup();

    baseHandle = new (ocAny.Handle_TDF_Attribute_1 as new () => { delete(): void })();
    const found = (childLabel as {
      FindAttribute_1(id: unknown, h: unknown): boolean;
    }).FindAttribute_1(
      (ocAny.TDataStd_Name as { GetID(): unknown }).GetID(),
      baseHandle,
    );

    if (!found) {
      report(TEST, false, 'FindAttribute_1 returned false -- cannot test coercion');
      return;
    }

    // Get the raw TDF_Attribute* and try to pass it to Handle_TDataStd_Name_2.
    const rawAttrPtr = (baseHandle as unknown as { get(): unknown }).get();

    typedHandleCoerced = new (ocAny.Handle_TDataStd_Name_2 as new (ptr: unknown) => {
      delete(): void;
    })(rawAttrPtr);

    // If construction succeeded, try reading via the typed handle.
    const typedObj = (typedHandleCoerced as unknown as { get(): unknown }).get();
    const hasGet = typedObj != null && typeof (typedObj as Record<string, unknown>).Get === 'function';

    if (hasGet) {
      const ext = (typedObj as { Get(): { Length(): number; Value(k: number): number } }).Get();
      let name = '';
      for (let k = 1; k <= ext.Length(); k++) {
        name += String.fromCharCode(ext.Value(k));
      }
      report(TEST, true);
      console.log(`[xcaf-api-probe]   coerced read value: "${name.trim()}"`);
    } else {
      const keys = typedObj != null ? Object.keys(typedObj as object).join(', ') : 'null';
      report(TEST, false,
        `Handle_TDataStd_Name_2 constructed without error but typed .get().Get() absent -- keys: ${keys}`);
    }
  } catch (e) {
    report(TEST, false, `threw (likely embind type-check): ${e}`);
  } finally {
    try { typedHandleCoerced?.delete(); } catch { /* ignore */ }
    try { baseHandle?.delete(); } catch { /* ignore */ }
    try { data?.delete(); } catch { /* ignore */ }
  }
}

// ------------------------------------------------------------------
// Test 8: TDF_AttributeIterator PtrValue() duck-typing.
// Iterate all attributes on a test label; for any that has PtrValue().Get(),
// try reading the string.
// ------------------------------------------------------------------
async function tryAttributeIterator(ocAny: Record<string, unknown>): Promise<void> {
  const TEST = 'TDF_AttributeIterator: PtrValue().Get() duck-typing';
  if (typeof ocAny.TDF_AttributeIterator_2 !== 'function') {
    report(TEST, false, 'TDF_AttributeIterator_2 not found on oc');
    return;
  }

  let data: { delete(): void } | null = null;
  let iter: { delete(): void } | null = null;

  try {
    const { data: d, childLabel } = makeTestLabel(ocAny);
    data = d;

    const attached = attachName(ocAny, childLabel, 'IteratorProbe');
    if (!attached) {
      report(TEST, false, 'could not attach TDataStd_Name to test label');
      return;
    }
    attached.cleanup();

    iter = new (ocAny.TDF_AttributeIterator_2 as new (
      label: unknown, withoutForgotten: boolean,
    ) => {
      More(): boolean;
      Next(): void;
      Value(): unknown;
      PtrValue(): unknown;
      delete(): void;
    })(childLabel, true);

    const itTyped = iter as unknown as {
      More(): boolean;
      Next(): void;
      Value(): unknown;
      PtrValue(): unknown;
    };

    let found = false;
    while (itTyped.More()) {
      // Test Value() (returns Handle_TDF_Attribute).
      const valHandle = itTyped.Value();
      const valHandleGet = valHandle != null
        ? (valHandle as Record<string, unknown>).get
        : undefined;
      if (typeof valHandleGet === 'function') {
        const raw = (valHandle as { get(): unknown }).get();
        if (raw != null && typeof (raw as Record<string, unknown>).Get === 'function') {
          const ext = (raw as { Get(): { Length(): number; Value(k: number): number } }).Get();
          let name = '';
          for (let k = 1; k <= ext.Length(); k++) {
            name += String.fromCharCode(ext.Value(k));
          }
          report(TEST, true, 'via Value().get().Get()');
          console.log(`[xcaf-api-probe]   iterator read value: "${name.trim()}"`);
          found = true;
        }
      }

      // Test PtrValue() (returns TDF_Attribute raw).
      if (!found) {
        const ptr = itTyped.PtrValue();
        if (ptr != null && typeof (ptr as Record<string, unknown>).Get === 'function') {
          const ext = (ptr as { Get(): { Length(): number; Value(k: number): number } }).Get();
          let name = '';
          for (let k = 1; k <= ext.Length(); k++) {
            name += String.fromCharCode(ext.Value(k));
          }
          report(TEST, true, 'via PtrValue().Get()');
          console.log(`[xcaf-api-probe]   iterator read value: "${name.trim()}"`);
          found = true;
        }
      }

      itTyped.Next();
    }

    if (!found) {
      report(TEST, false,
        'iterated all attributes but none exposed .Get() on Value().get() or PtrValue()');
    }
  } catch (e) {
    report(TEST, false, `threw: ${e}`);
  } finally {
    try { iter?.delete(); } catch { /* ignore */ }
    try { data?.delete(); } catch { /* ignore */ }
  }
}

async function main(): Promise<void> {
  console.log('[xcaf-api-probe] Loading opencascade.js (node build)...');
  const oc = await ocFactoryRaw();
  const ocAny = oc as Record<string, unknown>;
  console.log('[xcaf-api-probe] WASM loaded. Starting API checks.\n');

  // 1. Handle_TDataStd_Name.DownCast_1
  {
    const ok = typeof (ocAny.Handle_TDataStd_Name as Record<string, unknown>)?.DownCast_1 === 'function';
    report('Handle_TDataStd_Name.DownCast_1', ok, 'not a function on Handle_TDataStd_Name');
  }

  // 2. Handle_TDataStd_Name.DownCast_2
  {
    const ok = typeof (ocAny.Handle_TDataStd_Name as Record<string, unknown>)?.DownCast_2 === 'function';
    report('Handle_TDataStd_Name.DownCast_2', ok, 'not a function on Handle_TDataStd_Name');
  }

  listKeys('Handle_TDataStd_Name', ocAny.Handle_TDataStd_Name);

  // 3. TDataStd_Name.Get_1
  {
    const ok = typeof (ocAny.TDataStd_Name as Record<string, unknown>)?.Get_1 === 'function';
    report('TDataStd_Name.Get_1', ok, 'not a function on TDataStd_Name');
  }

  // 4. TDataStd_Name.Get_2
  {
    const ok = typeof (ocAny.TDataStd_Name as Record<string, unknown>)?.Get_2 === 'function';
    report('TDataStd_Name.Get_2', ok, 'not a function on TDataStd_Name');
  }

  listKeys('TDataStd_Name', ocAny.TDataStd_Name);

  // 5. XCAFPrs_DocumentExplorer
  {
    const ok = typeof ocAny.XCAFPrs_DocumentExplorer === 'function';
    report('XCAFPrs_DocumentExplorer', ok, 'not exposed in this build');
  }

  // 6. Duck-typing (fixed: child label, not Root)
  await tryDuckTyping(ocAny);

  // 7. Handle_TDataStd_Name_2 raw-pointer coercion
  await tryRawPtrCoercion(ocAny);

  // 8. TDF_AttributeIterator PtrValue() duck-typing
  await tryAttributeIterator(ocAny);

  console.log('\n[xcaf-api-probe] Done.');
}

main().catch(err => {
  console.error('[xcaf-api-probe] Fatal:', err);
  process.exit(1);
});
