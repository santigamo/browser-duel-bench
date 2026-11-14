import { test, expect } from "bun:test";
import { isQuotaText, runStatus, seededShuffle, planRuns, transcriptFromEvents, missingEvidence } from "../src/measure.ts";
import { tasks } from "../src/tasks.ts";

test("every provider-limit wording is recognised, including the 5-hour limit", () => {
  for (const s of ["You've hit your 5-hour limit · resets 9am (Europe/Madrid)", "usage limit reached", "Rate limit exceeded", "rate_limit_error", "You've hit your limit", "out of extra usage", "weekly limit reached", "Claude AI usage limit"])
    expect(isQuotaText(s)).toBe(true);
  for (const s of ["Element not found: #q", "timeout", "", undefined]) expect(isQuotaText(s as any)).toBe(false);
});
test("a quota death is quota_abort, not a task failure; a pass is never reclassified", () => {
  expect(runStatus({ checkOk: false, timedOut: false, errorText: "You've hit your 5-hour limit" })).toBe("quota_abort");
  expect(runStatus({ checkOk: false, timedOut: false, errorText: "wrong answer" })).toBe("fail");
  expect(runStatus({ checkOk: false, timedOut: true, errorText: "" })).toBe("timeout");
  expect(runStatus({ checkOk: true, timedOut: false, errorText: "page said: rate limit" })).toBe("ok");
});
test("variant order: deterministic per seed, a permutation, differs between blocks and seeds", () => {
  const vs = ["a", "b", "c", "d"];
  expect(seededShuffle(vs, 5)).toEqual(seededShuffle(vs, 5));
  expect([...seededShuffle(vs, 5)].sort()).toEqual(vs);
  const plan = planRuns([{ id: "t1" }, { id: "t2" }], vs, 6, 42);
  expect(plan.length).toBe(2 * 6 * 4);
  const orders = new Set<string>();
  for (let b = 0; b < 12; b++) { const blk = plan.slice(b * 4, b * 4 + 4); expect(blk.map((x) => x.v).sort()).toEqual(vs); expect(new Set(blk.map((x) => x.task.id + x.rep)).size).toBe(1); orders.add(blk.map((x) => x.v).join("")); }
  expect(orders.size).toBeGreaterThan(1);
  expect(planRuns([{ id: "t1" }], vs, 3, 1).map((x) => x.v).join()).not.toEqual(planRuns([{ id: "t1" }], vs, 3, 2).map((x) => x.v).join());
});

const call = (input: any, result: string, name = "mcp__x__run") => [
  { e: { type: "assistant", message: { content: [{ type: "tool_use", id: "1", name, input }] } } },
  { e: { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "1", content: result }] } } }];
const ev = (id: string) => tasks.find((t) => t.id === id)!.evidence;
const ECHO = JSON.stringify({ form: { comments: "sin prisa", custemail: "ana@example.com", custname: "Ana Test", custtel: "600111222", delivery: "19:30", size: "medium", topping: ["bacon", "onion"] } }, null, 2);

test("e3: the right answer without the server echo of the submitted form does not satisfy the evidence", () => {
  const t = transcriptFromEvents(call({ code: "page.goto('https://httpbin.org/forms/post')" }, "https://httpbin.org/forms/post"));
  expect(missingEvidence(ev("e3"), t).length).toBeGreaterThan(0);
});
test("e3: the echo (plain or JSON-escaped as MCP results arrive) satisfies it; a partial submission does not", () => {
  expect(missingEvidence(ev("e3"), transcriptFromEvents(call({ code: "x" }, ECHO)))).toEqual([]);
  expect(missingEvidence(ev("e3"), transcriptFromEvents(call({ code: "x" }, JSON.stringify(ECHO))))).toEqual([]);
  expect(missingEvidence(ev("e3"), transcriptFromEvents(call({ code: "x" }, ECHO.replace('"19:30"', '"20:00"')))).length).toBe(1);
});
test("e4: needs a search entry and the reference page read; a guessed answer with neither fails", () => {
  expect(missingEvidence(ev("e4"), transcriptFromEvents(call({ code: "page.goto('https://developer.mozilla.org/en-US/')" }, "MDN Web Docs"))).length).toBeGreaterThan(0);
  const searched = [...call({ code: "page.fill('input[name=q]','Array.prototype.at'); page.press('Enter')" }, "ok"), ...call({ code: "return page.text('main')" }, "Array.prototype.at() ... returns undefined")];
  expect(missingEvidence(ev("e4"), transcriptFromEvents(searched))).toEqual([]);
  expect(missingEvidence(ev("e4"), transcriptFromEvents(call({ code: "page.fill('input[name=q]','x')" }, "ok"))).length).toBe(1);
});
test("tasks without evidence keep their meaning (only e3 and e4 declare it)", () => {
  expect(tasks.filter((t) => t.evidence).map((t) => t.id)).toEqual(["e3", "e4"]);
});

// ---- Codex `exec --json` events ----
const cx = (item: any) => ({ e: { type: "item.completed", item } });
test("Codex: shell commands and their output become inputs and results, wrapper quotes removed", () => {
  const t = transcriptFromEvents([
    cx({ id: "i1", type: "command_execution", command: "/bin/zsh -lc 'agent-browser open https://hn.algolia.com && echo '\\''x'\\'''", aggregated_output: "ok HN", exit_code: 0 }),
    cx({ id: "i2", type: "command_execution", command: "/bin/zsh -lc \"agent-browser run - <<'JS'\npage.goto(\\\"https://example.org\\\");\nJS\"", aggregated_output: "done", exit_code: 0 }),
    { e: { type: "item.started", item: { id: "i3", type: "command_execution", command: "/bin/zsh -lc 'never'", aggregated_output: "" } } },
    cx({ id: "i4", type: "agent_message", text: "ANSWER: 1" })]);
  expect(t.inputs).toContain("agent-browser open https://hn.algolia.com && echo 'x'");
  expect(t.inputs).toContain('page.goto("https://example.org");');
  expect(t.inputs).not.toContain("zsh -lc");
  expect(t.inputs).not.toContain("never");
  expect(t.results).toContain("ok HN");
  expect(t.results).toContain("done");
});
test("Codex: MCP tool calls contribute their arguments and result text, or their error", () => {
  const t = transcriptFromEvents([
    cx({ id: "m1", type: "mcp_tool_call", tool: "execute", arguments: { code: "await page.goto('https://pkg.go.dev/x')" }, result: { content: [{ type: "text", text: "pkg.go.dev Versions" }] } }),
    cx({ id: "m2", type: "mcp_tool_call", tool: "execute", arguments: { code: "boom" }, error: { message: "failed hard" } })]);
  expect(t.inputs).toContain("pkg.go.dev/x");
  expect(t.results).toContain("pkg.go.dev Versions");
  expect(t.results).toContain("failed hard");
});
test("Codex: the visited() evidence of a blind task is satisfied from a Codex transcript and not from an empty one", async () => {
  const { blind } = await import("../blind/tasks.ts");
  const req = blind.find((t) => t.id === "b5")!.evidence;
  const ok = transcriptFromEvents([cx({ id: "i1", type: "command_execution", command: "/bin/zsh -lc 'agent-browser open https://hn.algolia.com'", aggregated_output: "" })]);
  expect(missingEvidence(req, ok)).toEqual([]);
  expect(missingEvidence(req, transcriptFromEvents([])).length).toBe(1);
});
test("Claude events still produce the same transcript as before (regression)", () => {
  const t = transcriptFromEvents(call({ command: "agent-browser open https://a.test" }, "page text", "Bash"));
  expect(t.inputs).toBe("agent-browser open https://a.test\n");
  expect(t.results).toBe("page text\n");
});
