import { test, expect } from "bun:test";
import { scoreRun, scoreFinal, finalMessage, splitAnswer, contractPreflight, syntheticEvents } from "../src/scoring.ts";
import { live, answerLine, numsIn } from "../blind/lib.ts";
import type { Task } from "../src/tasks.ts";

// A task built exactly like the blind ones (live(): prepare + check through answerLine), with a fixed truth so no network is needed.
const impl = live(async () => ({ n: 42 }), (t) => String(t.n), (l, t) => numsIn(l)[0] === t.n);
const task: Task = { id: "t", suite: "blind", title: "t", prompt: () => "", prepare: impl.prepare, check: impl.check };

const CLAUDE = syntheticEvents.claude, CODEX = syntheticEvents.codex;
for (const [name, ev] of [["claude stream-json", CLAUDE], ["codex JSON", CODEX]] as const) {
  test(`${name}: correct answer passes, wrong fails, marker-less fails even when right, timeout fails`, async () => {
    const pre = await task.prepare!();
    const right = await scoreRun(task, { events: ev("Looked it up.\nANSWER: 42"), timedOut: false, pre });
    expect(right.passed).toBe(true); expect(right.status).toBe("ok"); expect(right.answer).toBe("42"); expect(right.hasMarker).toBe(true);
    const wrong = await scoreRun(task, { events: ev("ANSWER: 41"), timedOut: false, pre });
    expect(wrong.passed).toBe(false); expect(wrong.status).toBe("fail"); expect(wrong.answerOk).toBe(false);
    const bare = await scoreRun(task, { events: ev("The count is 42."), timedOut: false, pre });
    expect(bare.passed).toBe(false); expect(bare.status).toBe("fail"); expect(bare.hasMarker).toBe(false); expect(bare.note).toMatch(/no ANSWER: marker/);
    const cut = await scoreRun(task, { events: ev("ANSWER: 42", true), timedOut: true, pre });
    expect(cut.passed).toBe(false); expect(cut.status).toBe("timeout");
  });
}
test("the marker may be bolded, lower-case or repeated: the LAST one counts, markdown is stripped by the checker", async () => {
  const pre = await task.prepare!();
  expect((await scoreFinal(task, "I considered ANSWER: 7 first.\n**ANSWER:** 42", { pre })).ok).toBe(true);
  expect((await scoreFinal(task, "answer: 42", { pre })).hasMarker).toBe(true);
  expect(splitAnswer("ANSWER: 1\nmore\nANSWER:   2\nextra").value).toBe("2\nextra");
});
test("a task that says so may omit the marker: the last non-empty line is then the answer", async () => {
  const pre = await task.prepare!();
  const lax: Task = { ...task, markerOptional: true };
  expect((await scoreFinal(lax, "thinking\n42\n", { pre })).ok).toBe(true);
  expect((await scoreFinal(task, "thinking\n42\n", { pre })).ok).toBe(false);
});
test("final message extraction: result event wins, codex uses the last agent_message, a cut-off stream keeps only what was said", () => {
  expect(finalMessage([{ e: { type: "assistant", message: { content: [{ type: "text", text: "a" }] } } }, { e: { type: "result", result: "b" } }])).toBe("b");
  expect(finalMessage([{ e: { type: "item.completed", item: { type: "agent_message", text: "x" } } }, { e: { type: "item.completed", item: { type: "command_execution" } } }, { e: { type: "item.completed", item: { type: "agent_message", text: "y" } } }])).toBe("y");
  expect(finalMessage([])).toBe("");
});
test("answerLine accepts the marker-less value the harness hands over (the r7 regression) and a value that still has a marker", () => {
  expect(answerLine("42")).toBe("42"); expect(answerLine("ANSWER: 42")).toBe("42"); expect(answerLine("`42`")).toBe("42");
});
test("preflight: a consistent harness/checker passes offline and with samples; a checker that wants the marker is caught before the run", async () => {
  const samples = { t: { right: () => "42", wrong: () => "41" } };
  expect(await contractPreflight([task], samples)).toEqual([]);
  // a checker that still insists on the marker (the r7 bug) rejects the stripped value the harness gives it
  const strict: Task = { ...task, id: "s", check: async (a) => ({ ok: /^ANSWER:/i.test(a) && /42/.test(a), truth: "42" }) };
  const problems = await contractPreflight([strict], { s: { right: () => "42", wrong: () => "41" } });
  expect(problems.some((p) => p.startsWith("s: the right sample was rejected"))).toBe(true);
  // a harness-side break (checker gets something else than the bare value) is caught without any sample
  const noisy: Task = { ...task, id: "n", check: async (a) => ({ ok: a === "__probe_7__", truth: "x" }) };
  expect(await contractPreflight([noisy], {}, { offline: true })).toEqual([]);
});

// ---- stored truth: rescoring does not depend on live data ----
test("live(): the verdict reports the snapshots it used; with ctx.snapshots it judges against them and never recomputes", async () => {
  let calls = 0;
  const l = live(async () => { calls++; return { n: 42 }; }, (t) => String(t.n), (x, t) => numsIn(x)[0] === t.n);
  const tk: Task = { id: "t", suite: "blind", title: "", prompt: () => "", prepare: l.prepare, check: l.check, snapshotAware: l.snapshotAware };
  const pre = await tk.prepare!();
  const first = await scoreFinal(tk, "ANSWER: 42", { pre });
  expect(first.ok).toBe(true); expect(first.state).toEqual([{ n: 42 }, { n: 42 }]); expect(calls).toBe(2);
  const stored = JSON.parse(JSON.stringify(first.state));
  expect((await scoreFinal(tk, "ANSWER: 42", { snapshots: stored })).ok).toBe(true);
  expect((await scoreFinal(tk, "ANSWER: 41", { snapshots: stored })).ok).toBe(false);
  expect(calls).toBe(2); // no live call on the stored path
  // the live world drifted: only the stored snapshot says 42, and a stored-only rescoring still agrees with the original verdict
  expect((await scoreFinal(tk, "ANSWER: 99", { snapshots: [{ n: 99 }, { n: 42 }] })).ok).toBe(true);
});
test("checkerVersion identifies the scoring code and the harness commit", async () => {
  const { checkerVersion } = await import("../src/versions.ts");
  const v = checkerVersion("blind");
  expect(v.checker_sha).toMatch(/^[0-9a-f]{12}$/); expect(v.contract).toBeGreaterThan(0); expect(v.harness_commit.length).toBeGreaterThan(5);
  expect(checkerVersion("blind").checker_sha).toBe(v.checker_sha); expect(checkerVersion("fixtures").checker_sha).not.toBe(v.checker_sha);
});
