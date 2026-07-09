// CONTRACT — the frame loop API (plan §5.2). Frame index is the only clock.
import type { Program } from "../lang/ast.js";
import type { Value } from "./values.js";
import { encodeValue } from "./values.js";
import type { Prng } from "./prng.js";
import { makePrng } from "./prng.js";
import type { DisplayList, DisplayOp, Rgb } from "../render/displayList.js";
import { StepStore, STEP_KIND, VTAG } from "./trace.js";
import { execBlock, type EvalContext, type Tracer } from "./evaluator.js";
import { TODO } from "../util/todo.js";

export type InputEvent =
  | { type: "pointer-pressed"; x: number; y: number }
  | { type: "pointer-released"; x: number; y: number }
  | { type: "pointer-moved"; x: number; y: number }
  | { type: "key"; key: string };

export interface FrameInputs {
  pointer: { x: number; y: number; down: boolean };
  events: InputEvent[];
}

export const NO_INPUT: FrameInputs = Object.freeze({
  pointer: Object.freeze({ x: 0, y: 0, down: false }),
  events: Object.freeze([]) as unknown as InputEvent[],
});

/** Everything that can change frame-to-frame. History snapshots this (T6). */
export interface EngineState {
  vars: Map<string, Value>; // `state` variables only
  rng: Prng;
  frameIndex: number;
}

/** Setup output: constant across the whole run (D5). */
export interface StaticLayer {
  bg: Rgb | null;
  ops: DisplayOp[]; // sourceNodeId/stepIndex refer to the setup pass
}

export type EvalMode = "fast" | "instrumented";

export interface FrameResult {
  display: DisplayList;      // staticLayer.ops first, then this frame's ops
  state: EngineState;        // the SAME object, mutated (history clones)
  trace: StepStore | null;   // non-null iff mode === "instrumented"
  // NOTE: trace op indices (opStart/opEnd) index THIS FRAME's ops only;
  // display index = staticLayer.ops.length + traceOpIndex.
}

/**
 * T5 — run setup once: evaluate top-level statements (state decls populate
 * vars; draw calls populate the static layer; paper sets bg; `pointer` and
 * assignment are unavailable — parser already rejects assignment, evaluator
 * rejects `pointer`). Deterministic: consumes the PRNG stream.
 *
 * D21 (Phase 2): `mode` defaults to "fast". With "instrumented", setup runs
 * through the SAME tracer hooks as frames (invariant 3 — one code path) and
 * `trace` is non-null; staticLayer op stepIndex values refer to that setup
 * trace. Scrubbing a static picture (Session.traceSetup) depends on this.
 */
/** Build the mode's tracer: rows go to a fresh StepStore when instrumented,
 *  nowhere in fast mode (T7 wiring; write-row encoding per D25). */
function makeTracer(
  mode: EvalMode,
  ops: DisplayOp[],
): { trace: StepStore | null; tracer: Tracer | null } {
  if (mode !== "instrumented") return { trace: null, tracer: null };
  const store = new StepStore();
  const intern = (s: string): number => store.intern(s);
  const tracer: Tracer = {
    onStep(nodeId, kind, value, opStart, opEnd) {
      const e = encodeValue(value, intern);
      store.push(nodeId, kind, e.tag, e.a, e.b, e.strIdx, opStart, opEnd);
    },
    onWrite(nodeId, name, value) {
      // D25: strIdx carries the var NAME; a string value's intern index
      // moves to `a`.
      const e = encodeValue(value, intern);
      const a = e.tag === VTAG.str ? e.strIdx : e.a;
      store.push(nodeId, STEP_KIND.write, e.tag, a, e.b, intern(name),
        ops.length, ops.length);
    },
  };
  return { trace: store, tracer };
}

export function runSetup(
  program: Program,
  seed: number,
  mode: EvalMode = "fast",
): { state: EngineState; staticLayer: StaticLayer; trace: StepStore | null } {
  const ops: DisplayOp[] = [];
  const { trace, tracer } = makeTracer(mode, ops);
  const ctx: EvalContext = {
    program,
    vars: new Map(),
    locals: [],
    rng: makePrng(seed),
    inputs: null,
    ops,
    bg: null,
    inSetup: true,
    stepIndex: 0,
    tracer,
  };
  execBlock(ctx, program.setup);
  return {
    state: { vars: ctx.vars, rng: ctx.rng, frameIndex: 0 },
    staticLayer: { bg: ctx.bg, ops: ctx.ops },
    trace,
  };
}

/**
 * T5 — evaluate one frame: `every frame:` blocks in source order, then event
 * blocks matching inputs.events in source order. MUTATES state (vars, rng,
 * frameIndex++). `pointer` is bound from inputs for the duration.
 */
export function evalFrame(
  program: Program,
  staticLayer: StaticLayer,
  state: EngineState,
  inputs: FrameInputs,
  mode: EvalMode,
): FrameResult {
  void program; void staticLayer; void state; void inputs; void mode;
  TODO("T5", "evalFrame");
}
