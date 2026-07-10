// CONTRACT + P4a-T5 stub — the parts palette model (plan §4.4): every
// drawable thing as a picture you can drag in. PURE; the studio renders
// thumbnails via previewFor + thumbnailFit and owns drag-insert.
//
// RULES (P4a-T5, D38):
//   Entries: every "draw" builtin (stdlib order), then every user
//   definition in source order. Each carries:
//     insert         — the same full default-args statement completionsAt
//                      would offer (ONE source of default text: reuse it);
//     previewSource  — a minimal standalone program whose display IS the
//                      thumbnail: "paper(color: #FFFFFF)\n" + insert + "\n"
//                      for builtins; user defs prepend their `to...end`
//                      source text (sliced by span) so the call resolves.
//   paper and value builtins (random) are NOT palette entries — the
//   palette is things you can SEE.

import type { Program } from "../lang/ast.js";
import { TODO } from "../util/todo.js";

export interface PaletteEntry {
  name: string;
  kind: "builtin" | "definition";
  insert: string;
  previewSource: string;
}

export function paletteEntries(program: Program | null, source: string): PaletteEntry[] {
  void program; void source;
  TODO("P4a-T5", "draw builtins + user defs per header");
}
