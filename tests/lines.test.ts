// P2-T4 — the executed-lines timeline. house-row pins row ordering and hit
// counts; the synthetic loop pins the essay's conditional-gap pattern.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "../src/lang/parser.js";
import { Session } from "../src/host/run.js";
import { executedStatements, iterationGrid } from "../src/flow/lines.js";
import { pathAt } from "../src/lang/walk.js";
import type { Program } from "../src/lang/ast.js";

function repeatNode(program: Program, source: string): number {
  const path = pathAt(program, source.indexOf("repeat"));
  const hit = [...path].reverse().find((n) => n.kind === "repeat");
  expect(hit).toBeTruthy();
  return hit!.id;
}

describe("executedStatements (P2-T4)", () => {
  it("orders house-row rows by first completion, with per-row hit counts", () => {
    const src = readFileSync("examples/house-row.chalk", "utf8");
    const program = parse(src);
    const rows = executedStatements(program, new Session(src, 42).traceSetup());
    const heads = rows.map((r) => src.slice(r.span.start, r.span.start + 6));
    // completion is post-order in time: body rows precede their loop's row
    expect(heads).toEqual(["paper(", "rect(l", "triang", "house(", "repeat"]);
    expect(rows.map((r) => r.steps.length)).toEqual([1, 5, 5, 5, 1]);
    for (const r of rows) {
      expect([...r.steps]).toEqual([...r.steps].sort((a, b) => a - b));
    }
  });

  it("includes state declarations as setup rows", () => {
    const src = readFileSync("examples/bouncing-ball.chalk", "utf8");
    const rows = executedStatements(parse(src), new Session(src, 42).traceSetup());
    const heads = rows.map((r) => src.slice(r.span.start, r.span.start + 7));
    expect(heads).toEqual(["paper(c", "state y", "state s"]);
  });
});

describe("iterationGrid (P2-T4)", () => {
  const gapSrc = [
    "repeat 6 as i:",
    "  if i > 3:",
    "    circle(center: (10, 10), radius: 2, fill: #112233)",
    "  rect(left: 1, top: 1, width: 2, height: 2, fill: #445566)",
    "",
  ].join("\n");

  it("shows the conditional's gap pattern (the essay demo)", () => {
    const program = parse(gapSrc);
    const view = new Session(gapSrc, 42).traceSetup();
    const grid = iterationGrid(program, view, repeatNode(program, gapSrc));
    expect(grid.iterations).toBe(6);
    expect(grid.columns).toBe(6);
    expect(grid.truncated).toBe(false);
    const byHead = new Map(grid.rows.map((r) =>
      [gapSrc.slice(r.span.start, r.span.start + 2), r.cells]));
    // source order: if, circle, rect
    expect(grid.rows.length).toBe(3);
    expect(byHead.get("if")!.map((c) => c !== null))
      .toEqual([true, true, true, true, true, true]);
    expect(byHead.get("ci")!.map((c) => c !== null))
      .toEqual([false, false, false, true, true, true]); // i goes 1..6
    expect(byHead.get("re")!.map((c) => c !== null))
      .toEqual([true, true, true, true, true, true]);
  });

  it("cells hold completion steps that ascend across an iteration's window", () => {
    const program = parse(gapSrc);
    const view = new Session(gapSrc, 42).traceSetup();
    const grid = iterationGrid(program, view, repeatNode(program, gapSrc));
    for (const row of grid.rows) {
      const steps = row.cells.filter((c): c is number => c !== null);
      expect([...steps]).toEqual([...steps].sort((a, b) => a - b));
    }
  });

  it("caps columns and reports truncation (D18)", () => {
    const bigSrc = "repeat 200 as i:\n  circle(center: (i, 10), radius: 1, fill: #112233)\n";
    const program = parse(bigSrc);
    const view = new Session(bigSrc, 42).traceSetup();
    const grid = iterationGrid(program, view, repeatNode(program, bigSrc), 64);
    expect(grid.iterations).toBe(200);
    expect(grid.columns).toBe(64);
    expect(grid.truncated).toBe(true);
    for (const row of grid.rows) expect(row.cells.length).toBe(64);
  });
});
