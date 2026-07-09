import type { Token } from "./tokens.js";
import { TODO } from "../util/todo.js";

/**
 * T1 — Tokenize Chalk source.
 * Requirements (tested in tests/parser.test.ts, describe("lexer")):
 *  - INDENT/DEDENT synthesized from leading spaces; blank/comment-only lines
 *    do not affect indentation; tabs -> ChalkError ("use spaces, not tabs").
 *  - `//` comments skipped; `#RRGGBB` -> color token (value packed, D9);
 *    `30°` / `30deg` -> angle token; numbers may have a decimal part.
 *  - Every token carries an accurate Span (offset, line, col).
 *  - Ends with matching dedents then a single eof token.
 */
export function lex(source: string): Token[] {
  void source;
  TODO("T1", "implement the lexer");
}
