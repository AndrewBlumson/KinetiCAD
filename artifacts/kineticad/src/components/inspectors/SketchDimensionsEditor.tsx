import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getCadKernel } from '@/cad/cadClient';
import type { Part, Sketch, SketchPrimitive } from '@/state/schemas';
import { useKinetiCADStore } from '@/state/store';
import { dimensionFields, withPrimitiveDimensions } from '@/sketch/sketchDimensions';
import { applySketchDimensions } from '@/sketch/sketchEdit';

type Draft = Record<string, string>[];

function fieldsFor(sketch: Sketch): Draft {
  return sketch.primitives.map(primitive => Object.fromEntries(
    dimensionFields(primitive).map(field => [field.key, String(field.value)]),
  ));
}

const shapeNames = { circle: 'Circle', rectangle: 'Rectangle', line: 'Line', arc: 'Arc' };
const anchorNotes = {
  circle: 'The diameter grows or shrinks around the centre.',
  rectangle: 'Width and height extend from the lower-left corner.',
  line: 'Length and angle set the end point relative to the start.',
  arc: 'Start and sweep angles run anticlockwise from the horizontal axis.',
};

/** Draft strings stay outside the saved assembly until full CAD validation succeeds. */
export default function SketchDimensionsEditor({ part, sketch, onClose }: {
  part: Part;
  sketch: Sketch;
  onClose: () => void;
}) {
  // The parent mounts a fresh editor for each source sketch. Retain that source
  // for compare-and-swap validation even if unrelated part readouts update.
  const [source] = useState(() => sketch);
  const [draft, setDraft] = useState(() => fieldsFor(source));
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const lifetime = useRef<AbortController | null>(null);
  const submitted = useRef(false);
  const setEditing = useKinetiCADStore(s => s.setSketchDimensionsEditing);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    setEditing(true);
    return () => {
      controller.abort();
      setEditing(false);
    };
  }, [setEditing]);

  const primitive = source.primitives[selected];
  const fields = primitive ? dimensionFields(primitive) : [];
  const original = fieldsFor(source);
  const dirty = draft.some((row, i) => Object.entries(row).some(([key, value]) => value !== original[i][key]));
  const axes = source.plane === 'XZ' ? 'U = X, V = Z' : source.plane === 'YZ' ? 'U = Y, V = Z' : 'U = X, V = Y';

  const apply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitted.current || !dirty) return;
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted) return;
    setError(null);
    let primitives: SketchPrimitive[];
    try {
      primitives = source.primitives.map((shape, index) => {
        const values: Record<string, number> = {};
        for (const field of dimensionFields(shape)) {
          const raw = draft[index][field.key].trim();
          if (!raw || !Number.isFinite(Number(raw))) {
            setSelected(index);
            throw new Error(`${shapeNames[shape.type]} ${index + 1}: enter a finite number for ${field.label.toLowerCase()}.`);
          }
          values[field.key] = Number(raw);
        }
        try { return withPrimitiveDimensions(shape, values); }
        catch (cause) {
          setSelected(index);
          throw new Error(`${shapeNames[shape.type]} ${index + 1}: ${cause instanceof Error ? cause.message : String(cause)}`);
        }
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return;
    }
    submitted.current = true;
    setPending(true);
    try {
      const kernel = await getCadKernel();
      if (signal.aborted) return;
      await applySketchDimensions(part.id, source.id, primitives, source, kernel, signal);
      if (signal.aborted) return;
      toast.success('Sketch dimensions applied.');
      onClose();
    } catch (cause) {
      if (!signal.aborted) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      submitted.current = false;
      if (!signal.aborted) setPending(false);
    }
  };

  return <form onSubmit={apply} aria-label="Edit sketch dimensions" className="flex flex-col gap-3">
    <p className="text-xs leading-relaxed text-muted-foreground">
      Measurements use this sketch’s local axes: {axes}. Changes are saved after you apply them.
    </p>
    <label className="flex flex-col gap-1 text-xs">
      Shape
      <select aria-label="Sketch shape" value={selected} disabled={pending}
        onChange={event => setSelected(Number(event.target.value))}
        className="min-h-9 w-full rounded border border-border bg-card px-2 text-foreground focus-visible:outline-2 focus-visible:outline-[#FF6B1A]">
        {source.primitives.map((shape, index) => <option key={index} value={index}>{shapeNames[shape.type]} {index + 1}</option>)}
      </select>
    </label>
    <fieldset disabled={pending} className="flex min-w-0 flex-col gap-2 disabled:opacity-60">
      <legend className="mb-2 font-technical text-xs text-orange-300">{primitive ? `${shapeNames[primitive.type]} ${selected + 1}` : 'Empty sketch'}</legend>
      {fields.map(field => <label key={`${selected}:${field.key}`} className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
        {field.label} ({field.unit})
        <input type="text" inputMode="decimal" autoComplete="off" spellCheck={false}
          aria-label={`${field.label} (${field.unit})`}
          value={draft[selected][field.key]}
          onChange={event => {
            const value = event.target.value;
            setDraft(current => current.map((row, index) => index === selected ? { ...row, [field.key]: value } : row));
            setError(null);
          }}
          className="h-9 min-w-0 w-full rounded border border-border bg-[#0F1424] px-2 font-technical text-xs text-foreground focus-visible:outline-2 focus-visible:outline-[#FF6B1A]" />
      </label>)}
    </fieldset>
    {primitive ? <p className="text-xs leading-relaxed text-muted-foreground">{anchorNotes[primitive.type]}</p> : null}
    {source.primitives.length > 1 ? <p className="text-xs leading-relaxed text-muted-foreground">Joined endpoints do not move automatically. You can edit several shapes here before applying them together.</p> : null}
    <p className="text-xs leading-relaxed text-muted-foreground">The solid and its dependent features are checked before the saved model changes. Existing joint attachments must remain valid.</p>
    {error ? <div role="alert" className="rounded border border-red-400/40 bg-red-400/5 p-2 text-xs leading-relaxed text-red-300"><strong>Dimensions were not applied.</strong><p className="mt-1 break-words">{error}</p></div> : null}
    <button type="submit" disabled={pending || !dirty || !primitive}
      className="min-h-9 rounded bg-[#FF6B1A] px-2 text-xs font-semibold text-[#0A0E1A] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
      {pending ? 'Checking geometry…' : 'Apply dimensions'}
    </button>
    {pending ? <p role="status" className="text-xs text-muted-foreground">Rebuilding and checking the edited geometry…</p> : null}
    <button type="button" onClick={onClose} className="min-h-9 rounded border border-border px-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground">Cancel edits</button>
  </form>;
}
