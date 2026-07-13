// P1-T3 — hover resolution. The tables here are the ground truth for the
// rules in src/ui/hover.ts. Gate E (the automated hallway proxy) lives at
// the bottom: EVERY call-argument literal in EVERY example must explain
// itself.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "../src/lang/parser.js";
import { labelAt } from "../src/ui/hover.js";
import { pathAt, visit } from "../src/lang/walk.js";
import type { Program } from "../src/lang/ast.js";

const ex = (name: string): string => readFileSync("examples/" + name, "utf8");
const EXAMPLES = ["bouncing-ball.chalk", "house-row.chalk", "pointer-paint.chalk", "scale-spiral.chalk", "pinwheel.chalk", "five-houses.chalk"];

function at(source: string, needle: string, delta = 1): number {
  const i = source.indexOf(needle);
  expect(i, "test needle not found: " + needle).toBeGreaterThanOrEqual(0);
  return i + delta;
}

describe("hover resolution (P1-T3)", () => {
  it("resolves builtin argument labels to param cards", () => {
    const src = ex("house-row.chalk");
    const r = labelAt(parse(src), at(src, "width: h * 1.2"));
    expect(r).not.toBeNull();
    expect(r!.card.key).toBe("param:rect.width");
    expect(r!.context).toMatch(/rect/);
  });

  it("resolves user-definition argument labels to synthesized param cards", () => {
    const src = ex("house-row.chalk");
    const r = labelAt(parse(src), at(src, "height: 40"));
    expect(r).not.toBeNull();
    expect(r!.card.key).toBe("param:house.height");
    expect(r!.context).toMatch(/house/);
  });

  it("resolves a literal to the param it feeds, carrying the literal node", () => {
    const src = ex("bouncing-ball.chalk");
    const r = labelAt(parse(src), at(src, "radius: 20", "radius: ".length));
    expect(r).not.toBeNull();
    expect(r!.card.key).toBe("param:circle.radius");
    expect(r!.literal?.kind).toBe("number");
  });

  it("resolves a literal nested in arithmetic to the NEAREST enclosing call's param", () => {
    const src = ex("house-row.chalk");
    // the `0` inside random(from: 0, ...) — nearest call is random, not house
    const r = labelAt(parse(src), at(src, "from: 0", "from: ".length));
    expect(r).not.toBeNull();
    expect(r!.card.key).toBe("param:random.from");
  });

  it("resolves callee names to builtin cards", () => {
    const src = ex("bouncing-ball.chalk");
    const r = labelAt(parse(src), at(src, "circle(center"));
    expect(r).not.toBeNull();
    expect(r!.card.key).toBe("builtin:circle");
  });

  it("resolves keywords to construct cards", () => {
    const src = ex("house-row.chalk");
    const r = labelAt(parse(src), at(src, "repeat 5"));
    expect(r).not.toBeNull();
    expect(r!.card.key).toBe("construct:repeat");
  });

  it("explains state variable references", () => {
    const src = ex("bouncing-ball.chalk");
    const r = labelAt(parse(src), at(src, "speed = speed + 0.5"));
    expect(r).not.toBeNull();
    expect(r!.card.title).toBe("speed");
    // the card must say where it came from in learner terms
    expect(r!.card.oneLiner + (r!.card.detail ?? "")).toMatch(/remember|between frames|starts at/i);
  });

  it("returns null between items instead of guessing", () => {
    const src = ex("house-row.chalk");
    const blank = src.indexOf("\n\n") + 1;
    expect(labelAt(parse(src), blank)).toBeNull();
  });
});

describe("Gate E — every call-argument literal explains itself", () => {
  function callArgLiterals(program: Program): number[] {
    // offsets (span midpoints) of number/color/angle literals that sit
    // anywhere inside a call's argument value
    const offsets: number[] = [];
    visit(program, (n) => {
      if (n.kind !== "number" && n.kind !== "color" && n.kind !== "angle") return;
      const path = pathAt(program, n.span.start);
      if (path.some((p) => p.kind === "call")) offsets.push(n.span.start);
    });
    return offsets;
  }

  for (const name of EXAMPLES) {
    it(name, () => {
      const program = parse(ex(name));
      const offsets = callArgLiterals(program);
      expect(offsets.length).toBeGreaterThan(0); // the sweep must sweep
      for (const off of offsets) {
        const r = labelAt(program, off);
        expect(r, "no card at offset " + off).not.toBeNull();
        expect(r!.card.key.startsWith("param:"),
          "offset " + off + " resolved to " + r!.card.key +
          " — a call-argument literal must resolve to its parameter").toBe(true);
      }
    });
  }
});
