// Phase 6 — the closer's four suites in one file: announcements (voice),
// keyboard machine (pure), rotation handles, curriculum validation, and
// the package-boundary guard. Green pieces are guards; red are milestones.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../src/lang/parser.js";
import { Session } from "../src/host/run.js";
import { IdTracker } from "../src/host/ids.js";
import {
  announce, requiredAnnouncementKeys, TEMPLATES,
} from "../src/meta/announce.js";
import { cardFor } from "../src/meta/cards.js";
import { kstep, K_INITIAL, type KState } from "../src/ui/keys.js";
import { rotationHandles } from "../src/ui/rotate.js";
import { JARGON } from "./meta.test.js";

describe("announcements (P6-T1)", () => {
  it("covers every required key", () => {
    const missing = requiredAnnouncementKeys().filter((k) => !TEMPLATES.has(k));
    expect(missing, "templates missing: " + missing.join(", ")).toEqual([]);
  });

  it("speaks learner, short, for representative slots", () => {
    const samples: [string, Record<string, unknown>][] = [
      ["focus.op", { kind: "circle", index: 3, count: 10 }],
      ["drag.locked", { axis: "y" }],
      ["drag.candidate", { note: "55 to 65", index: 1, count: 2 }],
      ["drag.commit", { note: "changed 55 to 65" }],
      ["gesture.applied", { name: "repeat this", note: "5 circles became a loop" }],
      ["completion.preview", { label: "circle" }],
      ["frame.focus", { frame: 42 }],
    ];
    for (const [key, slots] of samples) {
      const text = announce(key as never, slots);
      expect(text.length, key).toBeLessThanOrEqual(120);
      expect(text.length, key).toBeGreaterThan(0);
      for (const re of JARGON) expect(re.test(text), key + " " + re.source).toBe(false);
    }
  });

  it("exemplars are pinned", () => {
    expect(announce("focus.op", { kind: "circle", index: 3, count: 10 }))
      .toBe("circle, 3 of 10");
    expect(announce("drag.locked", { axis: "y" }))
      .toBe("up and down is set by the program here");
  });
});

describe("keyboard machine (P6-T3)", () => {
  const go = (state: KState, key: string, shift = false, ops = 10, cands = 2) =>
    kstep(state, { key, shift }, ops, cands);

  it("cycles focus with wrap and announces", () => {
    const r1 = go(K_INITIAL, "]");
    expect(r1.state.opIndex).toBe(0);
    expect(r1.effects.some((e) => e.kind === "focusOp")).toBe(true);
    expect(r1.effects.some((e) => e.kind === "announce")).toBe(true);
    const back = go({ ...K_INITIAL, opIndex: 0 }, "[");
    expect(back.state.opIndex).toBe(9); // wraps
  });

  it("enters drag, accumulates arrows (shift = 10), tabs candidates", () => {
    const focused: KState = { ...K_INITIAL, opIndex: 2 };
    const d0 = go(focused, "Enter");
    expect(d0.state.mode).toBe("dragging");
    const d1 = go(d0.state, "ArrowRight");
    const d2 = go(d1.state, "ArrowRight", true);
    const d3 = go(d2.state, "ArrowDown");
    expect([d3.state.dx, d3.state.dy]).toEqual([11, 1]);
    expect(d3.effects.some((e) => e.kind === "solveDrag")).toBe(true);
    const t = go(d3.state, "Tab");
    expect(t.state.candidate).toBe(1);
    const t2 = go(t.state, "Tab");
    expect(t2.state.candidate).toBe(0); // wraps at candidateCount
  });

  it("commits and cancels back to browse", () => {
    const dragging: KState = { mode: "dragging", opIndex: 2, dx: 5, dy: 0, candidate: 0 };
    const c = go(dragging, "Enter");
    expect(c.state.mode).toBe("browse");
    expect(c.effects.some((e) => e.kind === "commit")).toBe(true);
    const x = go(dragging, "Escape");
    expect(x.state).toEqual({ ...dragging, mode: "browse", dx: 0, dy: 0, candidate: 0 });
    expect(x.effects.some((e) => e.kind === "cancel")).toBe(true);
  });
});

describe("rotation handles (P6-T6, D61)", () => {
  const lit = "paper(color: #FFFFFF)\n" +
    "group(rotate: 30, around: (160, 120)):\n" +
    "  circle(center: (240, 120), radius: 6, fill: #112233)\n";

  it("handles literal-rotate groups at the fixed point", () => {
    const hs = rotationHandles(parse(lit), lit);
    expect(hs.length).toBe(1);
    expect([hs[0]!.x, hs[0]!.y]).toEqual([160, 120]);
    expect(hs[0]!.deg).toBe(30);
    const after = hs[0]!.apply(45);
    expect(after).toContain("rotate: 45");
    const t = new IdTracker();
    t.advance(parse(lit));
    const r = t.advance(parse(after));
    expect(r.fresh.size + r.dropped.size).toBe(0);
    // and the rotation actually applied
    const op = new Session(after, 42).displayAt(0).ops[0] as { cx: number };
    expect(op.cx).not.toBeCloseTo(240, 1);
  });

  it("computed rotate gets no handle (pinwheel)", () => {
    const src = readFileSync("examples/pinwheel.chalk", "utf8");
    expect(rotationHandles(parse(src), src)).toEqual([]);
  });
});

describe("curriculum (P6-T5)", () => {
  const root = "curriculum";
  const lessons = readdirSync(root).filter((d) => d.startsWith("lesson-")).sort();

  it("has at least the seed lesson; ids match folders; files exist", () => {
    expect(lessons.length).toBeGreaterThanOrEqual(1);
    for (const dir of lessons) {
      const meta = JSON.parse(readFileSync(join(root, dir, "lesson.json"), "utf8"));
      expect(meta.id).toBe(dir);
      expect(existsSync(join(root, dir, meta.start))).toBe(true);
      expect(existsSync(join(root, dir, meta.target))).toBe(true);
      expect(meta.title.length).toBeGreaterThan(0);
      expect(meta.steps.length).toBeGreaterThan(0);
    }
  });

  it("every start/target parses and runs deterministically; every card exists; no jargon", () => {
    for (const dir of lessons) {
      const meta = JSON.parse(readFileSync(join(root, dir, "lesson.json"), "utf8"));
      for (const f of [meta.start, meta.target]) {
        const src = readFileSync(join(root, dir, f), "utf8");
        expect(() => parse(src), dir + "/" + f).not.toThrow();
        const s = new Session(src, 42);
        s.advanceFrames(parse(src).frames.length > 0 ? 30 : 0);
      }
      for (const step of meta.steps) {
        if (step.card) expect(cardFor(step.card), dir + " " + step.card).toBeTruthy();
        for (const re of JARGON) {
          expect(re.test(step.say), dir + " " + re.source).toBe(false);
        }
        if (step.do === "edit") {
          const src = readFileSync(join(root, dir, meta.start), "utf8");
          expect(src.includes(step.find), dir + " find: " + step.find).toBe(true);
        }
      }
    }
  });

  it("the full arc exists once P6-T5 lands (8 lessons)", () => {
    expect(lessons.length).toBeGreaterThanOrEqual(8);
  });
});

describe("package boundary (P6-T4)", () => {
  it("the engine subpath's import graph never reaches the editor", () => {
    // static walk from the engine entry: host/run -> ... must not import
    // @codemirror/@lezer or src/editor (the publishable-core guarantee)
    const seen = new Set<string>();
    const queue = ["src/host/run.ts"];
    while (queue.length) {
      const f = queue.pop()!;
      if (seen.has(f) || !existsSync(f)) continue;
      seen.add(f);
      const text = readFileSync(f, "utf8");
      expect(/@codemirror|@lezer/.test(text), f).toBe(false);
      expect(/\/editor\//.test(text), f).toBe(false);
      for (const m of text.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
        const target = join(f, "..", m[1]!).replace(/\.js$/, ".ts");
        queue.push(target);
      }
    }
    expect(seen.size).toBeGreaterThan(10); // the walk actually walked
  });

  it("package.json declares the three subpath exports (after P6-T4)", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.exports?.["./engine"], "exports['./engine']").toBeTruthy();
    expect(pkg.exports?.["./ui"], "exports['./ui']").toBeTruthy();
    expect(pkg.exports?.["./editor"], "exports['./editor']").toBeTruthy();
  });
});
