// P3-T2 — the state panel model. The sparkline block is pure (red on
// P3-T2 alone); the rest runs on traced frames.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "../src/lang/parser.js";
import { Session } from "../src/host/run.js";
import {
  sparkline, stateRows, varsAtStep, varSeries, writeEvents,
} from "../src/flow/state.js";

const src = readFileSync("examples/bouncing-ball.chalk", "utf8");

function floorFrame(session: Session, upTo = 60): number {
  for (let k = 1; k < upTo; k++) {
    if ((session.displayAt(k).ops[0] as { cy: number }).cy === 220) return k;
  }
  throw new Error("no floor contact in " + upTo + " frames");
}

describe("sparkline (P3-T2, pure)", () => {
  it("pins the geometry (D29)", () => {
    const s = sparkline([0, 5, 10], 21, 11)!;
    expect(s.min).toBe(0);
    expect(s.max).toBe(10);
    expect(s.points).toEqual([
      { x: 0, y: 10 }, { x: 10, y: 5 }, { x: 20, y: 0 },
    ]);
  });

  it("centers flat series, gaps nulls, nulls out empty", () => {
    expect(sparkline([7, 7], 11, 11)!.points).toEqual([
      { x: 0, y: 5 }, { x: 10, y: 5 },
    ]);
    expect(sparkline([0, null, 10], 21, 11)!.points).toEqual([
      { x: 0, y: 10 }, { x: 20, y: 0 },
    ]);
    expect(sparkline([null, null], 21, 11)).toBeNull();
  });
});

describe("state rows (P3-T2)", () => {
  it("shows the bounce: speed enters positive, flips negative", () => {
    const program = parse(src);
    const session = new Session(src, 42);
    session.advanceFrames(60);
    const k = floorFrame(session);
    const rows = stateRows(program, session.traceAt(k), session.stateAt(k).vars);

    expect(rows.map((r) => r.name)).toEqual(["y", "speed"]); // declaration order
    const speed = rows[1]!;
    expect((speed.entering as { v: number }).v).toBeGreaterThan(0);
    expect(speed.writes.length).toBe(2); // speed = speed + 0.5, then the flip
    expect((speed.writes[1]!.value as { v: number }).v).toBeLessThan(0);
    expect(speed.leaving).toEqual(speed.writes[1]!.value);

    const y = rows[0]!;
    expect((y.leaving as { v: number }).v).toBe(220); // clamped
  });

  it("varsAtStep applies writes in post-state order", () => {
    const program = parse(src);
    const session = new Session(src, 42);
    session.advanceFrames(3);
    const view = session.traceAt(1);
    const entering = session.stateAt(1).vars;
    const events = writeEvents(program, view);
    expect(events.length).toBeGreaterThanOrEqual(2);
    const first = events[0]!;
    const before = varsAtStep(program, view, entering, first.step - 1);
    const after = varsAtStep(program, view, entering, first.step);
    expect(before.get(first.name)).toEqual(entering.get(first.name));
    expect(after.get(first.name)).toEqual(first.value);
  });

  it("a setup trace births vars: null entering, initializer as write", () => {
    const program = parse(src);
    const rows = stateRows(program, new Session(src, 42).traceSetup(), new Map());
    const y = rows.find((r) => r.name === "y")!;
    expect(y.entering).toBeNull();
    expect(y.writes.length).toBe(1);
    expect(y.leaving).toEqual({ t: "num", v: 40 });
  });
});

describe("varSeries (P3-T2)", () => {
  it("tracks y entering each frame and shows the arc", () => {
    const session = new Session(src, 42);
    session.advanceFrames(60);
    const k = floorFrame(session);
    const frames = Array.from({ length: 8 }, (_, i) => k - 3 + i);
    const ys = varSeries((f) => session.stateAt(f), "y", frames);
    expect(ys.every((v) => v !== null)).toBe(true);
    expect(Math.max(...(ys as number[]))).toBeLessThanOrEqual(220);
    // rising into the floor, then away from it: not monotone
    const nums = ys as number[];
    expect(nums.some((v, i) => i > 0 && v < nums[i - 1]!)).toBe(true);
    expect(nums.some((v, i) => i > 0 && v > nums[i - 1]!)).toBe(true);
  });

  it("is null for unknown names", () => {
    const session = new Session(src, 42);
    session.advanceFrames(2);
    expect(varSeries((f) => session.stateAt(f), "nope", [0, 1])).toEqual([null, null]);
  });
});
