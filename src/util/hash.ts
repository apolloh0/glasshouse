// FNV-1a over a string, as a uint32. Used by AST fingerprinting (Phase 2).
// render/displayList.ts keeps its own byte-level copy (Phase 0 CONTRACT,
// untouched on purpose — the two serve different layers).
export function fnv1aString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
