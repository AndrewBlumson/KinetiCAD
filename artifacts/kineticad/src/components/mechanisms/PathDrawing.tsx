import { useId, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { Point2 } from '@/mechanisms/fourBarKinematics';

type Props = {
  target: readonly Point2[];
  predicted?: readonly Point2[];
  pendingStroke?: readonly Point2[];
  widthMm: number;
  disabled: boolean;
  onBegin: () => void;
  onDraw: (points: Point2[]) => void;
  onError: (message: string) => void;
};

/** SVG coordinates represent millimetres; screen-to-SVG conversion includes
 * responsive letterboxing. The candidate curve never changes a drawing in flight. */
export function PathDrawing({ target, predicted = [], pendingStroke = [], widthMm, disabled, onBegin, onDraw, onError }: Props) {
  const patternId = `path-grid-${useId().replace(/:/g, '')}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const stroke = useRef<Point2[]>([]);
  const activePointer = useRef<number | null>(null);
  const tooManyPoints = useRef(false);
  const [drawing, setDrawing] = useState<Point2[] | null>(null);
  const bounds = useMemo(() => {
    const points = [...target, ...predicted, ...pendingStroke];
    const minX = points.length ? Math.min(...points.map(p => p[0])) : -widthMm / 2;
    const maxX = points.length ? Math.max(...points.map(p => p[0])) : widthMm / 2;
    const minY = points.length ? Math.min(...points.map(p => p[1])) : -widthMm / 3;
    const maxY = points.length ? Math.max(...points.map(p => p[1])) : widthMm / 3;
    const width = Math.max(widthMm * 1.5, (maxX - minX) * 1.3, (maxY - minY) * 1.3 * 1.5);
    const height = width / 1.5;
    return { x: (minX + maxX - width) / 2, y: -(minY + maxY + height) / 2, width, height };
  }, [target, predicted, pendingStroke, widthMm]);
  const lockedBounds = useRef(bounds);
  const view = drawing ? lockedBounds.current : bounds;
  const grid = view.width <= 300 ? 10 : Math.ceil(view.width / 300) * 10;
  const toSvg = (points: readonly Point2[]) => points.map(p => `${p[0]},${-p[1]}`).join(' ');

  function pointFromEvent(event: PointerEvent<SVGSVGElement>): Point2 | undefined {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) return;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    if (p.x < view.x || p.x > view.x + view.width || p.y < view.y || p.y > view.y + view.height) return;
    return [p.x, -p.y];
  }

  function finish(event: PointerEvent<SVGSVGElement>, cancelled = false) {
    if (activePointer.current !== event.pointerId) return;
    const point = pointFromEvent(event);
    if (point && stroke.current.length < 512) stroke.current.push(point);
    const points = stroke.current;
    activePointer.current = null;
    stroke.current = [];
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDrawing(null);
    if (!cancelled) {
      if (tooManyPoints.current) onError('The drawing exceeded 512 points. Draw a simpler loop; the previous path has been kept.');
      else onDraw(points);
    }
  }

  const shown = drawing ?? (pendingStroke.length ? pendingStroke : target);
  const first = shown[0];
  const last = shown.at(-1);
  return <figure className="min-w-0 overflow-hidden rounded-lg border border-slate-700 bg-[#080e19]">
    <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3 text-xs">
      <span className="font-medium text-slate-100">Your path in millimetres</span>
      <span className="text-slate-400">Grid: {grid} mm · drag to draw a new loop</span>
    </figcaption>
    <svg ref={svgRef} viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} role="img"
      aria-label="Path drawing area. Drag one closed loop, or use the keyboard point editor below. Teal is your target; orange is the predicted linkage path."
      className={`block h-[42vh] min-h-[220px] max-h-[380px] w-full touch-none select-none ${disabled ? 'cursor-default' : 'cursor-crosshair'}`}
      onPointerDown={event => {
        if (disabled || event.button !== 0 || activePointer.current !== null) return;
        const point = pointFromEvent(event);
        if (!point) return;
        event.preventDefault();
        lockedBounds.current = bounds;
        activePointer.current = event.pointerId;
        tooManyPoints.current = false;
        stroke.current = [point];
        event.currentTarget.setPointerCapture(event.pointerId);
        setDrawing([point]);
        onBegin();
      }}
      onPointerMove={event => {
        if (disabled || activePointer.current !== event.pointerId) return;
        const point = pointFromEvent(event);
        if (!point) return;
        const previous = stroke.current.at(-1)!;
        const minDistance = view.width / 400;
        if (Math.hypot(point[0] - previous[0], point[1] - previous[1]) < minDistance) return;
        if (stroke.current.length >= 511) {
          tooManyPoints.current = true;
          return;
        }
        stroke.current.push(point);
        setDrawing([...stroke.current]);
      }}
      onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)}>
      <defs><pattern id={patternId} width={grid} height={grid} patternUnits="userSpaceOnUse">
        <path d={`M ${grid} 0 H 0 V ${grid}`} fill="none" stroke="#223046" strokeWidth={view.width / 1100} />
      </pattern></defs>
      <rect x={view.x} y={view.y} width={view.width} height={view.height} fill={`url(#${patternId})`} />
      <path d={`M ${view.x} 0 H ${view.x + view.width} M 0 ${view.y} V ${view.y + view.height}`} stroke="#40516a" strokeWidth={view.width / 1000} />
      {!drawing && !pendingStroke.length && predicted.length > 1 && <polyline points={toSvg(predicted)} fill="none" stroke="#fb923c" strokeWidth={view.width / 260} strokeLinejoin="round" />}
      {shown.length > 1 && <polyline points={toSvg(shown)} fill="none" stroke="#5eead4" strokeWidth={view.width / 330} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={drawing ? undefined : `${view.width / 100} ${view.width / 140}`} />}
      {first && <circle cx={first[0]} cy={-first[1]} r={view.width / 140} fill="#5eead4" stroke="#080e19" strokeWidth={view.width / 500} />}
      {!drawing && pendingStroke.length > 1 && first && last && <path d={`M ${last[0]} ${-last[1]} L ${first[0]} ${-first[1]}`} stroke="#fbbf24" fill="none" strokeWidth={view.width / 350} strokeDasharray={`${view.width / 90} ${view.width / 90}`} />}
      {!shown.length && <text x={view.x + view.width / 2} y={view.y + view.height / 2} textAnchor="middle" fill="#94a3b8" fontSize={view.width / 33}>Draw a loop, finishing near its start</text>}
      <text x={view.x + view.width * .035} y={view.y + view.height * .94} fill="#94a3b8" fontSize={view.width / 48}>X → · Y ↑</text>
    </svg>
    <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-800 px-4 py-2 text-[11px]">
      <span className="text-teal-300">┄ Your path</span><span className="text-orange-300">━ Predicted linkage path</span>
      {!!pendingStroke.length && <span className="text-amber-300">┄ Proposed closing segment</span>}
    </div>
  </figure>;
}
