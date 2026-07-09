// P1-T9 — Gate F. Run with: PERF=1 npm run bench
// The editor loop = everything one keystroke can trigger: both parses, a
// fast run, hover resolution, one cross-highlight query. Budgets
// (CLAUDE.md): <= 50 ms on each example, <= 100 ms on 500 synthetic lines.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "../src/lang/parser.js";
import { parser as lezerParser } from "../src/editor/gen/chalk-parser.js";
import { Session } from "../src/host/run.js";
import { labelAt } from "../src/ui/hover.js";
import { opsForSpan } from "../src/ui/link.js";

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

function synthetic(lines: number): string {
  const out = ["paper(color: #FFFFFF)"];
  for (let i = 0; i < lines; i++) {
    out.push(`circle(center: (${(i * 7) % 320}, ${(i * 13) % 240}), radius: ${3 + (i % 9)}, fill: #3366${(i % 2) ? "99" : "CC"})`);
  }
  return out.join("\n") + "\n";
}

function editorLoop(source: string): void {
  const program = parse(source);
  lezerParser.parse(source);
  const session = new Session(source, 42);
  const ops = session.displayAt(0).ops;
  const step = Math.max(1, Math.floor(source.length / 5));
  for (let off = 0; off < source.length; off += step) labelAt(program, off);
  opsForSpan(ops, program, { start: 0, end: source.length });
}

describe.skipIf(!PERF)("editor loop budget (Gate F)", () => {
  for (const name of ["bouncing-ball", "house-row", "pointer-paint"]) {
    it(name + " <= 50 ms", () => {
      const source = readFileSync("examples/" + name + ".chalk", "utf8");
      const ms = median(() => editorLoop(source));
      console.log(`editor loop ${name}: ${ms.toFixed(2)} ms`);
      expect(ms).toBeLessThanOrEqual(50);
    });
  }

  it("500 synthetic lines <= 100 ms", () => {
    const source = synthetic(500);
    const ms = median(() => editorLoop(source));
    console.log(`editor loop synthetic-500: ${ms.toFixed(2)} ms`);
    expect(ms).toBeLessThanOrEqual(100);
  });
});
