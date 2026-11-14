import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadBlind2, loadBlind4, selects, BLIND2_FILE } from "../src/suites.ts";
import { tasks } from "../src/tasks.ts";
import { blind } from "../blind/tasks.ts";
import { contractPreflight } from "../src/scoring.ts";
import { checkerHash } from "../src/versions.ts";

test("a missing blind2 file loads as absent, and blind2 is never part of `all`", async () => {
  const b2 = await loadBlind2(join(import.meta.dir, "no-such-blind2.ts")); expect(b2.present).toBe(false); expect(b2.tasks).toEqual([]);
  const all = [...tasks, ...blind].filter((t) => selects(t, ["all"]));
  expect(all.some((t) => t.suite === "blind" || t.suite === "diagnostic")).toBe(false); expect(all.length).toBeGreaterThan(15);
  expect(selects(blind[0], ["blind"])).toBe(true); expect(selects(blind[0], ["b1"])).toBe(true);
});
test("a blind2 file is picked up: ids c<n>, suite forced to blind2, selectable by suite or id, never by `all`, samples reach the preflight", async () => {
  const d = mkdtempSync("/tmp/bd-b2-"); const f = join(d, "tasks.ts");
  writeFileSync(f, `export const blind2 = [
    { id: "c1", suite: "blind", title: "t", prompt: () => "p", check: async (a) => ({ ok: a.trim() === "7", truth: "7" }) },
    { id: "c2", suite: "blind2", title: "t", prompt: () => "p", check: async (a) => ({ ok: a.trim() === "9", truth: "9" }) }];
   export const blind2Samples = { c1: { right: () => "7", wrong: () => "8" } };`);
  const bad = join(d, "bad.ts"); writeFileSync(bad, `export const blind2 = [{ id: "x1", title: "t", prompt: () => "p", check: async () => ({ ok: true, truth: "" }) }];`);
  const dup = join(d, "dup.ts"); writeFileSync(dup, `const t = { id: "c1", title: "t", prompt: () => "p", check: async () => ({ ok: true, truth: "" }) }; export const blind2 = [t, t];`);   // all files first: Bun caches directory listings
  const b2 = await loadBlind2(f);
  expect(b2.present).toBe(true); expect(b2.tasks.map((t) => t.suite)).toEqual(["blind2", "blind2"]);
  expect(b2.tasks.filter((t) => selects(t, ["blind2"])).length).toBe(2); expect(b2.tasks.filter((t) => selects(t, ["all"])).length).toBe(0); expect(b2.tasks.filter((t) => selects(t, ["c2"])).length).toBe(1);
  expect(await contractPreflight(b2.tasks, b2.samples, { offline: true })).toEqual([]);
  await expect(loadBlind2(bad)).rejects.toThrow(/c1..c20/);
  await expect(loadBlind2(dup)).rejects.toThrow(/duplicated/);
});
test("checker versions know the blind2 suite (hash changes with its file once it exists; missing file is a stable value)", () => {
  expect(checkerHash("blind2")).toMatch(/^[0-9a-f]{12}$/); expect(checkerHash("blind2")).not.toBe(checkerHash("blind"));
});

test("a blind4 file is picked up: ids g<n>, suite forced to blind4, never by `all`, its checker_sha covers blind4/tasks.ts; blind4/tasks.ts is not created by the harness", async () => {
  const d = mkdtempSync("/tmp/bd-b4-"); const f = join(d, "tasks.ts");
  writeFileSync(f, `export const blind4 = [{ id: "g1", suite: "blind", title: "t", prompt: () => "p", check: async (a) => ({ ok: a.trim() === "7", truth: "7" }) }];
   export const blind4Samples = { g1: { right: () => "7", wrong: () => "8" } };`);
  const bad = join(d, "bad.ts"); writeFileSync(bad, `export const blind4 = [{ id: "d1", title: "t", prompt: () => "p", check: async () => ({ ok: true, truth: "" }) }];`);
  const dup = join(d, "dup.ts"); writeFileSync(dup, `const t = { id: "g1", title: "t", prompt: () => "p", check: async () => ({ ok: true, truth: "" }) }; export const blind4 = [t, t];`);
  const b4 = await loadBlind4(f);
  expect(b4.present).toBe(true); expect(b4.tasks.map((t) => t.suite)).toEqual(["blind4"]);
  expect(selects(b4.tasks[0], ["blind4"])).toBe(true); expect(selects(b4.tasks[0], ["g1"])).toBe(true); expect(selects(b4.tasks[0], ["all"])).toBe(false);
  expect(await contractPreflight(b4.tasks, b4.samples, { offline: true })).toEqual([]);
  await expect(loadBlind4(bad)).rejects.toThrow(/g1..g40/); await expect(loadBlind4(dup)).rejects.toThrow(/duplicated/);
  expect(checkerHash("blind4")).not.toBe(checkerHash("blind3"));
  expect(readFileSync(join(import.meta.dir, "../src/versions.ts"), "utf8")).toContain('blind4: ["blind4/tasks.ts"');
});
