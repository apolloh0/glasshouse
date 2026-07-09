// CONTRACT — token vocabulary for the T1 lexer.
import type { Span } from "./ast.js";

export type TokenKind =
  | "name" | "keyword"            // keywords listed in KEYWORDS
  | "number" | "string" | "color" // color value pre-packed to 0xRRGGBB
  | "angle"                       // `30°` / `30deg` -> value in degrees
  | "op"                          // + - * / < > <= >= == != = . , ( ) :
  | "newline" | "indent" | "dedent"
  | "eof";

export const KEYWORDS = [
  "state", "to", "end", "every", "frame", "when", "pointer", "key",
  "pressed", "released", "moved", "repeat", "as", "for", "from", "to",
  "step", "if", "else", "return", "and", "or", "not", "true", "false",
] as const;

export interface Token {
  kind: TokenKind;
  text: string;      // raw slice (for op/name/keyword); "" for synthetic
  value: number;     // number/angle/color payload; 0 otherwise
  strValue: string;  // string literal payload; "" otherwise
  span: Span;
}
