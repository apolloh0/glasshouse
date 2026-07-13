// P1-T2 — the Lezer grammar. Presentation-only (D11/D12), but it must be
// TRUE: real token boundaries, zero error nodes on valid programs, graceful
// trees on broken ones.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { SyntaxNode } from "@lezer/common";
import { parser } from "../src/editor/gen/chalk-parser.js";
import { lex } from "../src/lang/lexer.js";

const ex = (name: string): string => readFileSync("examples/" + name, "utf8");
const EXAMPLES = ["bouncing-ball.chalk", "house-row.chalk", "pointer-paint.chalk", "scale-spiral.chalk", "pinwheel.chalk", "five-houses.chalk"];

function collectNodes(source: string): SyntaxNode[] {
  const out: SyntaxNode[] = [];
  const cursor = parser.parse(source).cursor();
  do { out.push(cursor.node); } while (cursor.next());
  return out;
}

describe("lezer grammar (P1-T2)", () => {
  it("parses every example with zero error nodes", () => {
    for (const name of EXAMPLES) {
      const bad = collectNodes(ex(name)).filter((n) => n.type.isError);
      expect(bad.length, name + " has error nodes at " +
        bad.map((n) => n.from).join(",")).toBe(0);
    }
  });

  it("is tolerant: broken input still yields a full-coverage tree", () => {
    for (const source of [
      "to house((((",
      "circle(radius: \nrepeat",
      "state = = =\n\tweird tabs",
      "#GGGGGG ° 5..2",
    ]) {
      const tree = parser.parse(source); // must not throw
      expect(tree.length).toBe(source.length);
    }
  });

  it("agrees with the hand lexer on number/color/angle/string token spans", () => {
    // The drift guard: for every value token the SEMANTIC lexer produces,
    // the PRESENTATION grammar must have a leaf with the same span and a
    // matching node name. (Name mapping is the grammar's contract.)
    const nameFor: Record<string, string> = {
      number: "Number", color: "Color", angle: "Angle", string: "String",
    };
    for (const name of EXAMPLES) {
      const source = ex(name);
      const leaves = collectNodes(source).filter((n) => !n.firstChild);
      for (const tok of lex(source)) {
        const want = nameFor[tok.kind];
        if (!want) continue;
        const hit = leaves.find(
          (n) => n.from === tok.span.start && n.to === tok.span.end && n.name === want,
        );
        expect(hit, name + ": hand lexer sees " + tok.kind + " at " +
          tok.span.start + ".." + tok.span.end +
          "; grammar has no matching " + want + " leaf").toBeTruthy();
      }
    }
  });

  it("marks keywords as keywords (spot check)", () => {
    const source = ex("bouncing-ball.chalk");
    const leaves = collectNodes(source).filter((n) => !n.firstChild);
    const stateAt = source.indexOf("state y");
    const hit = leaves.find((n) => n.from === stateAt && n.name === "Keyword");
    expect(hit, "`state` should lex as a Keyword node").toBeTruthy();

    // Phase 4a: `group` joined KEYWORDS (D36) — the grammar must agree.
    const pin = ex("pinwheel.chalk");
    const pinLeaves = collectNodes(pin).filter((n) => !n.firstChild);
    const groupAt = pin.indexOf("group(");
    const ghit = pinLeaves.find((n) => n.from === groupAt && n.name === "Keyword");
    expect(ghit, "`group` should lex as a Keyword node").toBeTruthy();
  });
});
