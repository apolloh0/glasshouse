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

import type { NodeId, Program, Span, Stmt } from "../lang/ast.js";
import { children, spanIndex, visit, type AnyNode } from "../lang/walk.js";
import { STEP_KIND } from "../engine/trace.js";
import type { TraceView } from "../host/run.js";

export interface StmtRow {
  nodeId: NodeId;
  span: Span;
  steps: number[];
}

const STMT_KINDS = new Set(["state", "assign", "expr", "repeat", "for", "if", "return"]);

/** Every statement-completion step per node, in trace order. */
function stmtCompletions(view: TraceView): Map<NodeId, number[]> {
  const byNode = new Map<NodeId, number[]>();
  const trace = view.trace;
  for (let s = 0; s < trace.count; s++) {
    const row = trace.row(s);
    if (row.kind !== STEP_KIND.stmt) continue;
    const list = byNode.get(row.nodeId);
    if (list) list.push(s);
    else byNode.set(row.nodeId, [s]);
  }
  return byNode;
}

export function executedStatements(program: Program, view: TraceView): StmtRow[] {
  const spans = spanIndex(program);
  const rows: StmtRow[] = [];
  for (const [nodeId, steps] of stmtCompletions(view)) {
    const span = spans.get(nodeId);
    if (!span) continue;
    rows.push({ nodeId, span, steps });
  }
  rows.sort((a, b) => a.steps[0]! - b.steps[0]!);
  return rows;
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
  let loop: AnyNode | null = null;
  visit(program, (node) => {
    if (node.id === loopNodeId) loop = node;
  });
  const loopNode = loop as AnyNode | null;
  if (!loopNode || (loopNode.kind !== "repeat" && loopNode.kind !== "for")) {
    throw new Error("iterationGrid: node " + loopNodeId + " is not a repeat/for loop");
  }

  // Statements lexically inside the loop's subtree, source order (pre-order),
  // excluding the loop itself.
  const rowNodes: AnyNode[] = [];
  const rec = (n: AnyNode): void => {
    for (const kid of children(n)) {
      if (STMT_KINDS.has(kid.kind)) rowNodes.push(kid);
      rec(kid);
    }
  };
  rec(loopNode);

  // Iteration windows: the loop's LAST direct body statement completes once
  // per iteration; window i = (boundary_{i-1}, boundary_i], boundary_{-1}=-1.
  const completions = stmtCompletions(view);
  const lastStmt: Stmt = loopNode.body[loopNode.body.length - 1]!;
  const boundaries = completions.get(lastStmt.id) ?? [];
  const iterations = boundaries.length;
  const columns = Math.min(iterations, maxColumns);
  const truncated = iterations > maxColumns;

  const rows = rowNodes.map((node) => {
    const steps = completions.get(node.id) ?? [];
    const cells: (number | null)[] = new Array(columns).fill(null);
    let cursor = 0;
    for (let i = 0; i < columns; i++) {
      const lo = i === 0 ? -1 : boundaries[i - 1]!;
      const hi = boundaries[i]!;
      while (cursor < steps.length && steps[cursor]! <= lo) cursor++;
      if (cursor < steps.length && steps[cursor]! <= hi) {
        cells[i] = steps[cursor]!; // first completion in this window
      }
    }
    return { nodeId: node.id, span: node.span, cells };
  });

  return { loop: loopNodeId, iterations, columns, truncated, rows };
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
  // Rows: LEAF statement nodes inside frame/event blocks, source order.
  // Containers (if/repeat/for) complete every frame their header runs and
  // their spans swallow their branches — the cross-frame pattern the essay
  // wants is which LINES ran (Gate I demo b pins this; grids keep containers).
  const LEAF_KINDS = new Set(["state", "assign", "expr", "return"]);
  const rowNodes: AnyNode[] = [];
  const rec = (n: AnyNode): void => {
    for (const kid of children(n)) {
      if (LEAF_KINDS.has(kid.kind)) rowNodes.push(kid);
      rec(kid);
    }
  };
  for (const item of program.items) {
    if (item.kind === "frame" || item.kind === "event") rec(item);
  }
  const firstPerView = views.map(({ view }) => {
    const first = new Map<NodeId, number>();
    for (const [nodeId, steps] of stmtCompletions(view)) first.set(nodeId, steps[0]!);
    return first;
  });
  return rowNodes.map((node) => ({
    nodeId: node.id,
    span: node.span,
    frames: firstPerView.map((first) => first.get(node.id) ?? null),
  }));
}
