// P4a-T6 — every literal is a control. The identity-preservation pin (a
// splice changes exactly the value, never the program's shape) reuses the
// Phase 2 matcher as its own verifier.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "../src/lang/parser.js";
import { IdTracker } from "../src/host/ids.js";
import { numberDragAt, pointHandles, widgetAt } from "../src/ui/drag.js";

const ball = readFileSync("examples/bouncing-ball.chalk", "utf8");

function identityPreserved(before: string, after: string): void {
  const t = new IdTracker();
  t.advance(parse(before));
  const r = t.advance(parse(after));
  expect(r.fresh.size).toBe(0);
  expect(r.dropped.size).toBe(0);
}

describe("numberDragAt (P4a-T6)", () => {
  it("integers drag in steps of 1", () => {
    const d = numberDragAt(parse(ball), ball, ball.indexOf("radius: 20") + "radius: ".length)!;
    expect(d).toBeTruthy();
    expect(d.value).toBe(20);
    expect(d.step).toBe(1);
    const after = d.apply(35);
    expect(after).toContain("radius: 35");
    identityPreserved(ball, after);
  });

  it("decimals drag in steps of 0.1, formatted without tails", () => {
    const d = numberDragAt(parse(ball), ball, ball.indexOf("0.85"))!;
    expect(d.step).toBe(0.1);
    expect(d.apply(0.9)).toContain("* 0.9\n");
  });

  it("rounds to the step", () => {
    const d = numberDragAt(parse(ball), ball, ball.indexOf("radius: 20") + "radius: ".length)!;
    expect(d.apply(34.6)).toContain("radius: 35");
  });

  it("is null off-literal", () => {
    expect(numberDragAt(parse(ball), ball, ball.indexOf("every frame"))).toBeNull();
  });
});

describe("widgetAt (P4a-T6)", () => {
  it("colors: uppercase 6-digit splice", () => {
    const w = widgetAt(parse(ball), ball, ball.indexOf("#2A76C6") + 1)!;
    expect(w.kind).toBe("color");
    if (w.kind === "color") {
      expect(w.rgb).toBe(0x2a76c6);
      expect(w.apply(0x123abc)).toContain("#123ABC");
    }
  });

  it("angles keep their suffix style", () => {
    const a = "paper(color: #FFFFFF)\ngroup(rotate: 45°, around: (0, 0)):\n  circle(radius: 4)\n";
    const wa = widgetAt(parse(a), a, a.indexOf("45°"))!;
    expect(wa.kind).toBe("angle");
    if (wa.kind === "angle") expect(wa.apply(90)).toContain("rotate: 90°");

    const b = a.replace("45°", "45deg");
    const wb = widgetAt(parse(b), b, b.indexOf("45deg"))!;
    if (wb.kind === "angle") expect(wb.apply(90)).toContain("rotate: 90deg");
  });

  it("is null elsewhere", () => {
    expect(widgetAt(parse(ball), ball, ball.indexOf("speed"))).toBeNull();
  });
});

describe("pointHandles (P4a-T6)", () => {
  it("finds literal-only points inside call and group args, pre-order", () => {
    const src = readFileSync("examples/pinwheel.chalk", "utf8");
    const handles = pointHandles(parse(src), src);
    // around (160,120) + triangle a,b,c + circle center = 5
    expect(handles.length).toBe(5);
    expect(handles.map((h) => [h.x, h.y])).toEqual([
      [160, 120], [160, 120], [240, 108], [240, 132], [250, 120],
    ]);
  });

  it("skips points with computed components", () => {
    // bouncing-ball's center is (160, y) — y is a name, no handle
    expect(pointHandles(parse(ball), ball).length).toBe(0);
  });

  it("applyBoth splices both literals, preserving identity", () => {
    const src = "paper(color: #FFFFFF)\ncircle(center: (60, 80), radius: 5, fill: #112233)\n";
    const h = pointHandles(parse(src), src)[0]!;
    const after = h.applyBoth(70.4, 90);
    expect(after).toContain("(70, 90)");
    identityPreserved(src, after);
  });
});
