// Run with the repository's existing test:all TSX loader.
// Exercises the actual compiled PathDrawing event handlers with controlled hook
// state and an SVG affine matrix. This is not browser rendering, React lifecycle
// acceptance, or a claim that a human freehand stroke was replayed in Chrome.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { validateTargetPath } from '../src/mechanisms/fourBarSynthesis.ts';

const require = createRequire(import.meta.url);
const { transformSync } = require('esbuild');
const compiled = transformSync(readFileSync(new URL('../src/components/mechanisms/PathDrawing.tsx', import.meta.url), 'utf8'), {
  loader: 'tsx', format: 'cjs', target: 'es2022', jsx: 'transform', jsxFactory: 'jsx', jsxFragment: 'Fragment',
}).code;
const plain = value => JSON.parse(JSON.stringify(value));

function assertPointsNear(actual, expected) {
  assert.equal(actual.length, expected.length);
  for (let point = 0; point < expected.length; point++) {
    assert.equal(actual[point].length, 2);
    for (let axis = 0; axis < 2; axis++) {
      // CTM inversion is IEEE-754 arithmetic; this sub-nanometre bound allows
      // rounding without hiding a screen-space scale, offset or Y-axis error.
      assert.ok(Math.abs(actual[point][axis] - expected[point][axis]) < 1e-10,
        `point ${point} axis ${axis}: ${actual[point][axis]} vs ${expected[point][axis]} mm`);
    }
  }
}

function affine(a, b, c, d, e, f) {
  const matrix = { a, b, c, d, e, f };
  return { ...matrix, inverse() {
    const determinant = a * d - b * c;
    return affine(d / determinant, -b / determinant, -c / determinant, a / determinant,
      (c * f - d * e) / determinant, (b * e - a * f) / determinant);
  } };
}

function harness(overrides = {}, matrix = affine(3, 0, 0, 3, 500, 200)) {
  const slots = []; let cursor = 0, svgNode, begins = 0;
  const drawn = [], errors = [], captures = new Set();
  const useRef = initial => { const index = cursor++; return slots[index] ??= { current: initial }; };
  const hooks = {
    useId: () => useRef('fixture-id').current,
    useRef,
    useMemo: factory => factory(),
    useState: initial => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
  };
  const exports = {}, module = { exports };
  const context = vm.createContext({ module, exports, require: name => {
    assert.equal(name, 'react', `unexpected runtime dependency ${name}`); return hooks;
  }, jsx: (type, props, ...children) => ({ type, props: { ...props, children } }),
  DOMPoint: class {
    constructor(x, y) { this.x = x; this.y = y; }
    matrixTransform(m) { return { x: m.a * this.x + m.c * this.y + m.e, y: m.b * this.x + m.d * this.y + m.f }; }
  } });
  vm.runInContext(compiled, context, { filename: 'PathDrawing.compiled.cjs' });
  const svg = {
    getScreenCTM: () => matrix,
    setPointerCapture: id => captures.add(id), hasPointerCapture: id => captures.has(id), releasePointerCapture: id => captures.delete(id),
  };
  let props = { target: [], predicted: [], pendingStroke: [], widthMm: 60, disabled: false,
    onBegin: () => { begins++; }, onDraw: points => drawn.push(plain(points)), onError: message => errors.push(message), ...overrides };
  function find(node) {
    if (Array.isArray(node)) return node.map(find).find(Boolean);
    if (!node || typeof node !== 'object') return;
    if (node.type === 'svg') return node;
    return find(node.props?.children);
  }
  function render() {
    cursor = 0;
    svgNode = find(module.exports.PathDrawing(props));
    assert.ok(svgNode, 'the shipped component rendered its SVG');
    svgNode.props.ref.current = svg;
  }
  render();
  return {
    drawn, errors, captures, begins: () => begins, svgProps: () => svgNode.props,
    setProps(next) { props = { ...props, ...next }; render(); },
    send(kind, worldPoint, extra = {}) {
      // Independent expected mapping: CAD Y-up becomes SVG Y-down, then CTM.
      const [x, y] = [worldPoint[0], -worldPoint[1]];
      const event = { pointerId: 7, button: 0, clientX: matrix.a * x + matrix.c * y + matrix.e,
        clientY: matrix.b * x + matrix.d * y + matrix.f, currentTarget: svg, preventDefault() {}, ...extra };
      svgNode.props[kind](event); render();
    },
  };
}

test('actual drawing handlers convert translated and letterboxed screen coordinates to millimetres with Y up', () => {
  for (const matrix of [affine(3, 0, 0, 3, 500, 200), affine(1.5, 0, 0, 1.5, 271, 119), affine(0, 2, -2, 0, 700, 150)]) {
    const h = harness({}, matrix);
    h.send('onPointerDown', [-20, -10]); h.send('onPointerMove', [10, 12]); h.send('onPointerUp', [20, 15]);
    assert.equal(h.begins(), 1); assert.equal(h.drawn.length, 1);
    assertPointsNear(h.drawn[0], [[-20, -10], [10, 12], [20, 15]]);
    assert.equal(h.captures.size, 0);
  }
});

test('a complete pointer stroke forms a valid closed ellipse through the shipped target validator', () => {
  const h = harness();
  const point = angle => [30 * Math.cos(angle), 16 * Math.sin(angle)];
  h.send('onPointerDown', point(0));
  for (let i = 1; i < 96; i++) h.send('onPointerMove', point(i * 2 * Math.PI / 96));
  h.send('onPointerUp', point(0));
  assert.equal(h.drawn.length, 1); assert.equal(h.errors.length, 0);
  const valid = validateTargetPath(h.drawn[0]);
  assert.equal(valid.length, 97);
  assert.ok(Math.abs(Math.max(...valid.map(p => p[0])) - Math.min(...valid.map(p => p[0])) - 60) < 1e-10);
  assert.ok(valid.some(p => p[1] > 15.99) && valid.some(p => p[1] < -15.99));
});

test('an open stroke stays open at the drawing boundary and is rejected until explicitly closed', () => {
  const h = harness();
  h.send('onPointerDown', [-20, -10]); h.send('onPointerMove', [20, -10]); h.send('onPointerUp', [0, 20]);
  const points = h.drawn[0];
  assert.notDeepEqual(points[0], points.at(-1), 'drawing code does not invent a closing segment');
  assert.throws(() => validateTargetPath(points), /clos/i);
  assert.equal(validateTargetPath([...points, points[0]]).length, 4);
});

test('disabled, secondary-button and outside-grid starts cannot replace a path', () => {
  const disabled = harness({ disabled: true });
  disabled.send('onPointerDown', [0, 0]); disabled.send('onPointerUp', [10, 10]);
  assert.equal(disabled.begins(), 0); assert.deepEqual(disabled.drawn, []);
  const secondary = harness();
  secondary.send('onPointerDown', [0, 0], { button: 2 }); secondary.send('onPointerUp', [10, 10]);
  assert.equal(secondary.begins(), 0); assert.deepEqual(secondary.drawn, []);
  const outside = harness();
  outside.send('onPointerDown', [1000, 1000]); outside.send('onPointerUp', [0, 0]);
  assert.equal(outside.begins(), 0); assert.deepEqual(outside.drawn, []);
});

test('pointer cancellation and another pointer leave the previous target untouched', () => {
  const h = harness({ target: [[-20, -10], [20, -10], [0, 20], [-20, -10]] });
  h.send('onPointerDown', [0, 0]); h.send('onPointerMove', [10, 10]);
  h.send('onPointerUp', [20, 15], { pointerId: 99 });
  assert.equal(h.captures.size, 1); assert.deepEqual(h.drawn, []);
  h.send('onPointerCancel', [15, 10]);
  assert.equal(h.captures.size, 0); assert.deepEqual(h.drawn, []);
});

test('a changing preview cannot shift the coordinate frame during a pointer stroke', () => {
  const h = harness();
  const originalView = h.svgProps().viewBox;
  h.send('onPointerDown', [-20, -10]);
  h.setProps({ predicted: [[800, 800], [1200, 1000]] });
  assert.equal(h.svgProps().viewBox, originalView);
  h.send('onPointerMove', [10, 10]); h.send('onPointerUp', [20, 15]);
  assertPointsNear(h.drawn[0], [[-20, -10], [10, 10], [20, 15]]);
  assert.notEqual(h.svgProps().viewBox, originalView, 'the viewport may fit changed content after drawing finishes');
});

test('an overlong stroke reports the vertex limit without committing a silently truncated loop', () => {
  const h = harness();
  h.send('onPointerDown', [0, 0]);
  for (let i = 0; i < 520; i++) h.send('onPointerMove', [i % 2 ? 10 : -10, i % 2 ? 10 : -10]);
  h.send('onPointerUp', [0, 0]);
  assert.deepEqual(h.drawn, []); assert.equal(h.captures.size, 0);
  assert.equal(h.errors.length, 1); assert.match(h.errors[0], /512.*previous path/i);
});
