// P3-T3 — typed cells and aggregates. numericSummary / stridedSamples /
// cellZoomMode are pure (red on P3-T3 alone); the rest runs on traces.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "../src/lang/parser.js";
import { Session } from "../src/host/run.js";
import {
  cellZoomMode, numericSummary, stridedSamples, valueCells, valuesForNode,
} from "../src/flow/cells.js";
import { pathAt } from "../src/lang/walk.js";
import type { Program } from "../src/lang/ast.js";

function nodeAt(program: Program, src: string, needle: string, kind: string): number {
  const path = pathAt(program, src.indexOf(needle));
  const hit = [...path].reverse().find((n) => n.kind === kind);
  expect(hit, kind + " at " + JSON.stringify(needle)).toBeTruthy();
  return hit!.id;
}

describe("pure aggregates (P3-T3)", () => {
  it("numericSummary", () => {
    expect(numericSummary([3, 1, 4, 1, 5])).toEqual({
      count: 5, min: 1, max: 5, first: 3, last: 5, mean: 2.8,
    });
  });

  it("stridedSamples picks evenly, dedupes, preserves order", () => {
    expect(stridedSamples([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 4)).toEqual([0, 3, 6, 9]);
    expect(stridedSamples([0, 1, 2], 5)).toEqual([0, 1, 2]);
    expect(stridedSamples([7], 3)).toEqual([7]);
  });

  it("cellZoomMode pins the 28px threshold (D26)", () => {
    expect(cellZoomMode(28)).toBe("figures");
    expect(cellZoomMode(27.9)).toBe("plot");
  });
});

describe("cell classification (P3-T3)", () => {
  const src = readFileSync("examples/bouncing-ball.chalk", "utf8");

  function fixture() {
    const program = parse(src);
    const session = new Session(src, 42);
    session.advanceFrames(2);
    return { program, view: session.traceAt(0) };
  }

  it("assignments are value cells carrying the written value", () => {
    const { program, view } = fixture();
    const cells = valueCells(program, view, nodeAt(program, src, "y = y + speed", "assign"));
    expect(cells.length).toBe(1);
    expect(cells[0]!.kind).toBe("value");
  });

  it("draw calls are ops cells spanning exactly their emission", () => {
    const { program, view } = fixture();
    const cells = valueCells(program, view, nodeAt(program, src, "circle(center", "expr"));
    expect(cells.length).toBe(1);
    const c = cells[0]!;
    expect(c.kind).toBe("ops");
    if (c.kind === "ops") expect(c.opEnd - c.opStart).toBe(1);
  });

  it("control statements are marks", () => {
    const { program, view } = fixture();
    const cells = valueCells(program, view, nodeAt(program, src, "if y > 220", "if"));
    expect(cells.length).toBe(1);
    expect(cells[0]!.kind).toBe("mark");
  });
});

describe("valuesForNode (P3-T3)", () => {
  it("lists every value an expression took, in order", () => {
    const src = "repeat 4 as i:\n  circle(center: (10, 10), radius: i * 2, fill: #112233)\n";
    const program = parse(src);
    const view = new Session(src, 42).traceSetup();
    const values = valuesForNode(view, nodeAt(program, src, "i * 2", "binop"));
    expect(values).toEqual([
      { t: "num", v: 2 }, { t: "num", v: 4 }, { t: "num", v: 6 }, { t: "num", v: 8 },
    ]);
  });
});
