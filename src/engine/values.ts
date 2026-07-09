// CONTRACT — the runtime Value union and its helpers.
// Encoding tags must stay in sync with VTAG in trace.ts.

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
  if (a.t !== b.t) return false;
  switch (a.t) {
    case "num": return a.v === (b as { v: number }).v;
    case "bool": return a.v === (b as { v: boolean }).v;
    case "str": return a.v === (b as { v: string }).v;
    case "color": return a.rgb === (b as { rgb: number }).rgb;
    case "point": {
      const p = b as { x: number; y: number };
      return a.x === p.x && a.y === p.y;
    }
    case "angle": return a.deg === (b as { deg: number }).deg;
  }
}

// Tags mirror trace.ts VTAG (kept numeric here to avoid an import cycle):
// none 0, num 1, bool 2, color 3, point 4, angle 5, str 6.

/** Encode for the trace store. Tag must match trace.ts VTAG; point packs
 *  x->a, y->b; string interns via the provided fn and returns its index. */
export function encodeValue(
  v: Value | null,
  intern: (s: string) => number,
): { tag: number; a: number; b: number; strIdx: number } {
  if (v === null) return { tag: 0, a: 0, b: 0, strIdx: -1 };
  switch (v.t) {
    case "num": return { tag: 1, a: v.v, b: 0, strIdx: -1 };
    case "bool": return { tag: 2, a: v.v ? 1 : 0, b: 0, strIdx: -1 };
    case "color": return { tag: 3, a: v.rgb, b: 0, strIdx: -1 };
    case "point": return { tag: 4, a: v.x, b: v.y, strIdx: -1 };
    case "angle": return { tag: 5, a: v.deg, b: 0, strIdx: -1 };
    case "str": return { tag: 6, a: 0, b: 0, strIdx: intern(v.v) };
  }
}

/** Inverse of encodeValue (strIdx resolved via the provided fn). */
export function decodeValue(
  tag: number, a: number, b: number, strIdx: number,
  str: (i: number) => string,
): Value | null {
  switch (tag) {
    case 0: return null;
    case 1: return { t: "num", v: a };
    case 2: return { t: "bool", v: a !== 0 };
    case 3: return { t: "color", rgb: a };
    case 4: return { t: "point", x: a, y: b };
    case 5: return { t: "angle", deg: a };
    case 6: return { t: "str", v: str(strIdx) };
    default: throw new Error("decodeValue: unknown tag " + tag);
  }
}
