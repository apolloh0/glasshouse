// CONTRACT (types + semantics) — the executed-lines timeline (plan R3: the
// essay's "which lines ran, when, in what pattern"). PURE over TraceViews.
//
// SEMANTICS (P2-T4):
//
//  executedStatements — one row per STATEMENT node that completed at least
//  once in the trace, ordered by FIRST completion step; `steps` lists every
//  completion, ascending. (Completion is post-order in time, so a loop's
//  own row appears after its body's rows. That is correct and on purpose —
//  the timeline shows when things FINISH, which is when their effects
//  exist.)
//
//  iterationGrid — the essay's loop pattern view. For a repeat/for node:
//    columns = iterations, up to maxColumns (D18: keep the FIRST maxColumns,
//    set truncated; summarization arrives with Phase 3 aggregates).
//    Iteration windows: the loop's LAST direct body statement completes
//    exactly once per iteration; window i spans (prevBoundary, boundary_i].
//    rows = every statement node LEXICALLY inside the loop's subtree, in
//    source order. cells[i] = that row's completion step inside window i,
//    or null (a branch not taken — the pattern the essay wants visible).
//    Statements of user definitions CALLED from the loop are not lexically
//    inside it and do not appear (attributing those needs call-tree work
//    that belongs to a later phase).
//
//  executedInFrames — the same idea across FRAMES: rows = statement nodes
//  inside frame/event blocks (source order); cell per supplied frame = the
//  first completion step in that frame's trace, or null. The studio feeds
//  this a window of Session.traceAt(k) views around the focused frame.

import type { NodeId, Program, Span } from "../lang/ast.js";
import type { TraceView } from "../host/run.js";
import { TODO } from "../util/todo.js";

export interface StmtRow {
  nodeId: NodeId;
  span: Span;
  steps: number[];
}

export function executedStatements(program: Program, view: TraceView): StmtRow[] {
  void program; void view;
  TODO("P2-T4");
}

export interface IterationGrid {
  loop: NodeId;
  /** True iteration count observed in the trace. */
  iterations: number;
  /** Columns actually present (min(iterations, maxColumns)). */
  columns: number;
  truncated: boolean;
  rows: { nodeId: NodeId; span: Span; cells: (number | null)[] }[];
}

export function iterationGrid(
  program: Program,
  view: TraceView,
  loopNodeId: NodeId,
  maxColumns = 64,
): IterationGrid {
  void program; void view; void loopNodeId; void maxColumns;
  TODO("P2-T4", "iteration windows per header");
}

export interface FrameRow {
  nodeId: NodeId;
  span: Span;
  /** One cell per entry of `views`, in the given order. */
  frames: (number | null)[];
}

export function executedInFrames(
  program: Program,
  views: { frame: number; view: TraceView }[],
): FrameRow[] {
  void program; void views;
  TODO("P2-T4");
}
