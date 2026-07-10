// P4a-T2 — `group` blocks: Chalk v1.1's one language extension (D36).
// Exact math pins the conventions; the error cases pin the learner wording.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "../src/lang/parser.js";
import { Session } from "../src/host/run.js";
import { serializeDisplayList } from "../src/render/displayList.js";
import { executedStatements, executedInFrames } from "../src/flow/lines.js";
import { diagnosticsFor } from "../src/ui/diagnose.js";
import { labelAt } from "../src/ui/hover.js";

const P = "paper(color: #FFFFFF)\n";

function ops(source: string) {
  return new Session(source, 42).displayAt(0).ops;
}

describe("group syntax (P4a-T2)", () => {
  it("parses in setup and in frame blocks", () => {
    expect(() => parse(P + "group(move: (10, 5)):\n  circle(radius: 4)\n")).not.toThrow();
    expect(() => parse(P + "every frame:\n  group(rotate: 3):\n    circle(radius: 4)\n")).not.toThrow();
  });

  it("requires at least one argument", () => {
    const ds = diagnosticsFor(P + "group():\n  circle(radius: 4)\n");
    expect(ds.length).toBe(1);
    expect(ds[0]!.message).toMatch(/group/i);
  });

  it("rejects unknown labels by name", () => {
    const ds = diagnosticsFor(P + "group(spin: 5):\n  circle(radius: 4)\n");
    expect(ds.length).toBe(1);
    expect(ds[0]!.message).toMatch(/spin/);
  });
});

describe("group semantics (P4a-T2) — pinned math", () => {
  it("move translates", () => {
    const o = ops(P + "group(move: (10, 5)):\n  circle(center: (20, 30), radius: 4, fill: #112233)\n");
    expect(o.length).toBe(1);
    const c = o[0] as { cx: number; cy: number; r: number };
    expect(c.cx).toBeCloseTo(30, 10);
    expect(c.cy).toBeCloseTo(35, 10);
    expect(c.r).toBeCloseTo(4, 10);
  });

  it("positive rotation is clockwise on screen (y-down)", () => {
    const o = ops(P + "group(rotate: 90):\n  circle(center: (80, 0), radius: 4, fill: #112233)\n");
    const c = o[0] as { cx: number; cy: number };
    expect(c.cx).toBeCloseTo(0, 8);
    expect(c.cy).toBeCloseTo(80, 8);
  });

  it("rotates about `around`", () => {
    const o = ops(P + "group(rotate: 90, around: (160, 120)):\n  circle(center: (240, 120), radius: 4, fill: #112233)\n");
    const c = o[0] as { cx: number; cy: number };
    expect(c.cx).toBeCloseTo(160, 8);
    expect(c.cy).toBeCloseTo(200, 8);
  });

  it("uniform scale scales radii and stroke widths", () => {
    const o = ops(P +
      "group(scale: 2):\n" +
      "  circle(center: (10, 20), radius: 5, fill: #112233)\n" +
      "  line(from: (0, 0), to: (10, 0), stroke: #112233, width: 2)\n");
    const c = o[0] as { cx: number; cy: number; r: number };
    expect([c.cx, c.cy, c.r]).toEqual([20, 40, 10]);
    const l = o[1] as { x2: number; width: number };
    expect(l.x2).toBeCloseTo(20, 10);
    expect(l.width).toBeCloseTo(4, 10);
  });

  it("nested groups compose parent-then-child", () => {
    const o = ops(P +
      "group(move: (100, 0)):\n" +
      "  group(rotate: 90):\n" +
      "    circle(center: (10, 0), radius: 4, fill: #112233)\n");
    const c = o[0] as { cx: number; cy: number };
    expect(c.cx).toBeCloseTo(100, 8);
    expect(c.cy).toBeCloseTo(10, 8);
  });

  it("`rotate: 90` and `rotate: 90°` are the same transform", () => {
    const a = P + "group(rotate: 90):\n  circle(center: (80, 0), radius: 4, fill: #112233)\n";
    const b = P + "group(rotate: 90°):\n  circle(center: (80, 0), radius: 4, fill: #112233)\n";
    expect(serializeDisplayList(new Session(a, 42).displayAt(0)))
      .toBe(serializeDisplayList(new Session(b, 42).displayAt(0)));
  });
});

describe("rect and ellipse under rotation (P4a-T2, D36)", () => {
  it("rect stays a rect when the group does not rotate", () => {
    const o = ops(P + "group(move: (5, 5), scale: 2):\n  rect(left: 0, top: 0, width: 10, height: 10, fill: #112233)\n");
    expect(o.length).toBe(1);
    expect(o[0]!.kind).toBe("rect");
    const r = o[0] as { x: number; y: number; w: number; h: number };
    expect([r.x, r.y, r.w, r.h]).toEqual([5, 5, 20, 20]);
  });

  it("rect lowers to two exact triangles under nonzero rotation", () => {
    const o = ops(P + "group(rotate: 90):\n  rect(left: 0, top: 0, width: 10, height: 10, fill: #112233)\n");
    expect(o.length).toBe(2);
    expect(o.map((x) => x.kind)).toEqual(["triangle", "triangle"]);
    // corners A(0,0) B(10,0) C(10,10) D(0,10) -> (0,0) (0,10) (-10,10) (-10,0)
    const t1 = o[0] as { ax: number; ay: number; bx: number; by: number; cx: number; cy: number };
    const t2 = o[1] as { ax: number; ay: number; bx: number; by: number; cx: number; cy: number };
    expect([t1.ax, t1.ay]).toEqual([0, 0]);
    expect(t1.bx).toBeCloseTo(0, 8);  expect(t1.by).toBeCloseTo(10, 8);
    expect(t1.cx).toBeCloseTo(-10, 8); expect(t1.cy).toBeCloseTo(10, 8);
    expect([t2.ax, t2.ay]).toEqual([0, 0]);
    expect(t2.cx).toBeCloseTo(-10, 8); expect(t2.cy).toBeCloseTo(0, 8);
    expect(o[0]!.stepIndex).toBe(o[1]!.stepIndex); // one call, one step
  });

  it("ellipse inside a rotating group is a friendly diagnostic", () => {
    const ds = diagnosticsFor(P + "group(rotate: 45):\n  ellipse(width: 20, height: 10)\n");
    expect(ds.length).toBe(1);
    expect(ds[0]!.message).toMatch(/ellipse/i);
    expect(ds[0]!.message).toMatch(/tilt|turn|rotat/i);
  });

  it("scale must be a positive number", () => {
    const ds = diagnosticsFor(P + "group(scale: 0):\n  circle(radius: 4)\n");
    expect(ds.length).toBe(1);
    expect(ds[0]!.message).toMatch(/scale/i);
  });
});

describe("group in the flow layer (P4a-T2 + D31 extension)", () => {
  it("is a statement row in executedStatements, like repeat", () => {
    const src = P + "group(move: (1, 1)):\n  circle(radius: 4, fill: #112233)\n";
    const rows = executedStatements(parse(src), new Session(src, 42).traceSetup());
    const heads = rows.map((r) => src.slice(r.span.start, r.span.start + 5));
    expect(heads).toContain("group");
  });

  it("is excluded from executedInFrames leaf rows (containers carry no pattern)", () => {
    const src = readFileSync("examples/pinwheel.chalk", "utf8");
    const program = parse(src);
    const session = new Session(src, 42);
    session.advanceFrames(4);
    const views = [1, 2, 3].map((k) => ({ frame: k, view: session.traceAt(k) }));
    const rows = executedInFrames(program, views);
    const texts = rows.map((r) => src.slice(r.span.start, r.span.start + 6));
    expect(texts.some((t) => t.startsWith("group"))).toBe(false);
    expect(texts.some((t) => t.startsWith("spin ="))).toBe(true);
    expect(texts.some((t) => t.startsWith("triang"))).toBe(true);
  });

  it("fast and instrumented modes agree on pinwheel", () => {
    const src = readFileSync("examples/pinwheel.chalk", "utf8");
    const session = new Session(src, 42);
    session.advanceFrames(3);
    const v = session.traceAt(2);
    expect(serializeDisplayList(v.display))
      .toBe(serializeDisplayList(session.displayAt(2)));
    expect(session.displayAt(1).ops.length).toBe(8); // 4 blades x (triangle+circle)
  });
});

describe("group vocabulary (P4a-T2)", () => {
  it("hover resolves group labels to their param cards", () => {
    const src = readFileSync("examples/pinwheel.chalk", "utf8");
    const program = parse(src);
    const r = labelAt(program, src.indexOf("rotate:") + 1);
    expect(r).not.toBeNull();
    expect(r!.card.key).toBe("param:group.rotate");
    const k = labelAt(program, src.indexOf("group(") + 1);
    expect(k).not.toBeNull();
    expect(k!.card.key).toBe("construct:group");
  });
});
