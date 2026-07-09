// CONTRACT (types + semantics) — typed timeline cells (plan §4.3: "the
// timeline's cells graduate from marks to VALUES"). PURE over TraceViews.
//
// SEMANTICS (P3-T3):
//
//  Cell classification for a statement completion (pinned, D26):
//    assign / state-decl  -> { kind:"value" } — the write's value
//    expr stmt that emitted ops (opEnd > opStart on its completion row)
//                         -> { kind:"ops" } — frame-local op range; the
//                            studio renders an EXACT thumbnail via
//                            glyphs.thumbnailFit (D27)
//    everything else (repeat/for/if/return and op-less expr stmts)
//                       -> { kind:"mark" }
//
//  valuesForNode — every value an EXPRESSION node took, in step order,
//  decoded from its expr rows. This answers the essay's scaleFactor
//  questions ("what values does it take? how does it change?") for ANY
//  hovered expression, because Phase 0 already traces every expression
//  completion with its value — no new tracing (D25).
//
//  numericSummary / stridedSamples — the per-node aggregates that let the
//  timeline scale by visualization instead of truncation: min/max/first/
//  last/mean/count, and n evenly-strided samples (indices
//  round(i*(len-1)/(n-1)), deduplicated, order preserved).
//
//  cellZoomMode — pinned threshold (D26): cell width >= 28 px shows
//  figures; below that, rows render as plots (sparkline over the row's
//  numeric values). One threshold, no hysteresis, no opinions per pane.

import type { NodeId, Program } from "../lang/ast.js";
import type { Value } from "../engine/values.js";
import type { TraceView } from "../host/run.js";
import { TODO } from "../util/todo.js";

export type Cell =
  | { kind: "value"; step: number; value: Value }
  | { kind: "ops"; step: number; opStart: number; opEnd: number }
  | { kind: "mark"; step: number };

/** One cell per completion of statement `nodeId`, in step order. */
export function valueCells(
  program: Program,
  view: TraceView,
  nodeId: NodeId,
): Cell[] {
  void program; void view; void nodeId;
  TODO("P3-T3", "classification per header (D26)");
}

/** Every value expression `nodeId` took in this trace, in step order. */
export function valuesForNode(view: TraceView, nodeId: NodeId): Value[] {
  void view; void nodeId;
  TODO("P3-T3");
}

export interface NumericSummary {
  count: number;
  min: number;
  max: number;
  first: number;
  last: number;
  mean: number;
}

export function numericSummary(values: readonly number[]): NumericSummary {
  void values;
  TODO("P3-T3");
}

export function stridedSamples<T>(xs: readonly T[], n: number): T[] {
  void xs; void n;
  TODO("P3-T3", "indices round(i*(len-1)/(n-1)), deduped");
}

export function cellZoomMode(cellWidthPx: number): "figures" | "plot" {
  void cellWidthPx;
  TODO("P3-T3", ">= 28 px -> figures (D26)");
}
