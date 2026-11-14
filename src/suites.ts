// Task suites beyond src/tasks.ts and blind/tasks.ts. The blind2 suite (c1..c20) is loaded from bench/blind2/tasks.ts IF THAT FILE EXISTS; this
// module never creates it. Contract for that file (same shape as blind/tasks.ts, reuse blind/lib.ts):
//   export const blind2: Task[]                                  ids c1..c20 (any c<number>), prompts, check, optional prepare/forbidden/evidence
//   export const blind2Samples: Record<string, {right, wrong}>   optional; with it the pre-run contract preflight and validate.ts probe each checker
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Task } from "./tasks.ts";
import type { Samples } from "./scoring.ts";

const B = resolve(import.meta.dir, "..");
export const BLIND2_FILE = join(B, "blind2/tasks.ts");
export type Blind2 = { present: boolean; tasks: Task[]; samples: Samples };

export async function loadBlind2(file = BLIND2_FILE): Promise<Blind2> {
  if (!existsSync(file)) return { present: false, tasks: [], samples: {} };
  const m: any = await import(file);
  if (!Array.isArray(m.blind2)) throw new Error("blind2/tasks.ts must export `blind2: Task[]`");
  const ids = new Set<string>();
  const tasks: Task[] = m.blind2.map((t: Task) => {
    if (!/^c\d+$/.test(t.id)) throw new Error(`blind2 task id ${JSON.stringify(t.id)} must look like c1..c20`);
    if (ids.has(t.id)) throw new Error(`blind2 task id ${t.id} is duplicated`);
    ids.add(t.id);
    return { ...t, suite: "blind2" as const };   // whatever the file says, these tasks belong to the blind2 group
  });
  return { present: true, tasks, samples: m.blind2Samples ?? {} };
}

/** Selection rule shared by run.ts and the tests: ids, suite names, and `all` = the development suites (never blind, blind2 or diagnostic). */
export const selects = (t: Pick<Task, "id" | "suite">, sel: string[]) =>
  sel.some((s) => s === t.id || s === t.suite || (s === "all" && !["blind", "blind2", "blind3", "blind4", "diag-r9", "diagnostic"].includes(t.suite)));

// blind3 (d1..d40): the r9 preregistered suite (guard/prereg-r9.md), loaded from bench/blind3/tasks.ts IF THAT FILE EXISTS (written by the independent author, never by this module).
// Same contract as blind2: `export const blind3: Task[]` (ids d<number>) and optional `export const blind3Samples`. The rules block (src/rules.ts) is stated by default for these tasks.
export const BLIND3_FILE = join(B, "blind3/tasks.ts");
export type Blind3 = Blind2;
export async function loadBlind3(file = BLIND3_FILE): Promise<Blind3> {
  if (!existsSync(file)) return { present: false, tasks: [], samples: {} };
  const m: any = await import(file);
  if (!Array.isArray(m.blind3)) throw new Error("blind3/tasks.ts must export `blind3: Task[]`");
  const ids = new Set<string>();
  const tasks: Task[] = m.blind3.map((t: Task) => {
    if (!/^d\d+$/.test(t.id)) throw new Error(`blind3 task id ${JSON.stringify(t.id)} must look like d1..d40`);
    if (ids.has(t.id)) throw new Error(`blind3 task id ${t.id} is duplicated`);
    ids.add(t.id);
    return { ...t, suite: "blind3" as const };
  });
  return { present: true, tasks, samples: m.blind3Samples ?? {} };
}

// blind4 (g1..g40): the r10 preregistered suite (guard/prereg-r10.md), loaded from bench/blind4/tasks.ts IF THAT FILE EXISTS (written by the independent author, never by this module).
// Same contract as blind2/blind3: `export const blind4: Task[]` (ids g<number>) and optional `export const blind4Samples`. Rules v1 are stated by default for these tasks.
export const BLIND4_FILE = join(B, "blind4/tasks.ts");
export type Blind4 = Blind2;
export async function loadBlind4(file = BLIND4_FILE): Promise<Blind4> {
  if (!existsSync(file)) return { present: false, tasks: [], samples: {} };
  const m: any = await import(file);
  if (!Array.isArray(m.blind4)) throw new Error("blind4/tasks.ts must export `blind4: Task[]`");
  const ids = new Set<string>();
  const tasks: Task[] = m.blind4.map((t: Task) => {
    if (!/^g\d+$/.test(t.id)) throw new Error(`blind4 task id ${JSON.stringify(t.id)} must look like g1..g40`);
    if (ids.has(t.id)) throw new Error(`blind4 task id ${t.id} is duplicated`);
    ids.add(t.id);
    return { ...t, suite: "blind4" as const };
  });
  return { present: true, tasks, samples: m.blind4Samples ?? {} };
}
