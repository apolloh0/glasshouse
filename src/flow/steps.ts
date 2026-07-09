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
import { spanIndex, visit } from "../lang/walk.js";
import { STEP_KIND } from "../engine/trace.js";
import type { TraceView } from "../host/run.js";

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
  const ops = view.display.ops;
  // Frame ops sit after the static prefix and are emitted in ascending
  // stepIndex order — count the prefix with stepIndex <= step (D20).
  let upToOp = staticOpsCount;
  for (let i = staticOpsCount; i < ops.length; i++) {
    if (ops[i]!.stepIndex > step) break;
    upToOp++;
  }
  const row = view.trace.row(step);
  const span = spanIndex(program).get(row.nodeId);
  if (!span) throw new Error("scrubView: trace row " + step + " references unknown node " + row.nodeId);
  return { upToOp, nodeId: row.nodeId, span };
}

export function stepsForSpan(
  program: Program,
  view: TraceView,
  span: { start: number; end: number },
): number[] {
  // Statement completions whose span lies inside the selection (the scrubber
  // snaps line-wise; expression-level stepping is deliberately not Phase 2).
  const stmtIds = new Set<NodeId>();
  visit(program, (node) => {
    switch (node.kind) {
      case "state": case "assign": case "expr":
      case "repeat": case "for": case "if": case "return":
        if (node.span.start >= span.start && node.span.end <= span.end) {
          stmtIds.add(node.id);
        }
        break;
      default:
        break;
    }
  });
  const steps: number[] = [];
  const trace = view.trace;
  for (let s = 0; s < trace.count; s++) {
    const row = trace.row(s);
    if (row.kind === STEP_KIND.stmt && stmtIds.has(row.nodeId)) steps.push(s);
  }
  return steps;
}
