// P4b-T0 — trig determinism (D42). Math.cos/sin differ by last-bit ULPs
// across platforms (macOS arm64 vs Linux x86 libm), so any golden
// containing rotation was machine-pinned: the pinwheel golden generated on
// one machine fails byte-equality on another. FOUND IN REVIEW, cross-
// platform, at Phase 4a close.
//
// The fix is pinned here: both trig sites (the evaluator's private affine
// copy AND flow/transform's matrixFor) must round cos/sin to the 1e-9 grid
// BEFORE use. All downstream arithmetic is IEEE-exact and portable, so
// rotated coordinates become bit-identical everywhere. 1e-9 is far below
// pixel relevance and far above ULP noise. After implementing, regenerate
// ONLY the pinwheel golden (the four trig-free goldens must not move) and
// commit it as the first portable rotation golden.

import { describe, expect, it } from "vitest";
import { Session } from "../src/host/run.js";
import { matrixFor } from "../src/flow/transform.js";

/** THE pinned rule. Both implementations must match this exactly. */
export const roundTrig = (x: number): number => Math.round(x * 1e9) / 1e9;

describe("trig determinism (P4b-T0, D42)", () => {
  it("matrixFor uses 1e-9-rounded trig — bit-exact, not closeTo", () => {
    const deg = 33;
    const rad = (deg * Math.PI) / 180;
    const cos = roundTrig(Math.cos(rad));
    const sin = roundTrig(Math.sin(rad));
    const m = matrixFor({ rotate: { t: "num", v: deg } });
    expect(m.a).toBe(cos);
    expect(m.b).toBe(sin);
    expect(m.c).toBe(-sin);
    expect(m.d).toBe(cos);
  });

  it("the evaluator's rotation is bit-exact against the pinned rule", () => {
    const src =
      "paper(color: #FFFFFF)\n" +
      "group(rotate: 33, around: (160, 120)):\n" +
      "  circle(center: (240, 120), radius: 4, fill: #112233)\n";
    const op = new Session(src, 42).displayAt(0).ops[0] as { cx: number; cy: number };
    const rad = (33 * Math.PI) / 180;
    const cos = roundTrig(Math.cos(rad));
    const sin = roundTrig(Math.sin(rad));
    // world = R(local - around) + around, computed with the SAME arithmetic
    const lx = 240 - 160, ly = 120 - 120;
    expect(op.cx).toBe(cos * lx + -sin * ly + 160);
    expect(op.cy).toBe(sin * lx + cos * ly + 120);
  });

  it("multiples of 90° are exact zeros and ones after rounding", () => {
    const m = matrixFor({ rotate: { t: "num", v: 90 } });
    expect(m.a).toBe(0);
    expect(m.b).toBe(1);
    expect(m.c).toBe(-1);
    expect(m.d).toBe(0);
  });
});
