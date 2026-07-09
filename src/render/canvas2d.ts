// T11 — Canvas2D backend. Kept out of all tests (D2): display-list equality
// is the definition of output; this file only exists for human eyes.
// (Implemented at P1-T8: the studio stage draws through here.)
import { STAGE_HEIGHT, STAGE_WIDTH, type DisplayList, type Rgb } from "./displayList.js";

export function rgbToCss(rgb: Rgb): string {
  return "#" + (rgb >>> 0).toString(16).padStart(6, "0");
}

/** Render ops [0, upToOp) — the step scrubber passes a prefix. */
export function renderDisplayList(
  ctx: CanvasRenderingContext2D,
  dl: DisplayList,
  upToOp: number = dl.ops.length,
): void {
  ctx.fillStyle = dl.bg === null ? "#ffffff" : rgbToCss(dl.bg);
  ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
  renderOps(ctx, dl.ops.slice(0, Math.min(upToOp, dl.ops.length)));
}

/** Render ops WITHOUT touching the background — overlay passes (selection
 *  emphasis, ghosts) composite these over an already-painted stage. */
export function renderOps(
  ctx: CanvasRenderingContext2D,
  ops: readonly DisplayList["ops"][number][],
): void {
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]!;
    switch (op.kind) {
      case "circle":
        ctx.fillStyle = rgbToCss(op.fill);
        ctx.beginPath();
        ctx.arc(op.cx, op.cy, Math.max(0, op.r), 0, Math.PI * 2);
        ctx.fill();
        break;
      case "ellipse":
        ctx.fillStyle = rgbToCss(op.fill);
        ctx.beginPath();
        ctx.ellipse(op.cx, op.cy, Math.max(0, op.rx), Math.max(0, op.ry), 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "rect":
        ctx.fillStyle = rgbToCss(op.fill);
        ctx.fillRect(op.x, op.y, op.w, op.h);
        break;
      case "triangle":
        ctx.fillStyle = rgbToCss(op.fill);
        ctx.beginPath();
        ctx.moveTo(op.ax, op.ay);
        ctx.lineTo(op.bx, op.by);
        ctx.lineTo(op.cx, op.cy);
        ctx.closePath();
        ctx.fill();
        break;
      case "line":
        ctx.strokeStyle = rgbToCss(op.stroke);
        ctx.lineWidth = op.width;
        ctx.beginPath();
        ctx.moveTo(op.x1, op.y1);
        ctx.lineTo(op.x2, op.y2);
        ctx.stroke();
        break;
    }
  }
}
