// T11 — the throwaway three-pane debug UI. Wire, in this order:
//  1. Run: new Session(src, seed); requestAnimationFrame loop calling
//     session.advance(liveInputs) and renderDisplayList; frame slider max
//     tracks session.frameCount().
//  2. Dragging the frame slider pauses the loop and renders
//     session.displayAt(k) — replay must feel instant.
//  3. Dragging the step slider calls session.traceAt(k) once, then renders
//     ops [0, staticOps + s) via renderDisplayList's upToOp and prints the
//     current row's node span + decoded value in #stepInfo.
//  4. Canvas pointer events populate liveInputs (pointer + events) so
//     pointer-paint.chalk works live.
//  5. ChalkError -> #err textContent (message + line:col), never console-only.
import { Session } from "../../src/host/run.js";
import { renderDisplayList } from "../../src/render/canvas2d.js";
import { TODO } from "../../src/util/todo.js";

void Session; void renderDisplayList;
TODO("T11", "wire the debug UI per the comment above");
