// CONTRACT + full implementation — the Phase 0 builtin registry.
// Param metadata here is the seed of the Phase 1 "labels everywhere" registry,
// which is why builtins carry docs even though nothing renders them yet.
//
// Evaluator responsibilities (T4/T5), given this registry:
//  - resolve labeled args against `params` order-independently;
//  - apply `dflt` for omitted labels; unknown label -> diagnostic naming the
//    function and label; missing label with no default -> diagnostic;
//  - type-check each arg with the values.ts expect* helper for `type`,
//    wording per spec §6 ("`radius:` needs a number — right now it's a color");
//  - `paper` is setup-only (runtime diagnostic otherwise) and sets ctx.bg;
//  - `random` is a value builtin: evaluator calls nextInt(ctx.rng, from, to).

import type { Value } from "./values.js";
import { expectColor, expectNum, expectPoint } from "./values.js";
import type { DisplayOp } from "../render/displayList.js";

export type ParamType = "num" | "point" | "color" | "angle" | "string";

export interface ParamSpec {
  label: string;
  type: ParamType;
  dflt: Value | null; // null = required
  doc: string;
}

export interface EmitMeta { sourceNodeId: number; stepIndex: number }

export interface BuiltinSpec {
  name: string;
  kind: "draw" | "paper" | "value";
  params: ParamSpec[];
  doc: string;
  /** Draw builtins only: push ops. Args are label-keyed, already checked. */
  emit: ((args: Record<string, Value>, out: DisplayOp[], meta: EmitMeta) => void) | null;
}

const n = (v: number): Value => ({ t: "num", v });
const col = (rgb: number): Value => ({ t: "color", rgb });
const pt = (x: number, y: number): Value => ({ t: "point", x, y });

export const BUILTINS: ReadonlyMap<string, BuiltinSpec> = new Map<string, BuiltinSpec>([
  ["paper", {
    name: "paper", kind: "paper", emit: null,
    doc: "set the background color of the stage (setup only)",
    params: [{ label: "color", type: "color", dflt: null, doc: "the background color" }],
  }],
  ["circle", {
    name: "circle", kind: "draw",
    doc: "draw a filled circle",
    params: [
      { label: "center", type: "point", dflt: pt(160, 120), doc: "where the middle of the circle sits" },
      { label: "radius", type: "num", dflt: n(40), doc: "distance from the center to the edge, in pixels" },
      { label: "fill", type: "color", dflt: col(0x888888), doc: "the color inside" },
    ],
    emit: (a, out, m) => {
      const c = expectPoint(a["center"]!, "center");
      out.push({ kind: "circle", cx: c.x, cy: c.y, r: expectNum(a["radius"]!, "radius"),
        fill: expectColor(a["fill"]!, "fill"), sourceNodeId: m.sourceNodeId, stepIndex: m.stepIndex });
    },
  }],
  ["ellipse", {
    name: "ellipse", kind: "draw",
    doc: "draw a filled ellipse",
    params: [
      { label: "center", type: "point", dflt: pt(160, 120), doc: "where the middle sits" },
      { label: "width", type: "num", dflt: n(100), doc: "total width, in pixels" },
      { label: "height", type: "num", dflt: n(60), doc: "total height, in pixels" },
      { label: "fill", type: "color", dflt: col(0x888888), doc: "the color inside" },
    ],
    emit: (a, out, m) => {
      const c = expectPoint(a["center"]!, "center");
      out.push({ kind: "ellipse", cx: c.x, cy: c.y,
        rx: expectNum(a["width"]!, "width") / 2, ry: expectNum(a["height"]!, "height") / 2,
        fill: expectColor(a["fill"]!, "fill"), sourceNodeId: m.sourceNodeId, stepIndex: m.stepIndex });
    },
  }],
  ["rect", {
    name: "rect", kind: "draw",
    doc: "draw a filled rectangle (anchored at its top-left corner)",
    params: [
      { label: "left", type: "num", dflt: n(110), doc: "x of the left edge" },
      { label: "top", type: "num", dflt: n(90), doc: "y of the top edge" },
      { label: "width", type: "num", dflt: n(100), doc: "how wide, in pixels" },
      { label: "height", type: "num", dflt: n(60), doc: "how tall, in pixels" },
      { label: "fill", type: "color", dflt: col(0x888888), doc: "the color inside" },
    ],
    emit: (a, out, m) => {
      out.push({ kind: "rect", x: expectNum(a["left"]!, "left"), y: expectNum(a["top"]!, "top"),
        w: expectNum(a["width"]!, "width"), h: expectNum(a["height"]!, "height"),
        fill: expectColor(a["fill"]!, "fill"), sourceNodeId: m.sourceNodeId, stepIndex: m.stepIndex });
    },
  }],
  ["triangle", {
    name: "triangle", kind: "draw",
    doc: "draw a filled triangle through three corner points",
    params: [
      { label: "a", type: "point", dflt: pt(160, 60), doc: "first corner" },
      { label: "b", type: "point", dflt: pt(110, 160), doc: "second corner" },
      { label: "c", type: "point", dflt: pt(210, 160), doc: "third corner" },
      { label: "fill", type: "color", dflt: col(0x888888), doc: "the color inside" },
    ],
    emit: (args, out, m) => {
      const a = expectPoint(args["a"]!, "a"), b = expectPoint(args["b"]!, "b"), c = expectPoint(args["c"]!, "c");
      out.push({ kind: "triangle", ax: a.x, ay: a.y, bx: b.x, by: b.y, cx: c.x, cy: c.y,
        fill: expectColor(args["fill"]!, "fill"), sourceNodeId: m.sourceNodeId, stepIndex: m.stepIndex });
    },
  }],
  ["line", {
    name: "line", kind: "draw",
    doc: "draw a straight line between two points",
    params: [
      { label: "from", type: "point", dflt: pt(60, 120), doc: "where the line starts" },
      { label: "to", type: "point", dflt: pt(260, 120), doc: "where the line ends" },
      { label: "stroke", type: "color", dflt: col(0x333333), doc: "the line's color" },
      { label: "width", type: "num", dflt: n(2), doc: "line thickness, in pixels" },
    ],
    emit: (a, out, m) => {
      const f = expectPoint(a["from"]!, "from"), t = expectPoint(a["to"]!, "to");
      out.push({ kind: "line", x1: f.x, y1: f.y, x2: t.x, y2: t.y,
        stroke: expectColor(a["stroke"]!, "stroke"), width: expectNum(a["width"]!, "width"),
        sourceNodeId: m.sourceNodeId, stepIndex: m.stepIndex });
    },
  }],
  ["random", {
    name: "random", kind: "value", emit: null,
    doc: "a whole number picked between from and to (inclusive)",
    params: [
      { label: "from", type: "num", dflt: null, doc: "smallest possible result" },
      { label: "to", type: "num", dflt: null, doc: "largest possible result" },
    ],
  }],
]);

