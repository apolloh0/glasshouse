// Guards the Phase 1 layering rules (CLAUDE.md; phase1-spec §5). Like
// purity.test.ts, this passes from day one and must never be weakened.
//
//  - The engine stays editor-free: @codemirror/@lezer only under src/editor.
//  - src/ui, src/meta, and src/flow are PURE: no DOM globals, no editor
//    imports.
//  - The Lezer tree never reaches semantic code (D11).
//  - src/ui never imports host (Session composition is app-level); src/flow
//    may import host TYPES only (TraceView), never construct a Session.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...tsFiles(p));
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

const read = (f: string): string => readFileSync(f, "utf8");

describe("layering", () => {
  it("keeps @codemirror/@lezer out of everything except src/editor", () => {
    for (const dir of ["src/lang", "src/engine", "src/render", "src/host", "src/meta", "src/ui", "src/flow"]) {
      for (const f of tsFiles(dir)) {
        expect(/@codemirror|@lezer/.test(read(f)),
          f + " must not import editor libraries").toBe(false);
      }
    }
  });

  it("keeps the DOM out of src/ (only src/editor and apps/ may touch it)", () => {
    for (const dir of ["src/lang", "src/engine", "src/render", "src/host", "src/meta", "src/ui", "src/flow"]) {
      for (const f of tsFiles(dir)) {
        const text = read(f);
        expect(/\bdocument\.|\bwindow\./.test(text),
          f + " must not touch DOM globals").toBe(false);
      }
    }
  });

  it("keeps src/ui off src/host (Session wiring is app-level)", () => {
    for (const f of tsFiles("src/ui")) {
      expect(/from\s+["'][^"']*\/host\//.test(read(f)),
        f + " must not import src/host").toBe(false);
    }
  });

  it("keeps src/flow honest: host TYPES only (no Session construction)", () => {
    for (const f of tsFiles("src/flow")) {
      const text = read(f);
      for (const m of text.matchAll(/^import\s+(type\s+)?\{[^}]*\}\s+from\s+["']([^"']+)["']/gm)) {
        if (/\/host\//.test(m[2]!)) {
          expect(m[1], f + " imports host non-type: " + m[2]).toBe("type ");
        }
      }
      expect(/new\s+Session\b/.test(text), f + " must not construct Session").toBe(false);
    }
  });

  it("keeps src/meta thin: only lang, engine, util imports", () => {
    for (const f of tsFiles("src/meta")) {
      for (const m of read(f).matchAll(/from\s+["']([^"']+)["']/g)) {
        const target = m[1]!;
        expect(/^\.\.\/(lang|engine|util)\//.test(target) || target.startsWith("./"),
          f + " imports " + target + " — meta may only use lang/engine/util").toBe(true);
      }
    }
  });
});
