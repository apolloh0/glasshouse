// CONTRACT — evaluator internals shared by frame.ts (T4/T7).
// ONE code path, two modes: every node-completion site calls finishStep once;
// tracing hides behind `if (ctx.tracer)` (CLAUDE.md invariant 3).
import type { Expr, NodeId, Stmt } from "../lang/ast.js";
import type { Value } from "./values.js";
import type { Prng } from "./prng.js";
import type { DisplayOp, Rgb } from "../render/displayList.js";
import type { FrameInputs } from "./frame.js";
import type { Program } from "../lang/ast.js";
import { STEP_KIND, type StepKindCode } from "./trace.js";
import { TODO } from "../util/todo.js";

export interface Tracer {
  /** Record a completed step. `value` null for pure control steps. */
  onStep(nodeId: NodeId, kind: StepKindCode, value: Value | null, opStart: number, opEnd: number): void;
  /** Record a state/local write (its own row, kind = write). */
  onWrite(nodeId: NodeId, name: string, value: Value): void;
}

export interface EvalContext {
  program: Program;
  vars: Map<string, Value>;          // `state` variables
  locals: Map<string, Value>[];      // scope stack: loop counters, params
  rng: Prng;
  inputs: FrameInputs | null;        // null during setup (`pointer` illegal)
  ops: DisplayOp[];                  // this pass's emitted ops
  bg: Rgb | null;                    // mutated by paper() during setup
  inSetup: boolean;
  stepIndex: number;                 // pre-order completion counter
  tracer: Tracer | null;
}

/** The single choke point for step accounting (T4 structure, T7 wiring). */
export function finishStep(ctx: EvalContext, nodeId: NodeId, kind: StepKindCode, value: Value | null, opStart: number): number {
  const step = ctx.stepIndex++;
  if (ctx.tracer) ctx.tracer.onStep(nodeId, kind, value, opStart, ctx.ops.length);
  return step;
}

/** T4 — evaluate a statement list (a block). */
export function execBlock(ctx: EvalContext, body: Stmt[]): void {
  void ctx; void body;
  TODO("T4", "execBlock");
}

/** T4 — evaluate an expression to a Value (calls finishStep on completion). */
export function evalExpr(ctx: EvalContext, e: Expr): Value {
  void ctx; void e;
  TODO("T4", "evalExpr");
}

void STEP_KIND; // referenced by implementations
