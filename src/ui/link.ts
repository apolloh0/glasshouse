// CONTRACT (types + mapping rules) — cross-highlighting is two PURE
// functions over (display list, program). No DOM here; src/editor/ and
// apps/studio own presentation.
//
// Definitions (P1-T4):
//   code -> stage: an op is SELECTED by a source span S iff
//     (a) the span of the op's sourceNodeId (the draw call) intersects S, or
//     (b) S intersects a call site whose callee resolves — transitively
//         through user definitions — to the Definition that lexically
//         contains the op's sourceNodeId.
//     (b) is a STATIC approximation, on purpose: selecting one house(...)
//     call site selects every house's ops across all iterations. Attributing
//     ops to one specific call/iteration needs the trace and is Phase 2.
//   stage -> code: the span to highlight for an op is the span of its
//     sourceNodeId (the draw call that emitted it), always a single call.
//
// staticOps (setup drawing, decision D5) participate exactly like frame ops:
// the display list a caller passes in is the FULL per-frame list, with op
// indices matching what renderDisplayList draws.

import type { NodeId, Program, Span } from "../lang/ast.js";
import type { DisplayOp } from "../render/displayList.js";
import { TODO } from "../util/todo.js";

/** Op indices (into `ops`) that a selection of `span` should light up. */
export function opsForSpan(
  ops: readonly DisplayOp[],
  program: Program,
  span: { start: number; end: number },
): number[] {
  void ops; void program; void span;
  TODO("P1-T4", "code -> stage mapping per header rules");
}

/** Source span to highlight when hovering op `opIndex`; null if the op's
 *  sourceNodeId is unknown to this program (should not happen in Phase 1). */
export function spanForOp(
  ops: readonly DisplayOp[],
  program: Program,
  opIndex: number,
): Span | null {
  void ops; void program; void opIndex;
  TODO("P1-T4", "stage -> code mapping per header rules");
}

/** All node ids on the path from a node to its top-level item, inclusive.
 *  Helper contract for opsForSpan; implement with walk.ts. */
export function ancestorIds(program: Program, id: NodeId): NodeId[] {
  void program; void id;
  TODO("P1-T4");
}
