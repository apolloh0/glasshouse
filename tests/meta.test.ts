// P1-T1 — the vocabulary registry. Coverage is derived from the stdlib and
// the keyword list, so adding a builtin without a card fails HERE, on
// purpose, before any UI work.
import { describe, expect, it } from "vitest";
import { CARDS, cardFor, requiredCardKeys } from "../src/meta/cards.js";

/** Words that mean nothing to a person who has never programmed. Cards and
 *  diagnostics must speak learner, not compiler. Extend freely; never trim
 *  to make a card pass — reword the card. */
export const JARGON = [
  /\btokens?\b/i, /\bEOF\b/, /\bidentifiers?\b/i, /\bexpressions?\b/i,
  /\bstatements?\b/i, /\bsyntax\b/i, /\bparse[rd]?\b/i, /\bparsing\b/i,
  /\bnull\b/i, /\bundefined\b/i, /\bNaN\b/, /\boperands?\b/i,
  /\blvalue\b/i, /\bliterals?\b/i, /\bdelimiters?\b/i, /\bscopes?\b/i,
];

describe("vocabulary registry (P1-T1)", () => {
  it("covers every required key", () => {
    const missing = requiredCardKeys().filter((k) => !cardFor(k));
    expect(missing, "cards missing for: " + missing.join(", ")).toEqual([]);
  });

  it("has no orphan cards (keys nothing can ask for)", () => {
    const required = new Set(requiredCardKeys());
    for (const key of CARDS.keys()) {
      expect(required.has(key), key + " is not a required key").toBe(true);
    }
  });

  it("keeps every card short, keyed, and titled", () => {
    for (const [key, card] of CARDS) {
      expect(card.key).toBe(key);
      expect(card.title.length).toBeGreaterThan(0);
      expect(card.title.split(/\s+/).length).toBeLessThanOrEqual(4);
      expect(card.oneLiner.length,
        key + " oneLiner over 90 chars").toBeLessThanOrEqual(90);
    }
  });

  it("speaks learner, not compiler (jargon ban)", () => {
    for (const [key, card] of CARDS) {
      const text = [card.title, card.oneLiner, card.detail ?? ""].join(" ");
      for (const re of JARGON) {
        expect(re.test(text), key + " uses banned word " + re.source).toBe(false);
      }
    }
  });

  it("gives examples that at least LOOK like Chalk (labels, no positional args)", () => {
    for (const [key, card] of CARDS) {
      if (!card.example) continue;
      // every open paren with content must contain a label `name:`
      for (const m of card.example.matchAll(/\(([^)]+)\)/g)) {
        const inner = m[1]!;
        if (/^[\s]*$/.test(inner)) continue;
        // point literals like (160, 120) are values, not calls — allow if
        // it is all numbers/idents/operators
        if (/^[\w\s+\-*/.,°]+$/.test(inner)) continue;
        expect(/[a-z_]+\s*:/.test(inner),
          key + " example has an unlabeled call: (" + inner + ")").toBe(true);
      }
    }
  });
});
