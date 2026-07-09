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
import { decodeValue } from "../engine/values.js";
import { STEP_KIND, VTAG } from "../engine/trace.js";
import { visit } from "../lang/walk.js";
import type { TraceView } from "../host/run.js";

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
  let kind: string | null = null;
  visit(program, (n) => {
    if (n.id === nodeId) kind = n.kind;
  });
  const cells: Cell[] = [];
  const trace = view.trace;
  for (let s = 0; s < trace.count; s++) {
    const row = trace.row(s);
    if (row.kind !== STEP_KIND.stmt || row.nodeId !== nodeId) continue;
    if (kind === "assign" || kind === "state") {
      const value = decodeValue(row.valueTag, row.a, row.b, row.strIdx,
        (i) => trace.string(i));
      if (value !== null) {
        cells.push({ kind: "value", step: s, value });
        continue;
      }
    }
    if (kind === "expr" && row.opEnd > row.opStart) {
      cells.push({ kind: "ops", step: s, opStart: row.opStart, opEnd: row.opEnd });
      continue;
    }
    cells.push({ kind: "mark", step: s });
  }
  return cells;
}

/** Every value expression `nodeId` took in this trace, in step order. */
export function valuesForNode(view: TraceView, nodeId: NodeId): Value[] {
  const out: Value[] = [];
  const trace = view.trace;
  for (let s = 0; s < trace.count; s++) {
    const row = trace.row(s);
    if (row.kind !== STEP_KIND.expr || row.nodeId !== nodeId) continue;
    if (row.valueTag === VTAG.none) continue; // draw calls hand back nothing
    const value = decodeValue(row.valueTag, row.a, row.b, row.strIdx,
      (i) => trace.string(i));
    if (value !== null) out.push(value);
  }
  return out;
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
  if (values.length === 0) {
    return { count: 0, min: NaN, max: NaN, first: NaN, last: NaN, mean: NaN };
  }
  let min = values[0]!, max = values[0]!, sum = 0;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  return {
    count: values.length,
    min,
    max,
    first: values[0]!,
    last: values[values.length - 1]!,
    mean: sum / values.length,
  };
}

export function stridedSamples<T>(xs: readonly T[], n: number): T[] {
  if (xs.length === 0 || n <= 0) return [];
  if (n === 1 || xs.length === 1) return [xs[0]!];
  const out: T[] = [];
  let prevIdx = -1;
  for (let i = 0; i < n; i++) {
    const idx = Math.round((i * (xs.length - 1)) / (n - 1));
    if (idx !== prevIdx) out.push(xs[idx]!); // dedupe, order preserved
    prevIdx = idx;
  }
  return out;
}

export function cellZoomMode(cellWidthPx: number): "figures" | "plot" {
  return cellWidthPx >= 28 ? "figures" : "plot"; // ONE threshold (D26)
}
