// CONTRACT (types + policy) — INVERSION: turn a drag on the stage into
// candidate literal edits, honestly. The policy below (D45) is the whole
// disambiguation story; the correctness oracle is PREDICTION CONSISTENCY:
// apply a candidate, re-run, and the dragged attribute sits where the
// pointer pointed (within snapping). Never a clever edit that lands
// elsewhere.
//
// POLICY (D45):
//  scalarCandidates(chain, valueOf, delta) — one candidate per term with
//    coeff != 0: to = from + delta/coeff. Sorted by |to - from| ASCENDING
//    (the gentlest edit first), ties by source order (lit node id).
//    Opaque chain -> []. delta == 0 -> [].
//  dragCandidates(...) — solve x and y independently from attrChain
//    "anchor"; an axis with an opaque chain is reported in `unadjustable`
//    and produces no edits (the studio locks the drag to the live axis).
//    Zero-delta axes contribute no edits. Candidates = the per-axis
//    solutions cross-paired, capped at 6, ranked by TOTAL |Δlit| ascending
//    (ties: x's source order, then y's). A literal appearing in BOTH axes'
//    chains joins a candidate only if its two solved values agree within
//    1e-9; otherwise that pairing is skipped (never average, never lie).
//  applyCandidate(source, program, cand) — splice every edit (descending
//    span order) with drag.ts's D39 formatting rules (extract the shared
//    formatter rather than duplicating it); the result must parse and must
//    preserve identity: IdTracker across the edit shows 0 fresh /
//    0 dropped (tested, same pin as 4a's drags).
//
// The dragged shape may not be the only thing that moves — editing the 55
// in `20 + i * 55` re-spreads every house. That is the point: the learner
// watches the PROGRAM change, disambiguating "this one" (the 20) from
// "all of them" (the 55) by seeing both previews.

import type { NodeId, Program } from "../lang/ast.js";
import type { DisplayOp } from "../render/displayList.js";
import type { TraceView } from "../host/run.js";
import type { Chain } from "./provenance.js";
import { TODO } from "../util/todo.js";

export interface LitEdit { lit: NodeId; from: number; to: number }

export function scalarCandidates(
  chain: Chain,
  valueOf: (lit: NodeId) => number,
  delta: number,
): LitEdit[] {
  void chain; void valueOf; void delta;
  TODO("P4b-T3", "per-term solve + |Δ| ranking per header");
}

export interface DragCandidate { edits: LitEdit[] }

export interface DragSolve {
  candidates: DragCandidate[];
  unadjustable: ("x" | "y")[];
}

export function dragCandidates(
  program: Program,
  view: TraceView,
  ops: readonly DisplayOp[],
  opIndex: number,
  dx: number,
  dy: number,
): DragSolve {
  void program; void view; void ops; void opIndex; void dx; void dy;
  TODO("P4b-T3", "pairing + cap + ranking per header (D45)");
}

export function applyCandidate(
  source: string,
  program: Program,
  cand: DragCandidate,
): string {
  void source; void program; void cand;
  TODO("P4b-T3", "descending-span splices, D39 formatting, identity pin");
}
