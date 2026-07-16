// CONTRACT — ROTATION HANDLES (Phase 6, D61; resolves the 4a §6 / D44
// thread). On-stage manipulation gains angles WITHOUT touching D44:
// inversion still never solves through a matrix for its angle. Instead a
// rotation handle is an on-stage ANGLE WIDGET — it edits a rotate literal
// directly, the same species as 4a's inline angle widget, drawn at the
// group's fixed point.
//
// Rules (P6-T6):
//   A group earns a handle iff its `rotate` arg is a NumberLit or an
//   AngleLit (computed rotate — e.g. pinwheel's `spin + i * 90` — gets NO
//   handle, consistent with D39's literal-only discipline; that's what the
//   4b drag-vs-angle boundary is for). The handle sits at the group's
//   fixed point: `around`'s literal value when present, else the anchor
//   solved by flow/transform's anchorOf for the active matrix.
//   apply(deg) splices per D39/widget rules (suffix style preserved for
//   angle literals; bare numbers stay bare). Identity pin as ever:
//   0 fresh / 0 dropped.

import type { NodeId, Program, Span } from "../lang/ast.js";
import { TODO } from "../util/todo.js";

export interface RotationHandle {
  group: NodeId;
  /** Stage position of the handle (the group's fixed point). */
  x: number;
  y: number;
  deg: number;
  span: Span; // the rotate literal
  apply: (deg: number) => string;
}

export function rotationHandles(
  program: Program,
  source: string,
): RotationHandle[] {
  void program; void source;
  TODO("P6-T6", "literal-rotate groups only; fixed-point placement");
}
