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
import { decodeValue } from "../engine/values.js";
import type { EngineState } from "../engine/frame.js";
import { STEP_KIND, VTAG } from "../engine/trace.js";
import type { TraceView } from "../host/run.js";

export interface WriteEvent {
  step: number;
  nodeId: NodeId;
  name: string;
  value: Value;
}

/** Every write in the trace, in step order. */
export function writeEvents(program: Program, view: TraceView): WriteEvent[] {
  void program; // the encoding is trace-side; the program isn't needed
  const out: WriteEvent[] = [];
  const trace = view.trace;
  for (let s = 0; s < trace.count; s++) {
    const row = trace.row(s);
    if (row.kind !== STEP_KIND.write) continue;
    // D25: strIdx = the var NAME; a string VALUE's intern index sits in `a`.
    const value = row.valueTag === VTAG.str
      ? ({ t: "str", v: trace.string(row.a) } as Value)
      : decodeValue(row.valueTag, row.a, row.b, -1, () => "")!;
    out.push({ step: s, nodeId: row.nodeId, name: trace.string(row.strIdx), value });
  }
  return out;
}

export function varsAtStep(
  program: Program,
  view: TraceView,
  entering: ReadonlyMap<string, Value>,
  step: number,
): Map<string, Value> {
  const vars = new Map(entering);
  for (const w of writeEvents(program, view)) {
    if (w.step > step) break; // post-state (D20): writes at step <= s apply
    vars.set(w.name, w.value);
  }
  return vars;
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
  const writes = writeEvents(program, view);
  const rows: StateRow[] = [];
  for (const item of program.setup) {
    if (item.kind !== "state") continue; // declaration order
    const mine = writes.filter((w) => w.name === item.name);
    const enteringValue = entering.get(item.name) ?? null;
    const leaving = mine.length > 0 ? mine[mine.length - 1]!.value : enteringValue;
    if (leaving === null) continue; // never born in this trace
    rows.push({ name: item.name, entering: enteringValue, writes: mine, leaving });
  }
  return rows;
}

export function varSeries(
  getState: (k: number) => EngineState,
  name: string,
  frames: readonly number[],
): (number | null)[] {
  return frames.map((k) => {
    const v = getState(k).vars.get(name);
    return v !== undefined && v.t === "num" ? v.v : null;
  });
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
  const numeric = values.filter((v): v is number => v !== null);
  if (numeric.length === 0) return null;
  const min = Math.min(...numeric);
  const max = Math.max(...numeric);
  const n = values.length;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (v === null || v === undefined) continue; // nulls gap (D29)
    const x = n === 1 ? (width - 1) / 2 : (i * (width - 1)) / (n - 1);
    const y = max === min
      ? (height - 1) / 2 // flat series centers
      : (height - 1) - ((v - min) / (max - min)) * (height - 1);
    points.push({ x, y });
  }
  return { points, min, max };
}
