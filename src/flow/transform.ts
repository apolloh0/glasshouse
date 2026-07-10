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

import type { NodeId, Program } from "../lang/ast.js";
import type { Value } from "../engine/values.js";
import type { TraceView } from "../host/run.js";
import { TODO } from "../util/todo.js";

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
  void args;
  TODO("P4a-T3", "T(move)·T(around)·R·S·T(-around) per header");
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
  void program; void view; void step;
  TODO("P4a-T3", "lexical containment + open call sites per header");
}

export type AxesOp =
  | { kind: "axis"; x1: number; y1: number; x2: number; y2: number; label: "x" | "y" }
  | { kind: "origin"; x: number; y: number };

export function axesGlyph(m: Mat, len = 24): AxesOp[] {
  void m; void len;
  TODO("P4a-T3", "pinned order: x axis, y axis, origin");
}
