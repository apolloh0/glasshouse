// P1-T7 — editor integration at the EditorState level. Deliberately no
// EditorView anywhere in the suite: state + language machinery are DOM-free,
// which keeps `npm test` runnable in plain Node forever. Anything that needs
// a real view belongs in the manual script (phase1-spec §6).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { EditorState } from "@codemirror/state";
import { ensureSyntaxTree } from "@codemirror/language";
import { chalk, chalkLanguage } from "../src/editor/chalkLanguage.js";

const src = readFileSync("examples/house-row.chalk", "utf8");

describe("chalk language support (P1-T7)", () => {
  it("builds an EditorState and a full syntax tree", () => {
    const state = EditorState.create({ doc: src, extensions: [chalk()] });
    const tree = ensureSyntaxTree(state, src.length, 5000);
    expect(tree).not.toBeNull();
    expect(tree!.length).toBe(src.length);
  });

  it("names the language", () => {
    expect(chalkLanguage.name).toBe("chalk");
  });
});
