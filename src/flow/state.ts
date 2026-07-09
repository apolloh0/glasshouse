// CONTRACT (types + semantics) — the state panel model (plan §4.3: every
// `state` variable always on screen; inputs are state too). PURE over
// TraceViews and EngineState snapshots; the studio owns the pane.
//
// SEMANTICS (P3-T2):
//
//  Write rows (T7 encoding, refined by D25): kind=write, strIdx = the VAR
//  NAME's intern index, value in (valueTag, a, b) exactly as encodeValue —
//  EXCEPT string-valued writes, where the value's intern index lives in `a`
//  (strIdx is taken by the name). nodeId = the assign / state-decl node.
//
//  varsAtStep — the world at a step (column hover): `entering` (the vars
//  ENTERING the traced frame, from Session.stateAt) with every write row at
//  step <= s applied in order. Post-state, consistent with D20.
//
//  stateRows — one row per state var in DECLARATION ORDER: value entering
//  the frame, every write during it, and the leaving value (entering with
//  all writes applied). For a setup trace, `entering` is the empty map and
//  state-decl initializations appear as writes.
//
//  varSeries — one number|null per requested frame: the var's value
//  ENTERING that frame (null when non-numeric or unknown). Feed it
//  Session.stateAt; keep windows <= 64 frames (each stateAt may replay up
//  to KEYFRAME_INTERVAL-1 frames — see the Gate P budget and escalation).
//
//  sparkline — pinned geometry (D29): n = values.length slots, point i at
//    x = i * (width-1) / (n-1)        (single value: x = (width-1)/2)
//    y = (height-1) - (v-min)/(max-min) * (height-1)
//    flat series (max == min): y = (height-1)/2 for every point.
//  Nulls produce NO point (gaps). Returns null when nothing is numeric.

import type { NodeId, Program } from "../lang/ast.js";
import type { Value } from "../engine/values.js";
import type { EngineState } from "../engine/frame.js";
import type { TraceView } from "../host/run.js";
import { TODO } from "../util/todo.js";

export interface WriteEvent {
  step: number;
  nodeId: NodeId;
  name: string;
  value: Value;
}

/** Every write in the trace, in step order. */
export function writeEvents(program: Program, view: TraceView): WriteEvent[] {
  void program; void view;
  TODO("P3-T2", "decode write rows per header");
}

export function varsAtStep(
  program: Program,
  view: TraceView,
  entering: ReadonlyMap<string, Value>,
  step: number,
): Map<string, Value> {
  void program; void view; void entering; void step;
  TODO("P3-T2");
}

export interface StateRow {
  name: string;
  entering: Value | null; // null in a setup trace (the var is being born)
  writes: WriteEvent[];
  leaving: Value;
}

export function stateRows(
  program: Program,
  view: TraceView,
  entering: ReadonlyMap<string, Value>,
): StateRow[] {
  void program; void view; void entering;
  TODO("P3-T2", "declaration order; leaving = entering + writes");
}

export function varSeries(
  getState: (k: number) => EngineState,
  name: string,
  frames: readonly number[],
): (number | null)[] {
  void getState; void name; void frames;
  TODO("P3-T2");
}

export interface Spark {
  points: { x: number; y: number }[];
  min: number;
  max: number;
}

export function sparkline(
  values: readonly (number | null)[],
  width: number,
  height: number,
): Spark | null {
  void values; void width; void height;
  TODO("P3-T2", "pinned geometry (D29)");
}
