// P5-T7 — Gate AC. Run with: PERF=1 npm run bench
// Gestures run at click speed: each <= 15 ms on its fixture INCLUDING the
// oracle re-run the studio performs before committing.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "../src/lang/parser.js";
import { nameThisNumber, repeatThis, teachThis } from "../src/ui/gestures.js";
import { previewFor } from "../src/ui/complete.js";
import { pathAt, visit } from "../src/lang/walk.js";

const PERF = process.env["PERF"] === "1";

function median(fn: () => void, reps = 15, warmup = 5): number {
  for (let i = 0; i < warmup; i++) fn();
  const t: number[] = [];
  for (let i = 0; i < reps; i++) {
    const t0 = process.hrtime.bigint();
    fn();
    t.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  t.sort((a, b) => a - b);
  return t[Math.floor(t.length / 2)]!;
}

describe.skipIf(!PERF)("gesture budgets (Gate AC)", () => {
  it("nameThisNumber + oracle <= 15 ms on bouncing-ball", () => {
    const src = readFileSync("examples/bouncing-ball.chalk", "utf8");
    const program = parse(src);
    const lit = [...pathAt(program, src.indexOf("radius: 20") + 8)].reverse()
      .find((n) => n.kind === "number")!.id;
    const ms = median(() => {
      const r = nameThisNumber(src, program, lit, "size");
      if (r.ok) previewFor(r.source, 42);
    });
    console.log(`nameThisNumber: ${ms.toFixed(2)} ms`);
    expect(ms).toBeLessThanOrEqual(15);
  });

  it("repeatThis + oracle <= 15 ms on a 12-statement run", () => {
    const lines = ["paper(color: #FFFFFF)"];
    for (let i = 0; i < 12; i++) {
      lines.push(`circle(center: (${20 + i * 24}, 120), radius: 9, fill: #7A4EA3)`);
    }
    const src = lines.join("\n") + "\n";
    const program = parse(src);
    const ids: number[] = [];
    visit(program, (n, parent) => {
      if (n.kind === "expr" && parent === null &&
          src.slice(n.span.start).startsWith("circle")) ids.push(n.id);
    });
    const ms = median(() => {
      const r = repeatThis(src, program, ids);
      if (r.ok) previewFor(r.source, 42);
    });
    console.log(`repeatThis x12: ${ms.toFixed(2)} ms`);
    expect(ms).toBeLessThanOrEqual(15);
  });

  it("teachThis + oracle <= 15 ms", () => {
    const src = "paper(color: #FFFFFF)\n" +
      "rect(left: 60, top: 180, width: 48, height: 40, fill: #C46A3D)\n" +
      "triangle(a: (60, 180), b: (108, 180), c: (84, 150), fill: #8A3324)\n";
    const program = parse(src);
    const ids: number[] = [];
    visit(program, (n, parent) => {
      if (n.kind === "expr" && parent === null) ids.push(n.id);
    });
    const ms = median(() => {
      const r = teachThis(src, program, ids.slice(1), "hut");
      if (r.ok) previewFor(r.source, 42);
    });
    console.log(`teachThis: ${ms.toFixed(2)} ms`);
    expect(ms).toBeLessThanOrEqual(15);
  });
});
