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
import { STEP_KIND } from "../engine/trace.js";
import type { TraceView } from "../host/run.js";

export function callStackAt(view: TraceView, step: number): NodeId[] {
  const stack: NodeId[] = [];
  const trace = view.trace;
  const last = Math.min(step, trace.count - 1);
  for (let s = 0; s <= last; s++) {
    const row = trace.row(s);
    if (row.kind === STEP_KIND.callEnter) stack.push(row.nodeId);
    else if (row.kind === STEP_KIND.callExit) stack.pop();
    // post-state (D20): an exit AT step s has already closed its call.
  }
  return stack;
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
  void program; // attribution is trace-side
  const trace = view.trace;
  const groups = new Map<NodeId, number[]>();
  const order: NodeId[] = []; // entries ordered by first step
  const stack: NodeId[] = [];
  for (let s = 0; s < trace.count; s++) {
    const row = trace.row(s);
    if (row.kind === STEP_KIND.callEnter) { stack.push(row.nodeId); continue; }
    if (row.kind === STEP_KIND.callExit) { stack.pop(); continue; }
    if (row.nodeId !== nodeId) continue;
    if (row.kind !== STEP_KIND.stmt && row.kind !== STEP_KIND.expr) continue;
    const site = stack.length > 0 ? stack[stack.length - 1]! : -1;
    const list = groups.get(site);
    if (list) list.push(s);
    else { groups.set(site, [s]); order.push(site); }
  }
  return order.map((site) => ({ site, steps: groups.get(site)! }));
}
