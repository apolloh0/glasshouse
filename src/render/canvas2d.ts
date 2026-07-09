// T11 — Canvas2D backend. Kept out of all tests (D2): display-list equality
// is the definition of output; this file only exists for human eyes.
import { STAGE_HEIGHT, STAGE_WIDTH, type DisplayList, type Rgb } from "./displayList.js";
import { TODO } from "../util/todo.js";

export function rgbToCss(rgb: Rgb): string {
  return "#" + (rgb >>> 0).toString(16).padStart(6, "0");
}

/** Render ops [0, upToOp) — the step scrubber passes a prefix. */
export function renderDisplayList(
  ctx: CanvasRenderingContext2D,
  dl: DisplayList,
  upToOp: number = dl.ops.length,
): void {
  void ctx; void dl; void upToOp; void STAGE_WIDTH; void STAGE_HEIGHT;
  TODO("T11", "Canvas2D renderer");
}
