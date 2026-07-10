// Gate R — create by reacting, end to end without a browser: pick a
// completion, see a preview, commit, grab the number, drag it. If this
// suite passes, the studio's Phase 4a work is wiring, not invention.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "../src/lang/parser.js";
import { IdTracker } from "../src/host/ids.js";
import { completionsAt, previewFor } from "../src/ui/complete.js";
import { paletteEntries } from "../src/ui/palette.js";
import { numberDragAt } from "../src/ui/drag.js";
import { thumbnailFit } from "../src/ui/glyphs.js";

const P = "paper(color: #FFFFFF)\n";

describe("Gate R — blank to adjusted shape, no browser", () => {
  it("complete -> preview -> commit -> drag -> bigger circle, same program identity", () => {
    // 1. the learner types "ci" on a blank line
    const typing = P + "ci";
    const comps = completionsAt(parse(P), typing, typing.length);
    expect(comps.length).toBe(1);
    const circle = comps[0]!;

    // 2. preview before committing
    const committed = P + circle.insert + "\n";
    const preview = previewFor(committed, 42);
    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(preview.display.ops.length).toBe(1);
      expect((preview.display.ops[0] as { r: number }).r).toBe(40);
    }

    // 3. grab the radius and drag it to 60
    const d = numberDragAt(parse(committed), committed, committed.indexOf("40"))!;
    const dragged = d.apply(60);
    const after = previewFor(dragged, 42);
    expect(after.ok).toBe(true);
    if (after.ok) expect((after.display.ops[0] as { r: number }).r).toBe(60);

    // 4. the drag changed a value, not the program
    const t = new IdTracker();
    t.advance(parse(committed));
    const r = t.advance(parse(dragged));
    expect(r.fresh.size + r.dropped.size).toBe(0);
  });

  it("palette entries are exact and all thumbnail-able", () => {
    const src = readFileSync("examples/house-row.chalk", "utf8");
    const entries = paletteEntries(parse(src), src);
    expect(entries.map((e) => e.name))
      .toEqual(["circle", "ellipse", "rect", "triangle", "line", "house"]);
    for (const e of entries) {
      const p = previewFor(e.previewSource, 42);
      expect(p.ok, e.name).toBe(true);
      if (p.ok) {
        expect(p.display.ops.length, e.name).toBeGreaterThanOrEqual(1);
        expect(thumbnailFit(p.display.ops, 24, 18, 2), e.name).not.toBeNull();
      }
    }
  });
});
