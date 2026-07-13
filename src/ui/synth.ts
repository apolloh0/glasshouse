// CONTRACT + P5-T0 stubs — SOURCE SYNTHESIS: the one place gesture output
// text comes from. Style rules (D56) are pinned so synthesized code is
// indistinguishable from a careful learner's:
//   numbers via showValue; points "(x, y)"; two-space indents; one space
//   after label colons; affine loop forms canonical and SIMPLIFIED:
//     step == 0                 -> "B"            (a plain literal)
//     base == 0, step == 1      -> "i - 1"
//     base == 0                 -> "(i - 1) * S"
//     base == step              -> "i * S"
//     otherwise                 -> "B + (i - 1) * S"
//   (negative step: "B - (i - 1) * |S|").
// exprText covers exactly what gestures emit — it is NOT a general
// pretty-printer; unchanged code is always preserved by span splicing,
// never re-printed (D50's untouched-id pin depends on it).

import { showValue } from "./format.js";

/** A bare number in learner style (integers bare, else 2 decimals, -0 tamed). */
export function numText(n: number): string {
  return showValue({ t: "num", v: n });
}

/** The value at 1-based index i of an affine sequence v_j = base+(j-1)*step,
 *  as canonical simplified Chalk (D56). */
export function affineText(base: number, step: number): string {
  if (step === 0) return numText(base);                 // "B"
  if (base === 0 && step === 1) return "i - 1";          // "i - 1"
  if (base === 0) return "(i - 1) * " + numText(step);   // "(i - 1) * S"
  if (base === step) return "i * " + numText(step);      // "i * S"
  // otherwise: B + (i - 1) * S, negative step reads "B - (i - 1) * |S|"
  const sign = step < 0 ? " - " : " + ";
  return numText(base) + sign + "(i - 1) * " + numText(Math.abs(step));
}

export function pointText(x: number, y: number): string {
  return "(" + numText(x) + ", " + numText(y) + ")";
}

/** Splice replacement of [start, end) with text; the workhorse every
 *  gesture routes edits through (descending-span order for multi-edits). */
export function splice(
  source: string, start: number, end: number, text: string,
): string {
  return source.slice(0, start) + text + source.slice(end);
}
