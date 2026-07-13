// CONTRACT — the display list IS the definition of program output (D2).
// Serialization must stay byte-stable: field order is fixed by the tuple
// encodings below, never by object key iteration. Changing anything here
// invalidates every golden.

import type { NodeId } from "../lang/ast.js";

export type Rgb = number; // 0xRRGGBB

interface OpBase {
  /** AST node of the call that emitted this op. */
  sourceNodeId: NodeId;
  /** Step index (within the frame) at which it was emitted. */
  stepIndex: number;
}

export interface CircleOp extends OpBase {
  kind: "circle"; cx: number; cy: number; r: number; fill: Rgb;
}
export interface EllipseOp extends OpBase {
  kind: "ellipse"; cx: number; cy: number; rx: number; ry: number; fill: Rgb;
}
export interface RectOp extends OpBase {
  kind: "rect"; x: number; y: number; w: number; h: number; fill: Rgb;
}
export interface TriangleOp extends OpBase {
  kind: "triangle"; ax: number; ay: number; bx: number; by: number;
  cx: number; cy: number; fill: Rgb;
}
export interface LineOp extends OpBase {
  kind: "line"; x1: number; y1: number; x2: number; y2: number;
  stroke: Rgb; width: number;
}

export type DisplayOp = CircleOp | EllipseOp | RectOp | TriangleOp | LineOp;

export interface DisplayList {
  bg: Rgb | null; // set by paper(color:), null = default white
  ops: DisplayOp[];
}

export const STAGE_WIDTH = 320;
export const STAGE_HEIGHT = 240;

// ---------- canonical serialization ----------

function num(n: number): string {
  // Full precision; -0 normalized so it can't leak in from arithmetic.
  return Object.is(n, -0) ? "0" : String(n);
}

function serializeOp(op: DisplayOp): string {
  switch (op.kind) {
    case "circle":
      return `["c",${num(op.cx)},${num(op.cy)},${num(op.r)},${op.fill},${op.sourceNodeId},${op.stepIndex}]`;
    case "ellipse":
      return `["e",${num(op.cx)},${num(op.cy)},${num(op.rx)},${num(op.ry)},${op.fill},${op.sourceNodeId},${op.stepIndex}]`;
    case "rect":
      return `["r",${num(op.x)},${num(op.y)},${num(op.w)},${num(op.h)},${op.fill},${op.sourceNodeId},${op.stepIndex}]`;
    case "triangle":
      return `["t",${num(op.ax)},${num(op.ay)},${num(op.bx)},${num(op.by)},${num(op.cx)},${num(op.cy)},${op.fill},${op.sourceNodeId},${op.stepIndex}]`;
    case "line":
      return `["l",${num(op.x1)},${num(op.y1)},${num(op.x2)},${num(op.y2)},${op.stroke},${num(op.width)},${op.sourceNodeId},${op.stepIndex}]`;
  }
}

/** Byte-stable canonical form. Equality of these strings = same output. */
export function serializeDisplayList(dl: DisplayList): string {
  const bg = dl.bg === null ? "null" : String(dl.bg);
  return `{"bg":${bg},"ops":[` + dl.ops.map(serializeOp).join(",") + "]}";
}

// ---------- visual serialization (the Phase 5 gesture oracle, D50) ----------
// Same draw order and every geometric + color/stroke field as serializeOp,
// EXCLUDING ONLY sourceNodeId and stepIndex. Those provenance columns shift
// whenever a statement is inserted (parse-time ids and step counters
// renumber), which any abstraction gesture necessarily does — so full
// serialization can never byte-match across a gesture even when the picture
// is identical. serializeVisual IS the pixel-level oracle: it still fails on
// a reordered draw, a changed op count, or any moved coordinate/color. The
// untouched-identity pin (IdTracker, Gate AB) is the SEPARATE co-required
// clause that covers provenance for code the gesture did not touch.

function serializeVisualOp(op: DisplayOp): string {
  switch (op.kind) {
    case "circle":
      return `["c",${num(op.cx)},${num(op.cy)},${num(op.r)},${op.fill}]`;
    case "ellipse":
      return `["e",${num(op.cx)},${num(op.cy)},${num(op.rx)},${num(op.ry)},${op.fill}]`;
    case "rect":
      return `["r",${num(op.x)},${num(op.y)},${num(op.w)},${num(op.h)},${op.fill}]`;
    case "triangle":
      return `["t",${num(op.ax)},${num(op.ay)},${num(op.bx)},${num(op.by)},${num(op.cx)},${num(op.cy)},${op.fill}]`;
    case "line":
      return `["l",${num(op.x1)},${num(op.y1)},${num(op.x2)},${num(op.y2)},${op.stroke},${num(op.width)}]`;
  }
}

/** Visual equality: same picture, provenance columns exempt (D50). */
export function serializeVisual(dl: DisplayList): string {
  const bg = dl.bg === null ? "null" : String(dl.bg);
  return `{"bg":${bg},"ops":[` + dl.ops.map(serializeVisualOp).join(",") + "]}";
}

/** FNV-1a 32-bit, hex — used by goldens to fingerprint long frame runs. */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
