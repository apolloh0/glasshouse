// CONTRACT (types + pinned math) — the transform layer's PURE model side.
// Matrix conventions are IMPLEMENTED here (they are decisions, and every
// consumer must share them); derivations over traces are P4a-T3 stubs.
//
// CONVENTIONS (D36) — canvas-style affine, column vectors, y-down:
//     | a  c  e |   x' = a*x + c*y + e
//     | b  d  f |   y' = b*x + d*y + f
//   Positive rotation turns CLOCKWISE ON SCREEN (the natural sense in a
//   y-down system; matches Canvas2D ctx.rotate).
//
//   One group's matrix: T(move) · T(around) · R(deg) · S(s) · T(-around)
//   — scale, then rotate, both about `around`, then move. Missing args
//   default: move (0,0), rotate 0, scale 1, around (0,0).
//   Nesting composes parent · child. Evaluators apply matrices EAGERLY at
//   emit (world coordinates in ops; display-list format unchanged).
//
// activeGroupsAt (P4a-T3) — groups are LEXICAL scopes, so "active at step
// s" is derived, not traced: a group G is active iff G's span lexically
// contains the node completing at s, OR contains any call site open in
// callStackAt(view, s) (code reached through a definition call is
// dynamically inside G without being lexically inside it). Matrix values
// come from G's arg expr rows: for each arg, the LATEST completion at
// step <= s (loops re-evaluate args each pass). Outermost first.
//
// axesGlyph (P4a-T3) — the coordinate-frame overlay, pinned like
// annotate.ts: origin = apply(m, 0,0); xTip = apply(m, len,0);
// yTip = apply(m, 0,len); returns
//   [ { kind:"axis", x1,y1, x2,y2, label:"x" },
//     { kind:"axis", x1,y1, x2,y2, label:"y" },
//     { kind:"origin", x, y } ]
// in exactly that order, len default 24. The studio draws it on the
// annotation overlay (never into display lists — D13 family).

import type { GroupBlock, NodeId, Program } from "../lang/ast.js";
import type { Value } from "../engine/values.js";
import { decodeValue } from "../engine/values.js";
import { STEP_KIND } from "../engine/trace.js";
import { visit } from "../lang/walk.js";
import type { TraceView } from "../host/run.js";
import { callStackAt } from "./stack.js";

/** Canvas-order affine matrix. */
export interface Mat { a: number; b: number; c: number; d: number; e: number; f: number }

export const IDENTITY: Mat = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** p · q — apply q first, then p (parent · child). */
export function mulMat(p: Mat, q: Mat): Mat {
  return {
    a: p.a * q.a + p.c * q.b,
    b: p.b * q.a + p.d * q.b,
    c: p.a * q.c + p.c * q.d,
    d: p.b * q.c + p.d * q.d,
    e: p.a * q.e + p.c * q.f + p.e,
    f: p.b * q.e + p.d * q.f + p.f,
  };
}

export function applyMat(m: Mat, x: number, y: number): { x: number; y: number } {
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}

/** One group's matrix from its (decoded) arg values. Missing = defaults. */
export function matrixFor(args: {
  move?: Value; rotate?: Value; scale?: Value; around?: Value;
}): Mat {
  const move = args.move && args.move.t === "point" ? args.move : { x: 0, y: 0 };
  const deg = args.rotate === undefined ? 0
    : args.rotate.t === "angle" ? args.rotate.deg
    : args.rotate.t === "num" ? args.rotate.v
    : 0;
  const s = args.scale && args.scale.t === "num" ? args.scale.v : 1;
  const around = args.around && args.around.t === "point" ? args.around : { x: 0, y: 0 };
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // R·S about the origin, conjugated by `around`, then the move. Normalize
  // -0 (e.g. -sin*s at deg 0) so identity is exactly IDENTITY.
  const z = (n: number): number => (Object.is(n, -0) ? 0 : n);
  const a = cos * s, b = sin * s, c = -sin * s, d = cos * s;
  return {
    a: z(a), b: z(b), c: z(c), d: z(d),
    e: z(move.x + around.x - (a * around.x + c * around.y)),
    f: z(move.y + around.y - (b * around.x + d * around.y)),
  };
}

export interface ActiveGroup {
  group: NodeId;
  /** This group's OWN matrix at that moment (not pre-composed). */
  matrix: Mat;
}

/** Active groups at (post-)step s, outermost first. */
export function activeGroupsAt(
  program: Program,
  view: TraceView,
  step: number,
): ActiveGroup[] {
  const trace = view.trace;
  if (trace.count === 0) return [];
  const clamped = Math.max(0, Math.min(step, trace.count - 1));

  // Groups, outermost first = pre-order; plus every node's span for the
  // lexical-containment checks.
  const groups: GroupBlock[] = [];
  const spanOf = new Map<NodeId, { start: number; end: number }>();
  visit(program, (node) => {
    spanOf.set(node.id, node.span);
    if (node.kind === "group") groups.push(node);
  });
  if (groups.length === 0) return [];

  // Positions that must be lexically inside an active group: the completing
  // node, plus any call site open at s (code reached through a definition
  // call is dynamically inside the group without being lexically inside).
  const anchors: { start: number; end: number }[] = [];
  const completing = spanOf.get(trace.row(clamped).nodeId);
  if (completing) anchors.push(completing);
  for (const site of callStackAt(view, clamped)) {
    const span = spanOf.get(site);
    if (span) anchors.push(span);
  }

  const contains = (outer: { start: number; end: number }, inner: { start: number; end: number }): boolean =>
    outer.start <= inner.start && inner.end <= outer.end;

  const active: ActiveGroup[] = [];
  for (const g of groups) {
    if (!anchors.some((a) => contains(g.span, a))) continue;
    // Arg values: the LATEST completion of each arg expr at step <= s
    // (loops re-evaluate args every pass).
    const args: { move?: Value; rotate?: Value; scale?: Value; around?: Value } = {};
    for (const arg of g.args) {
      let latest: Value | undefined;
      for (let s2 = 0; s2 <= clamped; s2++) {
        const row = trace.row(s2);
        if (row.kind !== STEP_KIND.expr || row.nodeId !== arg.value.id) continue;
        const v = decodeValue(row.valueTag, row.a, row.b, row.strIdx, (i) => trace.string(i));
        if (v !== null) latest = v;
      }
      if (latest !== undefined) {
        args[arg.label as "move" | "rotate" | "scale" | "around"] = latest;
      }
    }
    active.push({ group: g.id, matrix: matrixFor(args) });
  }
  return active;
}

export type AxesOp =
  | { kind: "axis"; x1: number; y1: number; x2: number; y2: number; label: "x" | "y" }
  | { kind: "origin"; x: number; y: number };

export function axesGlyph(m: Mat, len = 24): AxesOp[] {
  const o = applyMat(m, 0, 0);
  const xTip = applyMat(m, len, 0);
  const yTip = applyMat(m, 0, len);
  return [
    { kind: "axis", x1: o.x, y1: o.y, x2: xTip.x, y2: xTip.y, label: "x" },
    { kind: "axis", x1: o.x, y1: o.y, x2: yTip.x, y2: yTip.y, label: "y" },
    { kind: "origin", x: o.x, y: o.y },
  ];
}
