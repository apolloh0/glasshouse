// P4a-T4 — completions and previews. The circle insert is pinned exactly
// (defaults render via showValue: the vocabulary is its own syntax); the
// isolation test is the load-bearing one — previews must never disturb a
// live session.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "../src/lang/parser.js";
import { Session } from "../src/host/run.js";
import { serializeDisplayList } from "../src/render/displayList.js";
import { completionsAt, previewFor } from "../src/ui/complete.js";
import { BUILTINS } from "../src/engine/stdlib.js";

const P = "paper(color: #FFFFFF)\n";

describe("completionsAt (P4a-T4)", () => {
  it("offers every draw builtin, paper, and the construct templates at a blank line", () => {
    const comps = completionsAt(null, "", 0);
    const labels = comps.map((c) => c.label);
    for (const [name, spec] of BUILTINS) {
      if (spec.kind === "draw" || spec.kind === "paper") expect(labels).toContain(name);
    }
    expect(labels).toContain("repeat");
    expect(labels).toContain("group");
    expect(labels).not.toContain("random"); // value builtins are not statements
  });

  it("pins the circle insert exactly (stdlib defaults via showValue)", () => {
    const circle = completionsAt(null, "", 0).find((c) => c.label === "circle")!;
    expect(circle.kind).toBe("builtin");
    expect(circle.insert).toBe("circle(center: (160, 120), radius: 40, fill: #888888)");
  });

  it("filters by the word prefix under the cursor", () => {
    const comps = completionsAt(null, "ci", 2);
    expect(comps.length).toBe(1);
    expect(comps[0]!.label).toBe("circle");
  });

  it("offers user definitions with zeroed args", () => {
    const src = readFileSync("examples/house-row.chalk", "utf8");
    const house = completionsAt(parse(src), src + "hou", src.length + 3)
      .find((c) => c.label === "house")!;
    expect(house.kind).toBe("definition");
    expect(house.insert).toBe("house(at: 0, height: 0)");
  });
});

describe("previewFor (P4a-T4)", () => {
  it("previews every draw builtin's default statement with one op, no error", () => {
    for (const c of completionsAt(null, "", 0)) {
      if (c.kind !== "builtin" || c.label === "paper") continue;
      const p = previewFor(P + c.insert + "\n", 42);
      expect(p.ok, c.label).toBe(true);
      if (p.ok) expect(p.display.ops.length).toBe(1);
    }
  });

  it("paper previews as a background, zero ops", () => {
    const p = previewFor("paper(color: #112233)\n", 42);
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.display.ops.length).toBe(0);
      expect(p.display.bg).toBe(0x112233);
    }
  });

  it("runs exactly one frame for animated programs", () => {
    const src = readFileSync("examples/bouncing-ball.chalk", "utf8");
    const p = previewFor(src, 42);
    expect(p.ok).toBe(true);
    if (p.ok) {
      const session = new Session(src, 42);
      expect(serializeDisplayList(p.display))
        .toBe(serializeDisplayList(session.displayAt(0)));
    }
  });

  it("returns broken sources as friendly diagnostics, never throws", () => {
    const p = previewFor(P + "circle(radius: #FF0000)\n", 42);
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.error.message).toMatch(/radius/);
  });

  it("NEVER disturbs a live session (the isolation pin)", () => {
    const src = readFileSync("examples/bouncing-ball.chalk", "utf8");
    const interrupted = new Session(src, 42);
    interrupted.advanceFrames(5);
    previewFor(src, 42);
    previewFor(P + "circle(radius: 40)\n", 7);
    interrupted.advanceFrames(5);

    const straight = new Session(src, 42);
    straight.advanceFrames(10);
    expect(serializeDisplayList(interrupted.displayAt(9)))
      .toBe(serializeDisplayList(straight.displayAt(9)));
  });

  it("is deterministic", () => {
    const src = P + "circle(radius: 40)\n";
    const a = previewFor(src, 42);
    const b = previewFor(src, 42);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(serializeDisplayList(a.display)).toBe(serializeDisplayList(b.display));
    }
  });
});
