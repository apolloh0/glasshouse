// T3
import { describe, expect, it } from "vitest";
import { decodeValue, encodeValue, valueEquals, type Value } from "../src/engine/values.js";

const samples: Value[] = [
  { t: "num", v: 42.5 },
  { t: "bool", v: true },
  { t: "str", v: "hello" },
  { t: "color", rgb: 0x2a76c6 },
  { t: "point", x: 3, y: -7.25 },
  { t: "angle", deg: 30 },
];

describe("valueEquals", () => {
  it("is true for structurally equal values and false across kinds", () => {
    for (const v of samples) expect(valueEquals(v, structuredClone(v))).toBe(true);
    expect(valueEquals({ t: "num", v: 1 }, { t: "num", v: 2 })).toBe(false);
    expect(valueEquals({ t: "num", v: 1 }, { t: "angle", deg: 1 })).toBe(false);
    expect(valueEquals({ t: "point", x: 1, y: 2 }, { t: "point", x: 1, y: 3 })).toBe(false);
  });
});

describe("encodeValue / decodeValue", () => {
  it("round-trips every kind (and null) through the columnar encoding", () => {
    const table: string[] = [];
    const intern = (s: string): number => {
      const i = table.indexOf(s);
      if (i >= 0) return i;
      table.push(s);
      return table.length - 1;
    };
    const str = (i: number): string => table[i]!;
    for (const v of [...samples, null]) {
      const e = encodeValue(v, intern);
      const back = decodeValue(e.tag, e.a, e.b, e.strIdx, str);
      if (v === null) expect(back).toBeNull();
      else expect(valueEquals(back!, v)).toBe(true);
    }
  });
});
