// T10 — Gate C. Run with: PERF=1 npm run bench
// Budgets (CLAUDE.md): parse+fast <= 100 ms @ ~50k steps; instrumented
// <= 30 ms @ ~50k steps; fast <= 5 ms @ ~5k steps. Medians, warmups excluded.
import { describe, expect, it } from "vitest";
import { parse } from "../src/lang/parser.js";
import { evalFrame, runSetup, NO_INPUT } from "../src/engine/frame.js";

const PERF = process.env["PERF"] === "1";

function stressSource(iterations: number): string {
  return [
    "paper(color: #FFFFFF)",
    "state t = 0",
    "every frame:",
    "  t = t + 1",
    "  repeat " + iterations + " as i:",
    "    circle(center: (100 + i, 120), radius: 3, fill: #336699)",
    "",
  ].join("\n");
}

/** Median wall time of fn over `reps`, after `warmup` discarded runs. */
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

describe.skipIf(!PERF)("performance gates", () => {
  it("stress program actually lands near 50k steps (honest benchmark)", () => {
    const program = parse(stressSource(5000));
    const { state, staticLayer } = runSetup(program, 1);
    const r = evalFrame(program, staticLayer, state, NO_INPUT, "instrumented");
    const steps = r.trace!.count;
    console.log("stress steps/frame:", steps);
    expect(steps).toBeGreaterThan(40000);
    expect(steps).toBeLessThan(70000);
  });

  it("parse + fast frame @ ~50k steps: median <= 100 ms", () => {
    const src = stressSource(5000);
    const ms = median(() => {
      const program = parse(src);
      const { state, staticLayer } = runSetup(program, 1);
      evalFrame(program, staticLayer, state, NO_INPUT, "fast");
    });
    console.log("parse+fast @50k:", ms.toFixed(2), "ms");
    expect(ms).toBeLessThanOrEqual(100);
  });

  it("instrumented frame @ ~50k steps: median <= 30 ms", () => {
    const program = parse(stressSource(5000));
    const ms = median(() => {
      const { state, staticLayer } = runSetup(program, 1);
      evalFrame(program, staticLayer, state, NO_INPUT, "instrumented");
    });
    console.log("instrumented @50k:", ms.toFixed(2), "ms");
    expect(ms).toBeLessThanOrEqual(30);
  });

  it("fast frame @ ~5k steps: median <= 5 ms", () => {
    const program = parse(stressSource(500));
    const ms = median(() => {
      const { state, staticLayer } = runSetup(program, 1);
      evalFrame(program, staticLayer, state, NO_INPUT, "fast");
    });
    console.log("fast @5k:", ms.toFixed(2), "ms");
    expect(ms).toBeLessThanOrEqual(5);
  });
});

describe.skipIf(PERF)("performance gates (skipped)", () => {
  it("run with PERF=1 npm run bench", () => { expect(true).toBe(true); });
});
