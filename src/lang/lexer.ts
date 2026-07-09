import type { Span } from "./ast.js";
import { KEYWORDS, type Token, type TokenKind } from "./tokens.js";
import { err } from "./diagnostics.js";

/**
 * T1 — Tokenize Chalk source.
 * Requirements (tested in tests/parser.test.ts, describe("lexer")):
 *  - INDENT/DEDENT synthesized from leading spaces; blank/comment-only lines
 *    do not affect indentation; tabs -> ChalkError ("use spaces, not tabs").
 *  - `//` comments skipped; `#RRGGBB` -> color token (value packed, D9);
 *    `30°` / `30deg` -> angle token; numbers may have a decimal part.
 *  - Every token carries an accurate Span (offset, line, col).
 *  - Ends with matching dedents then a single eof token.
 *
 * Inside parentheses, newlines and indentation are ignored (implicit line
 * joining), so calls may wrap across lines as in house-row.chalk.
 */

const KEYWORD_SET: ReadonlySet<string> = new Set(KEYWORDS);

const isDigit = (c: string): boolean => c >= "0" && c <= "9";
const isNameStart = (c: string): boolean =>
  (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
const isNamePart = (c: string): boolean => isNameStart(c) || isDigit(c);
const isHex = (c: string): boolean =>
  isDigit(c) || (c >= "a" && c <= "f") || (c >= "A" && c <= "F");

export function lex(source: string): Token[] {
  const tokens: Token[] = [];
  const indents: number[] = [0];
  let i = 0;
  let line = 1;
  let lineStart = 0; // offset of the current line's first character
  let parenDepth = 0;
  let atLineStart = true;

  const spanAt = (start: number, end: number): Span =>
    ({ start, end, line, col: start - lineStart + 1 });

  const push = (
    kind: TokenKind, start: number, end: number,
    text = "", value = 0, strValue = "",
  ): void => {
    tokens.push({ kind, text, value, strValue, span: spanAt(start, end) });
  };

  const n = source.length;
  while (i <= n) {
    // ---- start of a physical line: measure indentation (outside parens) ----
    if (atLineStart && parenDepth === 0) {
      const indentStart = i;
      while (i < n && source[i] === " ") i++;
      if (source[i] === "\t") {
        throw err("This line is indented with a tab — use spaces, not tabs.",
          spanAt(i, i + 1));
      }
      const rest = source.slice(i, source.indexOf("\n", i) === -1 ? n : source.indexOf("\n", i));
      if (i >= n || source[i] === "\n" || rest.startsWith("//")) {
        // blank or comment-only line: no tokens, no indent effect
        while (i < n && source[i] !== "\n") i++;
        if (i < n) { i++; line++; lineStart = i; continue; }
        break; // end of source
      }
      const width = i - indentStart;
      const top = indents[indents.length - 1]!;
      if (width > top) {
        indents.push(width);
        push("indent", indentStart, i);
      } else if (width < top) {
        while (width < indents[indents.length - 1]!) {
          indents.pop();
          push("dedent", indentStart, i);
        }
        if (width !== indents[indents.length - 1]!) {
          throw err("This line's indentation doesn't line up with any line above it.",
            spanAt(indentStart, i === indentStart ? i + 1 : i));
        }
      }
      atLineStart = false;
      continue;
    }

    if (i >= n) break;
    const c = source[i]!;
    if (c !== "\n") atLineStart = false; // a continuation line is underway

    // ---- newline ----
    if (c === "\n") {
      if (parenDepth === 0) push("newline", i, i + 1);
      i++; line++; lineStart = i; atLineStart = true;
      continue;
    }

    // ---- spaces between tokens ----
    if (c === " " || c === "\r") { i++; continue; }
    if (c === "\t") {
      throw err("There's a tab here — use spaces, not tabs.", spanAt(i, i + 1));
    }

    // ---- comments ----
    if (c === "/" && source[i + 1] === "/") {
      while (i < n && source[i] !== "\n") i++;
      continue;
    }

    // ---- numbers (and angle literals) ----
    if (isDigit(c)) {
      const start = i;
      while (i < n && isDigit(source[i]!)) i++;
      if (source[i] === "." && isDigit(source[i + 1] ?? "")) {
        i++;
        while (i < n && isDigit(source[i]!)) i++;
      }
      const value = Number(source.slice(start, i));
      if (source[i] === "°") {
        i++;
        push("angle", start, i, source.slice(start, i), value);
      } else if (
        source.slice(i, i + 3) === "deg" && !isNamePart(source[i + 3] ?? "")
      ) {
        i += 3;
        push("angle", start, i, source.slice(start, i), value);
      } else {
        push("number", start, i, source.slice(start, i), value);
      }
      continue;
    }

    // ---- color literals ----
    if (c === "#") {
      const start = i;
      i++;
      let hex = "";
      while (i < n && isHex(source[i]!)) { hex += source[i]!; i++; }
      if (hex.length !== 6) {
        throw err("Colors look like #RRGGBB — six characters from 0-9 and A-F after the #.",
          spanAt(start, i > start + 1 ? i : start + 1));
      }
      push("color", start, i, source.slice(start, i), parseInt(hex, 16));
      continue;
    }

    // ---- strings ----
    if (c === '"') {
      const start = i;
      i++;
      let s = "";
      while (i < n && source[i] !== '"' && source[i] !== "\n") { s += source[i]!; i++; }
      if (source[i] !== '"') {
        throw err('This text needs a closing quote (") before the end of the line.',
          spanAt(start, i));
      }
      i++;
      push("string", start, i, source.slice(start, i), 0, s);
      continue;
    }

    // ---- names and keywords ----
    if (isNameStart(c)) {
      const start = i;
      while (i < n && isNamePart(source[i]!)) i++;
      const text = source.slice(start, i);
      push(KEYWORD_SET.has(text) ? "keyword" : "name", start, i, text);
      continue;
    }

    // ---- operators and punctuation ----
    const two = source.slice(i, i + 2);
    if (two === "<=" || two === ">=" || two === "==" || two === "!=") {
      push("op", i, i + 2, two);
      i += 2;
      continue;
    }
    if ("+-*/<>=.,():".includes(c)) {
      if (c === "(") parenDepth++;
      if (c === ")") parenDepth = Math.max(0, parenDepth - 1);
      push("op", i, i + 1, c);
      i++;
      continue;
    }

    throw err("I don't recognize `" + c + "` here.", spanAt(i, i + 1));
  }

  // ---- close the file: final newline (if a line is open), dedents, eof ----
  const endSpan: Span = { start: n, end: n, line, col: Math.max(1, n - lineStart + 1) };
  if (!atLineStart && tokens.length > 0 && tokens[tokens.length - 1]!.kind !== "newline") {
    tokens.push({ kind: "newline", text: "", value: 0, strValue: "", span: endSpan });
  }
  while (indents.length > 1) {
    indents.pop();
    tokens.push({ kind: "dedent", text: "", value: 0, strValue: "", span: endSpan });
  }
  tokens.push({ kind: "eof", text: "", value: 0, strValue: "", span: endSpan });
  return tokens;
}
