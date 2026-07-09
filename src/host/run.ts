// CONTRACT — Session: the one object the debug UI and tests talk to (T8).
import type { FrameInputs } from "../engine/frame.js";
import type { EngineState } from "../engine/frame.js";
import type { DisplayList } from "../render/displayList.js";
import type { StepStore } from "../engine/trace.js";
import type { Program } from "../lang/ast.js";
import type { StaticLayer } from "../engine/frame.js";
import { evalFrame, NO_INPUT, runSetup } from "../engine/frame.js";
import { History, snapshotState } from "../engine/history.js";
import { parse } from "../lang/parser.js";
import { TODO } from "../util/todo.js";

export interface TraceView {
  trace: StepStore;
  display: DisplayList; // instrumented re-run's display (must equal fast run's)
}

export class Session {
  readonly program: Program;
  private readonly seed: number;
  private readonly staticLayer: StaticLayer;
  private readonly history = new History();
  private live: EngineState;
  /** State as it left setup = state entering frame 0 (kept for peeking at
   *  frame 0 before anything has been advanced). */
  private readonly initialState: EngineState;

  /** Parse + runSetup. Throws ChalkError with span on bad source. */
  constructor(source: string, seed: number) {
    this.program = parse(source);
    this.seed = seed;
    const setup = runSetup(this.program, seed);
    this.live = setup.state;
    this.staticLayer = setup.staticLayer;
    this.initialState = snapshotState(setup.state);
  }

  /** Run the next frame in fast mode, record into History. */
  advance(inputs: FrameInputs): DisplayList {
    const frameIndex = this.live.frameIndex;
    const entering = snapshotState(this.live);
    const result = evalFrame(this.program, this.staticLayer, this.live, inputs, "fast");
    this.history.record(frameIndex, entering, inputs, result.display);
    return result.display;
  }

  /** Convenience: run n frames; script maps frameIndex -> inputs. */
  advanceFrames(n: number, script?: Map<number, FrameInputs>): void {
    for (let i = 0; i < n; i++) {
      this.advance(script?.get(this.live.frameIndex) ?? NO_INPUT);
    }
  }

  frameCount(): number { return this.history.frameCount(); }

  /** Exact display list for any recorded frame (ring hit or keyframe replay).
   *  A static picture (no frame/event blocks, D5) draws once at setup and
   *  that display IS every frame — no history needed. */
  displayAt(k: number): DisplayList {
    if (this.program.frames.length === 0 && this.program.events.length === 0) {
      return { bg: this.staticLayer.bg, ops: this.staticLayer.ops };
    }
    if (k === 0 && this.history.frameCount() === 0) {
      // Peek at frame 0 before any advance (fresh session, editor loop):
      // derive it from the setup state with no input, without recording.
      return evalFrame(this.program, this.staticLayer, this.stateAt(0), NO_INPUT, "fast").display;
    }
    const hit = this.history.displayAt(k);
    if (hit !== null) return hit;
    const state = this.stateAt(k);
    return evalFrame(this.program, this.staticLayer, state, this.history.inputsAt(k), "fast").display;
  }

  /** State as it was ENTERING frame k (deep copy; derived by replay). */
  stateAt(k: number): EngineState {
    if (k === 0) return snapshotState(this.initialState);
    if (k < 0 || k >= this.history.frameCount()) {
      throw new Error("Session.stateAt: frame " + k + " was never run");
    }
    const kf = this.history.nearestKeyframeAtOrBefore(k);
    const state = kf.state;
    for (let j = kf.frameIndex; j < k; j++) {
      evalFrame(this.program, this.staticLayer, state, this.history.inputsAt(j), "fast");
    }
    return state;
  }

  /** Phase 3 (D24) — the recorded inputs of frame k. Inputs are state: the
   *  panel shows pointer position/buttons with the same machinery as vars.
   *  Passthrough to History.inputsAt. */
  inputsAt(k: number): FrameInputs { void k; TODO("P3-T2", "Session.inputsAt"); }

  /** Two-tier upper tier: re-run frame k instrumented, from stateAt(k).
   *  Focusing frame 0 on a fresh session traces the same NO_INPUT frame the
   *  displayAt(0) peek shows (pure: replays a snapshot, records nothing). */
  traceAt(k: number): TraceView {
    const state = this.stateAt(k);
    const inputs = k === 0 && this.history.frameCount() === 0
      ? NO_INPUT
      : this.history.inputsAt(k);
    const result = evalFrame(this.program, this.staticLayer, state, inputs, "instrumented");
    return { trace: result.trace!, display: result.display };
  }

  /** Phase 2 (D21) — re-run SETUP instrumented: the scrubbable trace for
   *  static pictures. display carries the setup ops (bg applied); callers
   *  pass staticOpsCount = 0 to flow/steps.ts for this view. */
  traceSetup(): TraceView {
    const setup = runSetup(this.program, this.seed, "instrumented");
    return {
      trace: setup.trace!,
      display: { bg: setup.staticLayer.bg, ops: setup.staticLayer.ops },
    };
  }
}
