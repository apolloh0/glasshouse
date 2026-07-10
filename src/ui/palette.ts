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

import type { Definition, Program } from "../lang/ast.js";
import { children, type AnyNode } from "../lang/walk.js";
import { BUILTINS } from "../engine/stdlib.js";
import type { Value } from "../engine/values.js";
import { defaultStatementFor, FALLBACK_DEFAULTS } from "./complete.js";
import { showValue } from "./format.js";

export interface PaletteEntry {
  name: string;
  kind: "builtin" | "definition";
  insert: string;
  previewSource: string;
}

const WHITE_PAPER = "paper(color: #FFFFFF)\n";

export function paletteEntries(program: Program | null, source: string): PaletteEntry[] {
  const out: PaletteEntry[] = [];
  for (const [name, spec] of BUILTINS) {
    if (spec.kind !== "draw") continue; // the palette is things you can SEE
    const insert = defaultStatementFor(name)!;
    out.push({ name, kind: "builtin", insert, previewSource: WHITE_PAPER + insert + "\n" });
  }
  if (program) {
    for (const item of program.items) {
      if (item.kind !== "to") continue;
      // insert = the same zeroed text completionsAt offers (one source of
      // default text, D38). The PREVIEW call differs: its display IS the
      // thumbnail, so args get renderable fallbacks with point-vs-number
      // inferred from how the definition's body uses each binding.
      const insert = item.name + "(" + item.params.map((p) => p.name + ": 0").join(", ") + ")";
      const previewCall = item.name + "(" +
        item.params.map((p) => p.name + ": " + showValue(previewDefault(item, p.bind))).join(", ") + ")";
      const defText = source.slice(item.span.start, item.span.end);
      out.push({
        name: item.name,
        kind: "definition",
        insert,
        previewSource: WHITE_PAPER + defText + "\n" + previewCall + "\n",
      });
    }
  }
  return out;
}

/** A binding is point-shaped iff the body reads a part of it (`base.x`). */
function previewDefault(def: Definition, bind: string | undefined): Value {
  if (bind !== undefined && subtreeHasMemberOn(def, bind)) return FALLBACK_DEFAULTS.point;
  return FALLBACK_DEFAULTS.num;
}

function subtreeHasMemberOn(root: AnyNode, name: string): boolean {
  const stack: AnyNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.kind === "member" && node.object.kind === "name" && node.object.name === name) {
      return true;
    }
    stack.push(...children(node));
  }
  return false;
}
