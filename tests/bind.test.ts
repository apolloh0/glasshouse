// P4a-T1 (D37, closes D30) — the parser populates `bind` with the internal
// binding name; `span` keeps pointing at the binding token. Added under the
// adding-tests-is-allowed ruling.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "../src/lang/parser.js";

describe("Definition.params.bind (P4a-T1)", () => {
  it("carries the internal binding names for house-row", () => {
    const src = readFileSync("examples/house-row.chalk", "utf8");
    const house = parse(src).defs.get("house")!;
    expect(house.params.map((p) => p.name)).toEqual(["at", "height"]);
    expect(house.params.map((p) => p.bind)).toEqual(["base", "h"]);
    // span still points at the binding token (D30-era readers)
    for (const p of house.params) {
      expect(src.slice(p.span.start, p.span.end)).toBe(p.bind);
    }
  });
});
