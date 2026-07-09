// CONTRACT — dumb deterministic store (plan §5.2 two-tier scheme, lower tier).
// Session (host/run.ts) owns replay; History only stores and hands back.
import type { EngineState, FrameInputs } from "./frame.js";
import type { DisplayList } from "../render/displayList.js";

export const KEYFRAME_INTERVAL = 30;
export const DISPLAY_RING = 600;

export interface Keyframe {
  frameIndex: number;      // state as it was ENTERING this frame
  state: EngineState;      // deep copy — sharing with live state is a bug
}

export class History {
  private inputs: FrameInputs[] = [];
  private keyframes: Keyframe[] = []; // ascending frameIndex, every INTERVAL
  private ring: ({ frameIndex: number; display: DisplayList } | null)[] =
    new Array(DISPLAY_RING).fill(null);

  /** T6 — record a frame after it ran: its inputs (always), a deep state
   * snapshot of the ENTERING state every KEYFRAME_INTERVAL frames, and its
   * display list into a ring of the last DISPLAY_RING frames. */
  record(frameIndex: number, enteringState: EngineState, inputs: FrameInputs, display: DisplayList): void {
    if (frameIndex !== this.inputs.length) {
      throw new Error("History.record: expected frame " + this.inputs.length + ", got " + frameIndex);
    }
    this.inputs.push({
      pointer: { ...inputs.pointer },
      events: [...inputs.events],
    });
    if (frameIndex % KEYFRAME_INTERVAL === 0) {
      this.keyframes.push({ frameIndex, state: snapshotState(enteringState) });
    }
    this.ring[frameIndex % DISPLAY_RING] = { frameIndex, display };
  }

  frameCount(): number { return this.inputs.length; }

  inputsAt(k: number): FrameInputs {
    const inputs = this.inputs[k];
    if (inputs === undefined) throw new Error("History.inputsAt: frame " + k + " was never recorded");
    return inputs;
  }

  /** Display list if still in the ring, else null (Session replays). */
  displayAt(k: number): DisplayList | null {
    if (k < 0 || k >= this.inputs.length) {
      throw new Error("History.displayAt: frame " + k + " was never recorded");
    }
    const slot = this.ring[k % DISPLAY_RING];
    return slot != null && slot.frameIndex === k ? slot.display : null;
  }

  /** Nearest keyframe with frameIndex <= k. Returns a fresh deep copy. */
  nearestKeyframeAtOrBefore(k: number): Keyframe {
    if (k < 0 || this.keyframes.length === 0) {
      throw new Error("History.nearestKeyframeAtOrBefore: no keyframe at or before " + k);
    }
    const idx = Math.min(Math.floor(k / KEYFRAME_INTERVAL), this.keyframes.length - 1);
    const kf = this.keyframes[idx]!;
    return { frameIndex: kf.frameIndex, state: snapshotState(kf.state) };
  }
}

/** T6 — deep copy (vars Map + rng + frameIndex). Values are immutable
 * plain objects, so copying the Map entries is sufficient — but the Map and
 * the rng object themselves must be fresh. */
export function snapshotState(s: EngineState): EngineState {
  return {
    vars: new Map(s.vars),
    rng: { state: s.rng.state },
    frameIndex: s.frameIndex,
  };
}
