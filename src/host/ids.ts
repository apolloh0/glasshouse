// CONTRACT + full implementation — the session-lifetime owner of stable ids.
// The studio calls advance() after every SUCCESSFUL parse (failed parses
// change nothing: the last good program keeps its identities, matching the
// last-good-picture rule from Phase 1). This class is pure glue; all the
// intelligence is matchPrograms (P2-T2).
import type { NodeId, Program } from "../lang/ast.js";
import { matchPrograms, type MatchResult, type StableId } from "../lang/match.js";

export class IdTracker {
  private prev: Program | null = null;
  private stable: Map<NodeId, StableId> = new Map();
  private mint = 0;

  /** Match `next` against the previous good parse and adopt it. */
  advance(next: Program): MatchResult {
    const r = matchPrograms(this.prev, this.stable, next, this.mint);
    this.prev = next;
    this.stable = r.stableOf;
    this.mint = r.nextMint;
    return r;
  }

  /** Stable id for a node id of the CURRENT program. */
  stableOf(id: NodeId): StableId | undefined {
    return this.stable.get(id);
  }

  current(): ReadonlyMap<NodeId, StableId> {
    return this.stable;
  }
}
