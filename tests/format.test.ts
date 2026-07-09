// P3-T1 — the ONE textual form of every value. Pure; exact strings.
import { describe, expect, it } from "vitest";
import { showValue } from "../src/ui/format.js";

describe("showValue (P3-T1)", () => {
  it("numbers reuse fmtNum", () => {
    expect(showValue({ t: "num", v: 12 })).toBe("12");
    expect(showValue({ t: "num", v: 12.5 })).toBe("12.50");
    expect(showValue({ t: "num", v: -0 })).toBe("0");
  });

  it("points, colors, angles, bools, strings", () => {
    expect(showValue({ t: "point", x: 60, y: 80 })).toBe("(60, 80)");
    expect(showValue({ t: "point", x: 12.5, y: 0 })).toBe("(12.50, 0)");
    expect(showValue({ t: "color", rgb: 0x2a76c6 })).toBe("#2A76C6");
    expect(showValue({ t: "color", rgb: 0x000011 })).toBe("#000011"); // 6 digits always
    expect(showValue({ t: "angle", deg: 45 })).toBe("45°");
    expect(showValue({ t: "bool", v: true })).toBe("true");
    expect(showValue({ t: "str", v: "hi" })).toBe("\"hi\"");
  });
});
