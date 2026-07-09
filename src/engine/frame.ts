// CONTRACT — the frame loop API (plan §5.2). Frame index is the only clock.
import type { Program } from "../lang/ast.js";
import type { Value } from "./values.js";
import type { Prng } from "./prng.js";
import type { DisplayList, DisplayOp, Rgb } from "../render/displayList.js";
import type { StepStore } from "./trace.js";
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
export function runSetup(
  program: Program,
  seed: number,
  mode: EvalMode = "fast",
): { state: EngineState; staticLayer: StaticLayer; trace: StepStore | null } {
  void program; void seed; void mode;
  TODO("T5", "runSetup");
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
