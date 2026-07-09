// P1-T4 — cross-highlighting. house-row is the fixture: 5 houses, each a
// rect then a triangle, so the display list is r,t,r,t,... (indices 0..9)
// per decision D5 (all of it staticOps; paper() sets bg, not an op).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "../src/lang/parser.js";
import { Session } from "../src/host/run.js";
import { ancestorIds, opsForSpan, spanForOp } from "../src/ui/link.js";
import { pathAt } from "../src/lang/walk.js";

const src = readFileSync("examples/house-row.chalk", "utf8");

function fixture() {
  const program = parse(src);
  const session = new Session(src, 42);
  const ops = session.displayAt(0).ops;
  expect(ops.length).toBe(10);
  return { program, ops };
}

function spanOf(needle: string, len = needle.length) {
  const start = src.indexOf(needle);
  expect(start).toBeGreaterThanOrEqual(0);
  return { start, end: start + len };
}

describe("code -> stage (P1-T4)", () => {
  it("selecting the repeat block selects every op it produced", () => {
    const { program, ops } = fixture();
    const repeatSpan = { start: src.indexOf("repeat 5"), end: src.length };
    expect(opsForSpan(ops, program, repeatSpan)).toEqual([0,1,2,3,4,5,6,7,8,9]);
  });

  it("selecting the rect call inside `to house` selects the 5 rects across iterations", () => {
    const { program, ops } = fixture();
    expect(opsForSpan(ops, program, spanOf("rect(left:"))).toEqual([0, 2, 4, 6, 8]);
  });

  it("selecting the house(...) call site selects all 10 ops", () => {
    const { program, ops } = fixture();
    expect(opsForSpan(ops, program, spanOf("house(at:"))).toEqual([0,1,2,3,4,5,6,7,8,9]);
  });

  it("selecting the paper line selects nothing (backgrounds are not ops)", () => {
    const { program, ops } = fixture();
    expect(opsForSpan(ops, program, spanOf("paper(color:"))).toEqual([]);
  });
});

describe("stage -> code (P1-T4)", () => {
  it("maps a triangle op back to the triangle call", () => {
    const { program, ops } = fixture();
    const span = spanForOp(ops, program, 1);
    expect(span).not.toBeNull();
    expect(src.slice(span!.start).startsWith("triangle(")).toBe(true);
  });

  it("maps every op to a call whose span contains only that call", () => {
    const { program, ops } = fixture();
    for (let i = 0; i < ops.length; i++) {
      const span = spanForOp(ops, program, i);
      expect(span, "op " + i).not.toBeNull();
      expect(/^(rect|triangle)\(/.test(src.slice(span!.start, span!.end))).toBe(true);
    }
  });
});

describe("ancestorIds (P1-T4)", () => {
  it("returns self..top-level, matching pathAt reversed", () => {
    const program = parse(src);
    const path = pathAt(program, src.indexOf("rect(") + 1);
    const call = path[path.length - 1]!;
    expect(call.kind).toBe("call");
    expect(ancestorIds(program, call.id)).toEqual(
      path.map((n) => n.id).reverse(),
    );
  });
});
