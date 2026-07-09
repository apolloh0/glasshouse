// CONTRACT (types + semantics) — the step scrubber model (plan R3 "follow
// the flow"). PURE functions over a TraceView; the studio owns the slider.
//
// SEMANTICS (P2-T3): the scrubber position `step` shows the world AFTER
// step `step` completes (post-state; D20). A step is a pre-order node
// completion (phase0-spec §1), so scrubbing runs 0..stepCount-1 and the
// last position shows the finished frame.
//
//   upToOp — how many ops of the FULL per-frame display list are visible:
//     staticOpsCount + |{ frame ops with stepIndex <= step }|.
//     (Trace op indices are frame-local; display index = staticOpsCount +
//     frame op index — see FrameResult in engine/frame.ts.)
//     For a setup trace (Session.traceSetup, D21), pass staticOpsCount = 0:
//     the setup's own ops ARE the display list being scrubbed.
//   nodeId/span — the node completing at `step`, for the editor highlight.
//
// stepsForSpan supports "play just this line": the completion steps of
// STATEMENT nodes whose span lies inside `span`, ascending. (Statements,
// not expressions: the scrubber snaps line-wise; expression-level stepping
// is deliberately not a Phase 2 feature.)

import type { NodeId, Program, Span } from "../lang/ast.js";
import type { TraceView } from "../host/run.js";
import { TODO } from "../util/todo.js";

export interface ScrubView {
  upToOp: number;
  nodeId: NodeId;
  span: Span;
}

/** Total scrubber positions for this trace. */
export function stepCount(view: TraceView): number {
  return view.trace.count;
}

export function scrubView(
  program: Program,
  staticOpsCount: number,
  view: TraceView,
  step: number,
): ScrubView {
  void program; void staticOpsCount; void view; void step;
  TODO("P2-T3", "post-state scrub semantics per header");
}

export function stepsForSpan(
  program: Program,
  view: TraceView,
  span: { start: number; end: number },
): number[] {
  void program; void view; void span;
  TODO("P2-T3");
}
