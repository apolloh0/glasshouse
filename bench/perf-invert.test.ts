// P4b-T6 — Gate X. Run with: PERF=1 npm run bench
// Budgets (CLAUDE.md): attrChain+dragCandidates <= 3 ms on house-row;
// the same on the ~50k-step stress trace <= 5 ms; full drag tick
// (candidates + apply + preview rerun) <= 12 ms on bouncing-ball.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "../src/lang/parser.js";
import { Session } from "../src/host/run.js";
import { dragCandidates, applyCandidate } from "../src/flow/invert.js";
import { previewFor } from "../src/ui/complete.js";

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

describe.skipIf(!PERF)("inversion budgets (Gate X)", () => {
  it("dragCandidates <= 3 ms on house-row", () => {
    const src = readFileSync("examples/house-row.chalk", "utf8");
    const program = parse(src);
    const view = new Session(src, 42).traceSetup();
    const ms = median(() => dragCandidates(program, view, view.display.ops, 4, 30, 0));
    console.log(`dragCandidates house-row: ${ms.toFixed(3)} ms`);
    expect(ms).toBeLessThanOrEqual(3);
  });

  it("dragCandidates <= 5 ms on the ~50k-step stress trace", () => {
    const stress =
      "paper(color: #FFFFFF)\nrepeat 5000 as i:\n" +
      "  circle(center: (100 + i, 120), radius: 3, fill: #336699)\n";
    const program = parse(stress);
    const view = new Session(stress, 42).traceSetup();
    const last = view.display.ops.length - 1;
    const ms = median(() => dragCandidates(program, view, view.display.ops, last, 10, 0));
    console.log(`dragCandidates @50k: ${ms.toFixed(3)} ms`);
    expect(ms).toBeLessThanOrEqual(5);
  });

  it("full drag tick <= 12 ms on bouncing-ball", () => {
    const src = readFileSync("examples/bouncing-ball.chalk", "utf8");
    const program = parse(src);
    const session = new Session(src, 42);
    session.advanceFrames(3);
    const view = session.traceAt(2);
    let dx = 10;
    const ms = median(() => {
      dx = dx === 10 ? 11 : 10;
      const solve = dragCandidates(program, view, view.display.ops, 0, dx, 0);
      const next = applyCandidate(src, program, solve.candidates[0]!);
      previewFor(next, 42);
    });
    console.log(`drag tick bouncing-ball: ${ms.toFixed(2)} ms`);
    expect(ms).toBeLessThanOrEqual(12);
  });
});
