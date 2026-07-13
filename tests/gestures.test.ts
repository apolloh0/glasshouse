// Phase 5 — the abstraction gestures under their one oracle: the picture
// may not change. samePicture() is byte equality over setup and (for
// animated programs) a 60-frame run at the same seed. The untouched-id
// pin reuses the Phase 2 matcher: fresh/dropped stay confined to the
// rewritten region.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "../src/lang/parser.js";
import { Session } from "../src/host/run.js";
import { IdTracker } from "../src/host/ids.js";
import { serializeVisual } from "../src/render/displayList.js";
import { pathAt, visit } from "../src/lang/walk.js";
import {
  connectNumbers, findRepeatRuns, nameThisNumber, openThisUp, repeatThis,
  teachThis, validName,
} from "../src/ui/gestures.js";
import { affineText, pointText, splice } from "../src/ui/synth.js";
import { JARGON } from "./meta.test.js";
import type { Program } from "../src/lang/ast.js";

const P = "paper(color: #FFFFFF)\n";

function samePicture(a: string, b: string, frames = 60): void {
  const sa = new Session(a, 42), sb = new Session(b, 42);
  expect(serializeVisual(sb.displayAt(0)))
    .toBe(serializeVisual(sa.displayAt(0)));
  if (parse(a).frames.length > 0 || parse(a).events.length > 0) {
    sa.advanceFrames(frames); sb.advanceFrames(frames);
    for (const k of [1, 29, 30, frames - 1]) {
      expect(serializeVisual(sb.displayAt(k)))
        .toBe(serializeVisual(sa.displayAt(k)));
    }
  }
}

function litAt(program: Program, src: string, needle: string): number {
  // The first number literal at or after the needle position (a needle like
  // "radius: 20" starts on the label, not the number).
  const from = src.indexOf(needle);
  let best = Infinity;
  let id: number | undefined;
  visit(program, (n) => {
    if (n.kind === "number" && n.span.start >= from && n.span.start < best) {
      best = n.span.start;
      id = n.id;
    }
  });
  expect(id, needle).toBeTruthy();
  return id!;
}

function stmtAt(program: Program, src: string, needle: string): number {
  // The first call statement whose text begins with the needle (a needle
  // like "house(at:" also occurs in a `to house(at:...` definition header,
  // which is not a statement — match the statement, not the first index).
  let id: number | undefined;
  visit(program, (n) => {
    if (id === undefined && n.kind === "expr" && src.slice(n.span.start).startsWith(needle)) {
      id = n.id;
    }
  });
  expect(id, needle).toBeTruthy();
  return id!;
}

describe("synth (P5-T0)", () => {
  it("pins the affine forms", () => {
    expect(affineText(40, 0)).toBe("40");
    expect(affineText(0, 1)).toBe("i - 1");
    expect(affineText(0, 50)).toBe("(i - 1) * 50");
    expect(affineText(50, 50)).toBe("i * 50");
    expect(affineText(40, 50)).toBe("40 + (i - 1) * 50");
    expect(affineText(200, -30)).toBe("200 - (i - 1) * 30");
  });

  it("points and splices", () => {
    expect(pointText(60, 80)).toBe("(60, 80)");
    expect(splice("abcdef", 2, 4, "XY")).toBe("abXYef");
  });
});

describe("nameThisNumber (P5-T1, D51)", () => {
  it("names the ball's radius; the picture cannot move", () => {
    const src = readFileSync("examples/bouncing-ball.chalk", "utf8");
    const program = parse(src);
    const r = nameThisNumber(src, program, litAt(program, src, "radius: 20"), "size");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.source).toContain("state size = 20");
    expect(r.source).toContain("radius: size");
    expect(r.source.indexOf("state size"))
      .toBeGreaterThan(r.source.indexOf("state speed")); // after last decl
    samePicture(src, r.source);
  });

  it("validName rejects keywords, builtins, and taken names", () => {
    const program = parse(readFileSync("examples/bouncing-ball.chalk", "utf8"));
    expect(validName(program, "size")).toBe(true);
    expect(validName(program, "repeat")).not.toBe(true);
    expect(validName(program, "circle")).not.toBe(true);
    expect(validName(program, "speed")).not.toBe(true);
    expect(validName(program, "2big")).not.toBe(true);
  });
});

describe("connectNumbers (P5-T2, D52)", () => {
  const src = P +
    "circle(center: (80, 120), radius: 20, fill: #112233)\n" +
    "circle(center: (200, 120), radius: 40, fill: #112233)\n";

  it("offers scale-then-offset for a clean ratio; every candidate oracle-clean", () => {
    const program = parse(src);
    const r = connectNumbers(src, program,
      litAt(program, src, "radius: 20"), litAt(program, src, "radius: 40"), "size");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.candidates.map((c) => c.kind)).toEqual(["scale", "offset"]);
    expect(r.candidates[0]!.source).toContain("radius: size * 2");
    expect(r.candidates[1]!.source).toContain("radius: size + 20");
    for (const c of r.candidates) {
      expect(c.source).toContain("state size = 20");
      samePicture(src, c.source);
    }
  });

  it("equal values connect as the same name", () => {
    const eq = src.replace("radius: 40", "radius: 20");
    const program = parse(eq);
    const lits = [litAt(program, eq, "radius: 20"),
      litAt(program, eq, "radius: 20,\n".slice(0, 10))];
    void lits;
    const a = litAt(program, eq, "radius: 20");
    const bOff = eq.lastIndexOf("radius: 20") + "radius: ".length;
    const b = [...pathAt(program, bOff)].reverse().find((n) => n.kind === "number")!.id;
    const r = connectNumbers(eq, program, a, b, "size");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.candidates.map((c) => c.kind)).toEqual(["same"]);
    samePicture(eq, r.candidates[0]!.source);
  });
});

describe("repeatThis (P5-T3, D53)", () => {
  const three = P +
    "circle(center: (40, 120), radius: 15, fill: #7A4EA3)\n" +
    "circle(center: (90, 120), radius: 15, fill: #7A4EA3)\n" +
    "circle(center: (140, 120), radius: 15, fill: #7A4EA3)\n";

  function stmts(program: Program, src: string): number[] {
    const ids: number[] = [];
    visit(program, (n, parent) => {
      if (n.kind === "expr" && parent === null &&
          src.slice(n.span.start).startsWith("circle")) ids.push(n.id);
    });
    return ids;
  }

  it("rolls three circles into a loop, byte-identically", () => {
    const program = parse(three);
    const r = repeatThis(three, program, stmts(program, three));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.source).toContain("repeat 3 as i:");
    expect(r.source).toContain("center: (40 + (i - 1) * 50, 120)");
    expect(r.source).toContain("radius: 15");
    samePicture(three, r.source);
  });

  it("declines uneven spacing with the actual numbers, no jargon", () => {
    const uneven = three.replace("(140, 120)", "(150, 120)");
    const program = parse(uneven);
    const r = repeatThis(uneven, program, stmts(program, uneven));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/50/);
    expect(r.reason).toMatch(/60/);
    for (const re of JARGON) expect(re.test(r.reason), re.source).toBe(false);
  });

  it("declines a color mismatch by naming it", () => {
    const off = three.replace("#7A4EA3, fill", "#7A4EA3").replace(
      "circle(center: (140, 120), radius: 15, fill: #7A4EA3)",
      "circle(center: (140, 120), radius: 15, fill: #112233)");
    const program = parse(off);
    const r = repeatThis(off, program, stmts(program, off));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/fill|color/i);
  });

  it("suggests maximal runs", () => {
    const program = parse(three);
    const runs = findRepeatRuns(program);
    expect(runs.length).toBe(1);
    expect(runs[0]!.count).toBe(3);
  });
});

describe("teachThis + openThisUp (P5-T4/T5, D54/D55)", () => {
  const twoShapes = P +
    "rect(left: 60, top: 180, width: 48, height: 40, fill: #C46A3D)\n" +
    "triangle(a: (60, 180), b: (108, 180), c: (84, 150), fill: #8A3324)\n";

  it("teaches a house: anchored params, bind = p, picture unchanged", () => {
    const program = parse(twoShapes);
    const ids = [stmtAt(program, twoShapes, "rect("), stmtAt(program, twoShapes, "triangle(")];
    const r = teachThis(twoShapes, program, ids, "hut");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.source).toContain("to hut(at: p):");
    expect(r.source).toContain("hut(at: (60, 180))");
    expect(r.source).toContain("(p.x + 48, p.y)");     // b corner, dy 0 folded
    expect(r.source).toContain("(p.x + 24, p.y - 30)"); // c corner
    const def = parse(r.source).defs.get("hut")!;
    expect(def.params[0]!.bind).toBe("p");              // D37 pays off
    samePicture(twoShapes, r.source);
  });

  it("round trip: open(teach(x)) draws byte-identically to x", () => {
    const program = parse(twoShapes);
    const ids = [stmtAt(program, twoShapes, "rect("), stmtAt(program, twoShapes, "triangle(")];
    const taught = teachThis(twoShapes, program, ids, "hut");
    expect(taught.ok).toBe(true);
    if (!taught.ok) return;
    const p2 = parse(taught.source);
    const call = stmtAt(p2, taught.source, "hut(at:");
    const opened = openThisUp(taught.source, p2, call);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.source).not.toContain("p.x");         // members folded
    samePicture(twoShapes, opened.source);
  });

  it("open declines rich arguments in learner words", () => {
    const src = readFileSync("examples/house-row.chalk", "utf8");
    const program = parse(src);
    const call = stmtAt(program, src, "house(at:");
    const r = openThisUp(src, program, call);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    for (const re of JARGON) expect(re.test(r.reason), re.source).toBe(false);
  });
});

describe("Gate AB — untouched statements keep their ids", () => {
  it("naming a number never reshuffles unrelated rows", () => {
    const src = readFileSync("examples/bouncing-ball.chalk", "utf8");
    const program = parse(src);
    const r = nameThisNumber(src, program, litAt(program, src, "radius: 20"), "size");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const t = new IdTracker();
    const r0 = t.advance(parse(src));
    const r1 = t.advance(parse(r.source));
    // the y-clamp lines are untouched: their stable ids must survive
    const clampPrev = stmtOf(parse(src), src, "y = 220");
    const clampNext = stmtOf(parse(r.source), r.source, "y = 220");
    expect(r1.stableOf.get(clampNext)).toBe(r0.stableOf.get(clampPrev));
  });

  function stmtOf(program: Program, src: string, needle: string): number {
    const hit = [...pathAt(program, src.indexOf(needle))].reverse()
      .find((n) => n.kind === "assign");
    expect(hit, needle).toBeTruthy();
    return hit!.id;
  }
});
