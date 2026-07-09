// CONTRACT — the runtime Value union and its helpers.
// Encoding tags must stay in sync with VTAG in trace.ts.

import { TODO } from "../util/todo.js";

export type Value =
  | { t: "num"; v: number }
  | { t: "bool"; v: boolean }
  | { t: "str"; v: string }
  | { t: "color"; rgb: number }          // 0xRRGGBB (D9)
  | { t: "point"; x: number; y: number }
  | { t: "angle"; deg: number };

export function typeName(v: Value): string {
  switch (v.t) {
    case "num": return "a number";
    case "bool": return "true/false";
    case "str": return "text";
    case "color": return "a color";
    case "point": return "a point";
    case "angle": return "an angle";
  }
}

/** Thrown by expect* without a span; the evaluator attaches the arg's span
 *  and rethrows as a ChalkError (spec §6 wording). */
export class ValueTypeError extends Error {
  constructor(public label: string, public wanted: string, public got: Value) {
    super("`" + label + ":` needs " + wanted + " — right now it's " + typeName(got));
    this.name = "ValueTypeError";
  }
}

export function expectNum(v: Value, label: string): number {
  if (v.t === "num") return v.v;
  throw new ValueTypeError(label, "a number", v);
}
export function expectPoint(v: Value, label: string): { x: number; y: number } {
  if (v.t === "point") return v;
  throw new ValueTypeError(label, "a point like (x, y)", v);
}
export function expectColor(v: Value, label: string): number {
  if (v.t === "color") return v.rgb;
  throw new ValueTypeError(label, "a color like #FF9900", v);
}
export function expectAngle(v: Value, label: string): number {
  if (v.t === "angle") return v.deg;
  if (v.t === "num") return v.v; // bare numbers read as degrees
  throw new ValueTypeError(label, "an angle like 30°", v);
}
export function expectBool(v: Value, label: string): boolean {
  if (v.t === "bool") return v.v;
  throw new ValueTypeError(label, "true or false", v);
}

// ---------- T3: implement below (tests/values.test.ts) ----------

/** Structural equality; point/angle/color compare by payload. */
export function valueEquals(a: Value, b: Value): boolean {
  void a; void b;
  TODO("T3", "valueEquals");
}

/** Encode for the trace store. Tag must match trace.ts VTAG; point packs
 *  x->a, y->b; string interns via the provided fn and returns its index. */
export function encodeValue(
  v: Value | null,
  intern: (s: string) => number,
): { tag: number; a: number; b: number; strIdx: number } {
  void v; void intern;
  TODO("T3", "encodeValue");
}

/** Inverse of encodeValue (strIdx resolved via the provided fn). */
export function decodeValue(
  tag: number, a: number, b: number, strIdx: number,
  str: (i: number) => string,
): Value | null {
  void tag; void a; void b; void strIdx; void str;
  TODO("T3", "decodeValue");
}
