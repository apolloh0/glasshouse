// Pins serializeVisual's discrimination (D50 amendment): the gesture oracle
// must ignore provenance columns (sourceNodeId/stepIndex) yet still catch any
// real visual change. Added under the approved oracle fix.
import { describe, expect, it } from "vitest";
import { serializeVisual, type DisplayList, type DisplayOp } from "../src/render/displayList.js";

const circle = (cx: number, sourceNodeId: number, stepIndex: number): DisplayOp =>
  ({ kind: "circle", cx, cy: 10, r: 5, fill: 0x112233, sourceNodeId, stepIndex });

describe("serializeVisual (D50 oracle)", () => {
  it("is INSENSITIVE to a pure id/step shift", () => {
    const a: DisplayList = { bg: 0xffffff, ops: [circle(80, 4, 8)] };
    const b: DisplayList = { bg: 0xffffff, ops: [circle(80, 6, 11)] }; // only ids moved
    expect(serializeVisual(b)).toBe(serializeVisual(a));
  });

  it("is SENSITIVE to a 1-unit coordinate change", () => {
    const a: DisplayList = { bg: 0xffffff, ops: [circle(80, 4, 8)] };
    const b: DisplayList = { bg: 0xffffff, ops: [circle(81, 4, 8)] };
    expect(serializeVisual(b)).not.toBe(serializeVisual(a));
  });

  it("is SENSITIVE to op reordering", () => {
    const a: DisplayList = { bg: 0xffffff, ops: [circle(80, 4, 8), circle(200, 5, 12)] };
    const b: DisplayList = { bg: 0xffffff, ops: [circle(200, 5, 12), circle(80, 4, 8)] };
    expect(serializeVisual(b)).not.toBe(serializeVisual(a));
  });
});
