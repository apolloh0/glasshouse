// P1-T6 — plain-language diagnostics, end to end: broken source in,
// ONE sentence a beginner can act on out. The corpus below is the wording
// contract; JARGON (shared with the card tests) is the vocabulary police.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { diagnosticsFor } from "../src/ui/diagnose.js";
import { JARGON } from "./meta.test.js";

interface Case { name: string; src: string; expect: RegExp }

const CORPUS: Case[] = [
  { name: "missing label",
    src: "circle(20)",
    expect: /label|name/i },
  { name: "unknown label",
    src: "circle(radios: 20)",
    expect: /radios/ },
  { name: "type mismatch",
    src: "circle(radius: #FF0000)",
    expect: /radius:.*number.*color/is },
  { name: "unknown function",
    src: "circl(radius: 20)",
    expect: /circl/ },
  { name: "assignment at top level",
    src: "x = 5",
    expect: /every frame|when/i },
  { name: "state inside a frame block",
    src: "every frame:\n  state y = 4",
    expect: /state.*top|top.*state/is },
  { name: "tab indentation",
    src: "every frame:\n\tcircle(radius: 4)",
    expect: /tab/i },
  { name: "unclosed parenthesis",
    src: "circle(radius: 20",
    expect: /\)|close|finish/i },
  { name: "pointer during setup",
    src: "circle(center: (pointer.x, 10))",
    expect: /pointer/i },
  { name: "unfinished block",
    src: "repeat 5 as i:",
    expect: /repeat|inside|indent/i },
];

describe("diagnosticsFor (P1-T6)", () => {
  it("stays quiet on every example program", () => {
    for (const name of ["bouncing-ball", "house-row", "pointer-paint"]) {
      const src = readFileSync("examples/" + name + ".chalk", "utf8");
      expect(diagnosticsFor(src), name).toEqual([]);
    }
  });

  for (const c of CORPUS) {
    it("explains: " + c.name, () => {
      const ds = diagnosticsFor(c.src);
      expect(ds.length, "exactly one problem at a time (D15)").toBe(1);
      const d = ds[0]!;
      expect(d.message).toMatch(c.expect);
      expect(d.span.start).toBeGreaterThanOrEqual(0);
      expect(d.span.end).toBeGreaterThan(d.span.start);
      expect(d.span.end).toBeLessThanOrEqual(c.src.length);
    });
  }

  it("never speaks compiler at a learner (jargon ban over the whole corpus)", () => {
    for (const c of CORPUS) {
      for (const d of diagnosticsFor(c.src)) {
        for (const re of JARGON) {
          expect(re.test(d.message),
            c.name + ": message uses banned word " + re.source +
            " — reword it (message was: " + d.message + ")").toBe(false);
        }
      }
    }
  });
});
