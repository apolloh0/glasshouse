import type { Program } from "./ast.js";
import { TODO } from "../util/todo.js";

/**
 * T2 — Recursive-descent parser: Token[] -> Program (then assignNodeIds).
 * Parse-time rules (each is a ChalkError with learner wording — see tests):
 *  - every call argument must be labeled ("circle needs labels on its
 *    values — try circle(center: ..., radius: ..., fill: ...)");
 *  - `state` only at top level;
 *  - assignment only inside `every frame:` / `when ...:` bodies
 *    ("values can only change inside `every frame:` or `when ...:` blocks");
 *  - blocks are INDENT..DEDENT; `to` bodies end with `end`;
 *  - a lone `if cond: stmt` single-line form is allowed (see examples).
 * Populate Program.setup/defs/frames/events views and Program.source.
 */
export function parse(source: string): Program {
  void source;
  TODO("T2", "implement the parser");
}
