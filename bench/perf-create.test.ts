// P4a-T9 — Gate S. Run with: PERF=1 npm run bench
// The drag loop is the one that matters: pointer-move -> splice -> reparse
// -> rerun must fit a 60fps frame with room for rendering. Budgets
// (CLAUDE.md): previewFor <= 20 ms per example; completionsAt <= 2 ms on
// the 500-line synthetic; drag loop <= 10 ms on bouncing-ball.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "../src/lang/parser.js";
import { completionsAt, previewFor } from "../src/ui/complete.js";
import { numberDragAt } from "../src/ui/drag.js";

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

describe.skipIf(!PERF)("create budgets (Gate S)", () => {
  for (const name of ["bouncing-ball", "house-row", "pointer-paint", "scale-spiral", "pinwheel"]) {
    it(`previewFor ${name} <= 20 ms`, () => {
      const src = readFileSync("examples/" + name + ".chalk", "utf8");
      const ms = median(() => previewFor(src, 42));
      console.log(`previewFor ${name}: ${ms.toFixed(2)} ms`);
      expect(ms).toBeLessThanOrEqual(20);
    });
  }

  it("completionsAt <= 2 ms on synthetic-500", () => {
    const src = bigSource(500);
    const program = parse(src);
    const typing = src + "ci";
    const ms = median(() => completionsAt(program, typing, typing.length));
    console.log(`completionsAt synthetic-500: ${ms.toFixed(3)} ms`);
    expect(ms).toBeLessThanOrEqual(2);
  });

  it("drag loop (spec + splice + reparse + preview) <= 10 ms on bouncing-ball", () => {
    const src = readFileSync("examples/bouncing-ball.chalk", "utf8");
    const program = parse(src);
    const off = src.indexOf("radius: 20") + "radius: ".length;
    let v = 20;
    const ms = median(() => {
      const d = numberDragAt(program, src, off)!;
      v = v === 20 ? 21 : 20;
      const next = d.apply(v);
      previewFor(next, 42);
    });
    console.log(`drag loop bouncing-ball: ${ms.toFixed(2)} ms`);
    expect(ms).toBeLessThanOrEqual(10);
  });
});
