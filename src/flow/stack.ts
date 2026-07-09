// CONTRACT (types + semantics) — call attribution from the trace's
// callEnter/callExit rows (the "Phase 3+" deferral from phase2-spec §2).
// PURE. Lets the timeline say "rect(...) — via house(...) on line 14" and
// lets thumbnails group by call site.
//
// SEMANTICS (P3-T5):
//
//  callStackAt — the call-site node ids OPEN at (post-)step s, outermost
//  first: replay enter/exit rows with step <= s as a stack. Post-state
//  (D20): a callExit whose row IS step s has already closed its call.
//  Top-level code -> empty stack.
//
//  callSitesFor — for each completion of `nodeId`, the INNERMOST open call
//  site (or -1 at top level), grouped: one entry per distinct site, steps
//  ascending, entries ordered by first step. house-row: all five rect
//  completions attribute to the single house(...) call site in the repeat.

import type { NodeId, Program } from "../lang/ast.js";
import type { TraceView } from "../host/run.js";
import { TODO } from "../util/todo.js";

export function callStackAt(view: TraceView, step: number): NodeId[] {
  void view; void step;
  TODO("P3-T5", "post-state stack per header");
}

export interface CallSiteGroup {
  site: NodeId; // -1 = top level
  steps: number[];
}

export function callSitesFor(
  program: Program,
  view: TraceView,
  nodeId: NodeId,
): CallSiteGroup[] {
  void program; void view; void nodeId;
  TODO("P3-T5");
}
