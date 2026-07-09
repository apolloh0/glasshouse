// The Chalk language support for CodeMirror. This file WORKS today against
// the seed grammar; P1-T2 replaces the grammar and extends styleTags to the
// full token set (keywords, labels, colors, angles, strings).
//
// LAYERING (decision D11): the Lezer tree is PRESENTATION ONLY — it drives
// syntax highlighting and token lookup in the editor. The hand-rolled parser
// (src/lang) remains the single semantic source of truth; nothing in
// src/engine may ever see a Lezer tree. tests/lezer.test.ts guards drift
// between the two on the token level.

import { LRLanguage, LanguageSupport } from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";
import { parser } from "./gen/chalk-parser.js";

export const chalkLanguage = LRLanguage.define({
  name: "chalk",
  parser: parser.configure({
    props: [
      styleTags({
        // P1-T2: extend to Keyword, Label, Color, Angle, String, BuiltinName.
        Number: t.number,
        Identifier: t.variableName,
      }),
    ],
  }),
});

export function chalk(): LanguageSupport {
  return new LanguageSupport(chalkLanguage);
}
