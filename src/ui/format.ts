// CONTRACT — the ONE textual form of a Value, everywhere a value is shown:
// state panel, typed cells, hover cards, diagnostics that quote values.
// If two panes ever print the same value differently, that is a bug here.
//
// Pinned forms (P3-T1; exact strings in tests/format.test.ts):
//   num    fmtNum (annotate.ts): "12", "12.50", "-8", "0" for -0
//   point  "(60, 80)" — fmtNum per component
//   color  "#2A76C6" — uppercase, always 6 digits
//   angle  "45°" — fmtNum degrees + degree sign (never "deg"; D8 makes ° the
//          canonical display form)
//   bool   "true" / "false"
//   string "\"hi\"" — double-quoted, no escaping in v1 (strings can't
//          contain quotes; the lexer guarantees it)

import type { Value } from "../engine/values.js";
import { fmtNum } from "./annotate.js";

export function showValue(v: Value): string {
  switch (v.t) {
    case "num": return fmtNum(v.v);
    case "point": return "(" + fmtNum(v.x) + ", " + fmtNum(v.y) + ")";
    case "color": return "#" + (v.rgb >>> 0).toString(16).padStart(6, "0").toUpperCase();
    case "angle": return fmtNum(v.deg) + "°";
    case "bool": return v.v ? "true" : "false";
    case "str": return '"' + v.v + '"';
  }
}
