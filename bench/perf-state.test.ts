// P3-T8 — Gate O. Run with: PERF=1 npm run bench
// Budgets (CLAUDE.md): writeEvents/stateRows <= 10 ms and valuesForNode
// <= 5 ms on ~50k-step traces; varSeries <= 80 ms over a 64-frame window
// (each stateAt may replay up to 29 frames — see escalation in the spec);
// diffDisplay <= 2 ms at 500 ops.
import { describe, expect, it } from "vitest";
import { parse } from "../src/lang/parser.js";
import { Session } from "../src/host/run.js";
import { stateRows, varSeries, writeEvents } from "../src/flow/state.js";
import { valuesForNode } from "../src/flow/cells.js";
import { diffDisplay } from "../src/flow/diff.js";
import { pathAt } from "../src/lang/walk.js";
import type { DisplayOp } from "../src/render/displayList.js";

const PERF = process.env["PERF"] === "1";

function median(fn: () => void, reps = 15, warmup = 5): number {
  for (let i = 0; i < warmup; i++) fn();
  const times: number[] = [];
  for (let i = 0; i < reps; i++) {
    const t0 = process.hrtime.bigint();
    fn();
    times.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)]!;
}

const writeStress =
  "paper(color: #FFFFFF)\nstate t = 0\nevery frame:\n" +
  "  repeat 5000 as i:\n    t = t + 1\n" +
  "  circle(center: (10, 10), radius: 2, fill: #112233)\n";

const exprStress =
  "paper(color: #FFFFFF)\nrepeat 5000 as i:\n" +
  "  circle(center: (100 + i, 120), radius: 3, fill: #336699)\n";

describe.skipIf(!PERF)("state budgets (Gate O)", () => {
  it("writeEvents + stateRows <= 10 ms @ ~5k writes in a ~50k-step trace", () => {
    const program = parse(writeStress);
    const session = new Session(writeStress, 42);
    session.advanceFrames(1);
    const view = session.traceAt(0);
    const entering = session.stateAt(0).vars;
    const ms = median(() => {
      writeEvents(program, view);
      stateRows(program, view, entering);
    });
    console.log(`writeEvents+stateRows @5k writes: ${ms.toFixed(2)} ms`);
    expect(ms).toBeLessThanOrEqual(10);
  });

  it("valuesForNode <= 5 ms @ ~50k steps", () => {
    const program = parse(exprStress);
    const view = new Session(exprStress, 42).traceSetup();
    const node = [...pathAt(program, exprStress.indexOf("100 + i"))]
      .reverse().find((n) => n.kind === "binop")!;
    const ms = median(() => valuesForNode(view, node.id));
    console.log(`valuesForNode @50k: ${ms.toFixed(2)} ms`);
    expect(ms).toBeLessThanOrEqual(5);
  });

  it("varSeries <= 80 ms over a 64-frame window", () => {
    const src = "paper(color: #FFFFFF)\nstate y = 0\nevery frame:\n  y = y + 1\n  circle(center: (10, y), radius: 2, fill: #112233)\n";
    const session = new Session(src, 42);
    session.advanceFrames(128);
    const frames = Array.from({ length: 64 }, (_, i) => i + 32);
    const ms = median(() => varSeries((k) => session.stateAt(k), "y", frames), 9, 3);
    console.log(`varSeries 64-frame window: ${ms.toFixed(2)} ms`);
    expect(ms).toBeLessThanOrEqual(80);
  });

  it("diffDisplay <= 2 ms @ 500 ops", () => {
    const mk = (jitter: number): DisplayOp[] =>
      Array.from({ length: 500 }, (_, i) => ({
        kind: "circle", cx: i + jitter * (i % 7 === 0 ? 1 : 0), cy: 10, r: 3,
        fill: 0, sourceNodeId: 5 + (i % 9), stepIndex: i,
      } as DisplayOp));
    const a = mk(0), b = mk(1);
    const ms = median(() => diffDisplay(a, b));
    console.log(`diffDisplay @500: ${ms.toFixed(3)} ms`);
    expect(ms).toBeLessThanOrEqual(2);
  });
});
