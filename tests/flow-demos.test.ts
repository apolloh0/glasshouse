// Gate I — the essay's flow demonstrations, as assertions. If these pass,
// "scrub a drawing", "read a conditional's pattern across frames", and "see
// the ball's whole arc" all demonstrably work on the example set.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "../src/lang/parser.js";
import { Session } from "../src/host/run.js";
import { scrubView, stepCount } from "../src/flow/steps.js";
import { executedInFrames } from "../src/flow/lines.js";
import { trailOps } from "../src/flow/frames.js";

describe("Gate I — flow demonstrations", () => {
  it("(a) scrubbing house-row reveals the picture one shape at a time", () => {
    const src = readFileSync("examples/house-row.chalk", "utf8");
    const program = parse(src);
    const view = new Session(src, 42).traceSetup();
    const seen = new Set<number>();
    let prev = 0;
    for (let s = 0; s < stepCount(view); s++) {
      const u = scrubView(program, 0, view, s).upToOp;
      expect(u).toBeGreaterThanOrEqual(prev);
      expect(u - prev, "one shape at a time").toBeLessThanOrEqual(1);
      seen.add(u);
      prev = u;
    }
    // every partial picture 0..10 is reachable — that IS the scrubber
    expect([...seen].sort((a, b) => a - b)).toEqual([0,1,2,3,4,5,6,7,8,9,10]);
  });

  it("(b) the clamp branch executes exactly in the frames where the ball sits on the floor", () => {
    const src = readFileSync("examples/bouncing-ball.chalk", "utf8");
    const program = parse(src);
    const session = new Session(src, 42);
    session.advanceFrames(60);

    const frames = Array.from({ length: 59 }, (_, i) => i + 1);
    const views = frames.map((k) => ({ frame: k, view: session.traceAt(k) }));
    const rows = executedInFrames(program, views);
    const rowFor = (needle: string) =>
      rows.find((r) => src.slice(r.span.start, r.span.end).includes(needle))!;

    const clampY = rowFor("y = 220");
    const clampSpeed = rowFor("0 - speed * 0.85");
    const drawRow = rowFor("circle(");

    // the two clamp lines fire together, and only together
    expect(clampY.frames.map((c) => c !== null))
      .toEqual(clampSpeed.frames.map((c) => c !== null));
    // the draw always fires
    expect(drawRow.frames.every((c) => c !== null)).toBe(true);

    const clampFrames = frames.filter((_, i) => clampY.frames[i] !== null);
    const floorFrames = frames.filter(
      (k) => (session.displayAt(k).ops[0] as { cy: number }).cy === 220,
    );
    expect(clampFrames).toEqual(floorFrames);
    expect(clampFrames.length).toBeGreaterThan(0);
    expect(clampFrames.length).toBeLessThan(frames.length);
  });

  it("(c) trails show the ball's whole arc: fall, floor, bounce", () => {
    const src = readFileSync("examples/bouncing-ball.chalk", "utf8");
    const session = new Session(src, 42);
    session.advanceFrames(90);
    const cy = (k: number): number =>
      (session.displayAt(k).ops[0] as { cy: number }).cy;

    const ys = Array.from({ length: 90 }, (_, k) => cy(k));
    expect(Math.max(...ys)).toBe(220);           // the floor is exact (clamp)
    const floor = ys.findIndex((y) => y === 220);
    expect(floor).toBeGreaterThan(0);
    expect(ys[floor + 1]!).toBeLessThan(220);     // and then it bounces
    for (let k = 1; k <= floor; k++) {
      expect(ys[k]!).toBeGreaterThan(ys[k - 1]!); // monotone fall (y-down)
    }

    const slices = trailOps((k) => session.displayAt(k), 89, 8, 4);
    expect(slices.map((s) => s.frame)).toEqual([57, 61, 65, 69, 73, 77, 81, 85]);
    for (const s of slices) expect(s.ops.length).toBeGreaterThan(0);
  });
});
