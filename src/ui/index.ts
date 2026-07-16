// The `./ui` subpath barrel (P6-T4, D60). Re-exports the pure UI layer —
// hover/link/annotate/diagnose, value formatting + glyphs, completions +
// previews, palette, literal/point/rotation drag, the abstraction gestures
// and their synthesis, and the keyboard machine. Everything here is DOM-free
// (tests/layering.test.ts) and depends only on lang/engine/render/meta/util,
// so it ships without pulling in CodeMirror (that is the `./editor` subpath).
export * from "./hover.js";
export * from "./link.js";
export * from "./annotate.js";
export * from "./diagnose.js";
export * from "./format.js";
export * from "./glyphs.js";
export * from "./complete.js";
export * from "./palette.js";
export * from "./drag.js";
export * from "./gestures.js";
export * from "./synth.js";
export * from "./keys.js";
export * from "./rotate.js";
