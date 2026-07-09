// CONTRACT — Session: the one object the debug UI and tests talk to (T8).
import type { FrameInputs } from "../engine/frame.js";
import type { EngineState } from "../engine/frame.js";
import type { DisplayList } from "../render/displayList.js";
import type { StepStore } from "../engine/trace.js";
import { TODO } from "../util/todo.js";

export interface TraceView {
  trace: StepStore;
  display: DisplayList; // instrumented re-run's display (must equal fast run's)
}

export class Session {
  /** Parse + runSetup. Throws ChalkError with span on bad source. */
  constructor(source: string, seed: number) {
    void source; void seed;
    TODO("T8", "Session constructor");
  }

  /** Run the next frame in fast mode, record into History. */
  advance(inputs: FrameInputs): DisplayList { void inputs; TODO("T8", "Session.advance"); }

  /** Convenience: run n frames; script maps frameIndex -> inputs. */
  advanceFrames(n: number, script?: Map<number, FrameInputs>): void {
    void n; void script; TODO("T8", "Session.advanceFrames");
  }

  frameCount(): number { TODO("T8", "Session.frameCount"); }

  /** Exact display list for any recorded frame (ring hit or keyframe replay). */
  displayAt(k: number): DisplayList { void k; TODO("T8", "Session.displayAt"); }

  /** State as it was ENTERING frame k (deep copy; derived by replay). */
  stateAt(k: number): EngineState { void k; TODO("T8", "Session.stateAt"); }

  /** Phase 3 (D24) — the recorded inputs of frame k. Inputs are state: the
   *  panel shows pointer position/buttons with the same machinery as vars.
   *  Passthrough to History.inputsAt. */
  inputsAt(k: number): FrameInputs { void k; TODO("P3-T2", "Session.inputsAt"); }

  /** Two-tier upper tier: re-run frame k instrumented, from stateAt(k). */
  traceAt(k: number): TraceView { void k; TODO("T8", "Session.traceAt"); }

  /** Phase 2 (D21) — re-run SETUP instrumented: the scrubbable trace for
   *  static pictures. display carries the setup ops (bg applied); callers
   *  pass staticOpsCount = 0 to flow/steps.ts for this view. */
  traceSetup(): TraceView { TODO("P2-T3", "Session.traceSetup"); }
}
