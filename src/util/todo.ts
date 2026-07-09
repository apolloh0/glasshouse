/** Marker for open task work (T*, P1-T*, P2-T*). Grep for TODO( to find remaining tasks. */
export function TODO(task: string, detail?: string): never {
  throw new Error(
    "TODO(" + task + ")" + (detail ? ": " + detail : "") +
    " — see the phase specs in docs/"
  );
}
