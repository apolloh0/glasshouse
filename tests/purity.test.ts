// Guards CLAUDE.md invariant 1: no ambient nondeterminism in src/.
// This test passes from day one and must never be weakened.
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

const FORBIDDEN = [/Math\.random/, /Date\.now/, /performance\.now/, /new Date\(/, /process\.hrtime/];

describe("determinism purity", () => {
  it("src/ contains no wall-clock or ambient randomness", () => {
    for (const f of tsFiles("src")) {
      const text = readFileSync(f, "utf8");
      for (const re of FORBIDDEN) {
        expect(re.test(text), f + " must not use " + re.source).toBe(false);
      }
    }
  });
});
