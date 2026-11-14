// Identifies the scoring code a row was produced with, so a later rescoring can say whether the checker changed.
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { CONTRACT_VERSION } from "./scoring.ts";

const B = resolve(import.meta.dir, "..");
const FILES: Record<string, string[]> = {
  everyday: ["src/tasks.ts", "src/fixtures.ts"], fixtures: ["src/tasks.ts", "src/fixtures.ts"], heldout: ["src/tasks.ts", "src/fixtures.ts"],
  blind: ["blind/tasks.ts", "blind/lib.ts"], blind2: ["blind2/tasks.ts", "blind/lib.ts"], blind3: ["blind3/tasks.ts", "blind/lib.ts"],
  // blind3 was missing from this table during the r9 run: those rows carry a checker_sha that does not cover blind3/tasks.ts (guard/prereg-r9.md, POST HOC deviation 4)
};
const COMMON = ["src/measure.ts", "src/scoring.ts"];
/** Short hash of the checker sources of a suite (+ shared measurement/scoring code). */
export function checkerHash(suite: string): string {
  const h = createHash("sha256");
  for (const f of [...(FILES[suite] ?? []), ...COMMON]) { const p = join(B, f); h.update(f + "\0" + (existsSync(p) ? readFileSync(p) : "missing") + "\0"); }
  return h.digest("hex").slice(0, 12);
}
let gitInfo: { commit: string; dirty: boolean } | undefined;
export function harnessGit() {
  if (!gitInfo) {
    const run = (a: string[]) => Bun.spawnSync(["git", "-C", B, ...a]).stdout.toString().trim();
    gitInfo = { commit: run(["rev-parse", "--short=10", "HEAD"]), dirty: run(["status", "--porcelain", "--", "src", "blind", "blind2", "guard"]).length > 0 };
  }
  return gitInfo;
}
/** Stored in every run row. */
export const checkerVersion = (suite: string) => ({ contract: CONTRACT_VERSION, checker_sha: checkerHash(suite), harness_commit: harnessGit().commit, harness_dirty: harnessGit().dirty });
