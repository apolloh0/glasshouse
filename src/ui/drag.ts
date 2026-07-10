// CONTRACT (types + rules) — direct adjustment WITHOUT provenance: every
// literal is a control (plan §4.4: draggable numbers, inline color/angle
// widgets, on-stage point handles). PURE: these return SPECS with an
// apply() that splices NEW SOURCE; the studio owns pointer capture and the
// debounced rerun. Provenance-driven dragging of computed values is Phase
// 4b — nothing here inverts arithmetic.
//
// RULES (P4a-T6, D39):
//
//  numberDragAt — offset must sit on a NumberLit. step comes from the
//  literal's TEXTUAL form: contains "." -> 0.1, else 1 (unary minus is
//  part of the enclosing expression, not the literal). apply(v) rounds v
//  to the step's precision, formats WITHOUT trailing zeros beyond it
//  ("35", "0.9"), splices over the literal's span, returns the new source.
//  Splices preserve identity: re-parse + IdTracker across the edit must
//  show 0 fresh / 0 dropped (tested).
//
//  widgetAt — a color literal yields { kind:"color", rgb, apply(rgb) }
//  (apply writes uppercase #RRGGBB); an angle literal yields
//  { kind:"angle", deg, apply(deg) } (apply keeps the literal's suffix
//  style: ° stays °, deg stays deg). Anything else: null.
//
//  pointHandles — every PointLit whose x AND y are both NumberLits and
//  which sits anywhere inside a CALL or GROUP argument, in pre-order: the stage
//  draws a handle at (x, y) and dragging splices BOTH literals via
//  applyBoth (same rounding rule as numberDragAt, per component). Points
//  with computed components have no handle in 4a (that is 4b's job).

import type { NodeId, Program, Span } from "../lang/ast.js";
import { TODO } from "../util/todo.js";

export interface NumberDrag {
  span: Span;
  value: number;
  step: 1 | 0.1;
  apply: (v: number) => string;
}

export function numberDragAt(
  program: Program,
  source: string,
  offset: number,
): NumberDrag | null {
  void program; void source; void offset;
  TODO("P4a-T6", "textual-form step + identity-preserving splice");
}

export type Widget =
  | { kind: "color"; span: Span; rgb: number; apply: (rgb: number) => string }
  | { kind: "angle"; span: Span; deg: number; apply: (deg: number) => string };

export function widgetAt(
  program: Program,
  source: string,
  offset: number,
): Widget | null {
  void program; void source; void offset;
  TODO("P4a-T6");
}

export interface PointHandle {
  /** The PointLit node. */
  nodeId: NodeId;
  x: number;
  y: number;
  xSpan: Span;
  ySpan: Span;
  applyBoth: (x: number, y: number) => string;
}

export function pointHandles(program: Program, source: string): PointHandle[] {
  void program; void source;
  TODO("P4a-T6", "literal-only points inside call args, pre-order");
}
