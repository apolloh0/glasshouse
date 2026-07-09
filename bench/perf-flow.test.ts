// P2-T8 — Gate K. Run with: PERF=1 npm run bench
// Matching runs on every successful parse (keystroke-adjacent); scrub
// queries run on every slider tick. Budgets (CLAUDE.md): match <= 10 ms on
// a 500-line one-literal edit; scrubView <= 2 ms and iterationGrid <= 15 ms
// on the ~50k-step stress trace.
import { describe, expect, it } from "vitest";
import { parse } from "../src/lang/parser.js";
import { matchPrograms } from "../src/lang/match.js";
import { IdTracker } from "../src/host/ids.js";
import { Session } from "../src/host/run.js";
import { scrubView, stepCount } from "../src/flow/steps.js";
import { iterationGrid } from "../src/flow/lines.js";
import { pathAt } from "../src/lang/walk.js";

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

function bigSource(lines: number): string {
  const out = ["paper(color: #FFFFFF)"];
  for (let i = 0; i < lines; i++) {
    out.push(`circle(center: (${(i * 7) % 320}, ${(i * 13) % 240}), radius: ${3 + (i % 9)}, fill: #336699)`);
  }
  return out.join("\n") + "\n";
}

const stress =
  "paper(color: #FFFFFF)\n" +
  "repeat 5000 as i:\n" +
  "  circle(center: (100 + i, 120), radius: 3, fill: #336699)\n";

describe.skipIf(!PERF)("flow budgets (Gate K)", () => {
  it("matchPrograms <= 10 ms on a 500-line one-literal edit", () => {
    const prevSrc = bigSource(500);
    const prev = parse(prevSrc);
    const next = parse(prevSrc.replace("radius: 5,", "radius: 6,"));
    const base = new IdTracker().advance(prev);
    const ms = median(() => matchPrograms(prev, base.stableOf, next, base.nextMint));
    console.log(`match 500-line edit: ${ms.toFixed(2)} ms`);
    expect(ms).toBeLessThanOrEqual(10);
  });

  it("scrubView <= 2 ms at ~50k steps", () => {
    const program = parse(stress);
    const view = new Session(stress, 42).traceSetup();
    const last = stepCount(view) - 1;
    const ms = median(() => scrubView(program, 0, view, last));
    console.log(`scrubView @50k: ${ms.toFixed(3)} ms`);
    expect(ms).toBeLessThanOrEqual(2);
  });

  it("iterationGrid <= 15 ms at ~50k steps (capped columns)", () => {
    const program = parse(stress);
    const view = new Session(stress, 42).traceSetup();
    const loop = [...pathAt(program, stress.indexOf("repeat"))]
      .reverse().find((n) => n.kind === "repeat")!;
    const ms = median(() => iterationGrid(program, view, loop.id, 64));
    console.log(`iterationGrid @50k: ${ms.toFixed(2)} ms`);
    expect(ms).toBeLessThanOrEqual(15);
  });
});
