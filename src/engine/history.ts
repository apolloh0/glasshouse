// CONTRACT — dumb deterministic store (plan §5.2 two-tier scheme, lower tier).
// Session (host/run.ts) owns replay; History only stores and hands back.
import type { EngineState, FrameInputs } from "./frame.js";
import type { DisplayList } from "../render/displayList.js";
import { TODO } from "../util/todo.js";

export const KEYFRAME_INTERVAL = 30;
export const DISPLAY_RING = 600;

export interface Keyframe {
  frameIndex: number;      // state as it was ENTERING this frame
  state: EngineState;      // deep copy — sharing with live state is a bug
}

export class History {
  /** T6 — record a frame after it ran: its inputs (always), a deep state
   * snapshot of the ENTERING state every KEYFRAME_INTERVAL frames, and its
   * display list into a ring of the last DISPLAY_RING frames. */
  record(frameIndex: number, enteringState: EngineState, inputs: FrameInputs, display: DisplayList): void {
    void frameIndex; void enteringState; void inputs; void display;
    TODO("T6", "History.record");
  }

  frameCount(): number { TODO("T6", "History.frameCount"); }
  inputsAt(k: number): FrameInputs { void k; TODO("T6", "History.inputsAt"); }
  /** Display list if still in the ring, else null (Session replays). */
  displayAt(k: number): DisplayList | null { void k; TODO("T6", "History.displayAt"); }
  /** Nearest keyframe with frameIndex <= k. Returns a fresh deep copy. */
  nearestKeyframeAtOrBefore(k: number): Keyframe { void k; TODO("T6", "History.nearestKeyframe"); }
}

/** T6 — deep copy (vars Map + rng + frameIndex). Values are immutable
 * plain objects, so copying the Map entries is sufficient — but the Map and
 * the rng object themselves must be fresh. */
export function snapshotState(s: EngineState): EngineState {
  void s;
  TODO("T6", "snapshotState");
}
