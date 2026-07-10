// P4a-T3 — the transform-frame visualization model. matrixFor/axesGlyph are
// pure and exact; activeGroupsAt is checked by SELF-CONSISTENCY: the active
// matrix applied to a body literal must equal the emitted world coordinate.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "../src/lang/parser.js";
import { Session } from "../src/host/run.js";
import {
  activeGroupsAt, applyMat, axesGlyph, IDENTITY, matrixFor, mulMat,
} from "../src/flow/transform.js";
import { pathAt } from "../src/lang/walk.js";

const n = (v: number) => ({ t: "num", v } as const);
const pt = (x: number, y: number) => ({ t: "point", x, y } as const);

describe("matrixFor (P4a-T3)", () => {
  it("defaults to identity", () => {
    expect(matrixFor({})).toEqual(IDENTITY);
  });

  it("move / rotate / scale, individually", () => {
    expect(matrixFor({ move: pt(10, 5) })).toEqual({ a: 1, b: 0, c: 0, d: 1, e: 10, f: 5 });
    const r = matrixFor({ rotate: n(90) });
    expect(r.a).toBeCloseTo(0, 10); expect(r.b).toBeCloseTo(1, 10);
    expect(r.c).toBeCloseTo(-1, 10); expect(r.d).toBeCloseTo(0, 10);
    expect(matrixFor({ scale: n(2) })).toEqual({ a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 });
  });

  it("rotate about `around` maps the pivot to itself", () => {
    const m = matrixFor({ rotate: n(90), around: pt(160, 120) });
    const pivot = applyMat(m, 160, 120);
    expect(pivot.x).toBeCloseTo(160, 8);
    expect(pivot.y).toBeCloseTo(120, 8);
    const p = applyMat(m, 240, 120);
    expect(p.x).toBeCloseTo(160, 8);
    expect(p.y).toBeCloseTo(200, 8);
  });

  it("angle values work where numbers do", () => {
    const a = matrixFor({ rotate: { t: "angle", deg: 90 } });
    const b = matrixFor({ rotate: n(90) });
    expect(a.a).toBeCloseTo(b.a, 12);
    expect(a.b).toBeCloseTo(b.b, 12);
  });

  it("mulMat composes parent-then-child (sanity)", () => {
    const m = mulMat(matrixFor({ move: pt(100, 0) }), matrixFor({ rotate: n(90) }));
    const p = applyMat(m, 10, 0);
    expect(p.x).toBeCloseTo(100, 8);
    expect(p.y).toBeCloseTo(10, 8);
  });
});

describe("axesGlyph (P4a-T3)", () => {
  it("identity axes, pinned order and length", () => {
    expect(axesGlyph(IDENTITY)).toEqual([
      { kind: "axis", x1: 0, y1: 0, x2: 24, y2: 0, label: "x" },
      { kind: "axis", x1: 0, y1: 0, x2: 0, y2: 24, label: "y" },
      { kind: "origin", x: 0, y: 0 },
    ]);
  });

  it("follows the matrix", () => {
    const g = axesGlyph(matrixFor({ rotate: n(90) }), 24);
    const x = g[0] as { x2: number; y2: number };
    expect(x.x2).toBeCloseTo(0, 8);
    expect(x.y2).toBeCloseTo(24, 8);
  });
});

describe("activeGroupsAt (P4a-T3)", () => {
  const src = readFileSync("examples/pinwheel.chalk", "utf8");

  it("is self-consistent: active matrix x local literal = emitted world point", () => {
    const program = parse(src);
    const session = new Session(src, 42);
    session.advanceFrames(3);
    const view = session.traceAt(1);
    const tri = view.display.ops.find((o) => o.kind === "triangle")!;
    const active = activeGroupsAt(program, view, tri.stepIndex);
    expect(active.length).toBe(1);
    const world = applyMat(active[0]!.matrix, 240, 108); // b's local literal
    expect(world.x).toBeCloseTo((tri as { bx: number }).bx, 6);
    expect(world.y).toBeCloseTo((tri as { by: number }).by, 6);
  });

  it("is empty at top-level steps and on group-free programs", () => {
    const program = parse(src);
    const session = new Session(src, 42);
    session.advanceFrames(2);
    const view = session.traceAt(1);
    const spinAssign = [...pathAt(program, src.indexOf("spin = spin"))]
      .reverse().find((nd) => nd.kind === "assign")!;
    // find the assign's completion row via its emitted world: use step of
    // the FIRST triangle minus enough — simpler: any step before the first
    // frame op is outside every group in this program's shape.
    const firstOpStep = Math.min(...view.display.ops.map((o) => o.stepIndex));
    expect(spinAssign).toBeTruthy();
    expect(activeGroupsAt(program, view, 0).length).toBe(0);
    expect(firstOpStep).toBeGreaterThan(0);

    const hr = readFileSync("examples/house-row.chalk", "utf8");
    const hrView = new Session(hr, 42).traceSetup();
    expect(activeGroupsAt(parse(hr), hrView, 3)).toEqual([]);
  });
});
