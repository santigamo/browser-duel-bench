import { test, expect } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { detectHandoffCall, detectHandoffEvent, firstHandoff, handoffInCode, chargedWall, stripJsComments } from "../src/handoff.ts";
import { applyHandoff, transcriptEvents } from "../src/handoff-posthoc.ts";
import { scoreRun, syntheticEvents, contractPreflight } from "../src/scoring.ts";
import { runStatus } from "../src/measure.ts";
import { contextProfile } from "../src/usage.ts";
import type { Task } from "../src/tasks.ts";

const use = (name: string, input: any, id = "t1") => ({ type: "assistant", message: { id: "m" + id, content: [{ type: "tool_use", id, name, input }], usage: { input_tokens: 2, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000, output_tokens: 5 } } });

test("browse: handoff() inside execute code is a handoff, with its message", () => {
  const h = detectHandoffEvent(use("mcp__browse__execute", { code: 'await handoff("Solve the CAPTCHA on the page");return page.url()' }));
  expect(h?.via).toBe("mcp-code"); expect(h?.message).toBe("Solve the CAPTCHA on the page"); expect(h?.tool).toBe("mcp__browse__execute");
  expect(handoffInCode("await handoff(`two words`, { timeoutMs: 1 })")).toBe("two words");
  expect(handoffInCode("await handoff(msg)")).toBe("");            // a call without a literal message is still a call
});
test("only the agent's own call counts: words, results, comments and other tools do not", () => {
  expect(detectHandoffEvent(use("mcp__browse__execute", { code: "return page.url() // we could handoff( later" }))).toBeNull();
  expect(detectHandoffEvent(use("mcp__browse__execute", { code: "/* handoff('x') */ return 1" }))).toBeNull();
  expect(detectHandoffEvent(use("mcp__browse__execute", { code: "const handoffs = 0; return handoffs" }))).toBeNull();
  expect(detectHandoffEvent(use("mcp__browse__execute", { code: "await page.goto('https://a.example/x//y'); await handoff('help')" }))?.message).toBe("help");   // // inside a URL is not a comment
  // browse reports `"handoffs":0` and `recommendation: "handoff"` in RESULTS: results are never inspected
  expect(detectHandoffEvent({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t1", content: '{"aftermath":{"handoffs":0,"challenge":{"recommendation":"handoff"}}}' }] } })).toBeNull();
  expect(detectHandoffEvent(use("Bash", { command: "agent-browser open https://example.com/handoff" }))).toBeNull();
  expect(detectHandoffEvent(use("mcp__ab__click", { selector: "#handoff(" }))).toBeNull();
  expect(detectHandoffEvent({ type: "result", result: "I will handoff( now" })).toBeNull();
});
test("any tool: an MCP tool named handoff, handoff() in another tool's code field, codex items, ab-cli handoff subcommand", () => {
  expect(detectHandoffCall("mcp__other__request_human", { message: "log in" })?.via).toBe("mcp-tool");
  expect(detectHandoffCall("mcp__other__run", { script: "await handoff('x')" })?.via).toBe("mcp-code");
  expect(detectHandoffEvent({ type: "item.started", item: { type: "mcp_tool_call", server: "browse", tool: "execute", arguments: { code: "await handoff('x')" } } })?.tool).toBe("mcp__browse__execute");
  expect(detectHandoffEvent({ type: "item.completed", item: { type: "mcp_tool_call", server: "browse", tool: "execute", arguments: { code: "return 1" } } })).toBeNull();
  expect(detectHandoffCall("Bash", { command: "agent-browser --session s1 handoff" })?.via).toBe("ab-cli");
  expect(detectHandoffCall("Bash", { command: "agent-browser takeover" })?.via).toBe("ab-cli");
  expect(detectHandoffCall("Bash", { command: "agent-browser snapshot -i && agent-browser click @e3" })).toBeNull();
  expect(stripJsComments("a // b\nc")).toBe("a \nc");
});
test("first handoff wins", () => {
  const ev = [{ e: use("mcp__browse__execute", { code: "return 1" }, "a") }, { e: use("mcp__browse__execute", { code: "await handoff('one')" }, "b") }, { e: use("mcp__browse__execute", { code: "await handoff('two')" }, "c") }];
  const f = firstHandoff(ev)!; expect(f.index).toBe(1); expect(f.hit.message).toBe("one");
  expect(firstHandoff([ev[0]])).toBeNull();
});
test("charged wall: recorded wall minus what happened after the call started, clamped", () => {
  expect(chargedWall(420.5, "2026-11-08T19:09:38.863Z", "2026-11-08T19:16:31.109Z")).toBeCloseTo(420.5 - 412.246, 3);
  expect(chargedWall(10, "2026-11-08T19:09:38.000Z", "2026-11-08T19:09:30.000Z")).toBe(10);   // last before call (clock skew): no discount
  expect(chargedWall(5, "2026-11-08T19:00:00.000Z", "2026-11-08T19:10:00.000Z")).toBe(0);     // never negative
});
test("scoring: a handed-off run is status=handoff and never passes, in both event formats, even with a right answer", async () => {
  const t: Task = { id: "t", suite: "blind", title: "", prompt: () => "", check: async () => ({ ok: true, truth: "x" }) };
  for (const fmt of ["claude", "codex"] as const) {
    const s = await scoreRun(t, { events: syntheticEvents[fmt]("ANSWER: x"), timedOut: false, handedOff: true });
    expect(s.passed).toBe(false); expect(s.status).toBe("handoff"); expect(s.note).toBe("handoff");
  }
  expect(runStatus({ checkOk: true, timedOut: false, errorText: "", handedOff: true })).toBe("handoff");
  expect(runStatus({ checkOk: false, timedOut: true, errorText: "" })).toBe("timeout");      // an active timeout stays a timeout
  expect(await contractPreflight([t], {}, { offline: true })).toEqual([]);
});

// ---- post-hoc over a stored transcript ----
const L = (e: any, ts?: string) => JSON.stringify(ts ? { ...e, timestamp: ts } : e);
const synthetic = [
  L({ type: "system", subtype: "init" }),
  L(use("mcp__browse__execute", { code: "return page.url()" }, "a"), "2026-11-08T19:00:05.000Z"),
  L({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "a", content: "ok" }] } }, "2026-11-08T19:00:06.000Z"),
  L(use("mcp__browse__execute", { code: "await handoff('Solve the CAPTCHA')" }, "b"), "2026-11-08T19:00:10.000Z"),
  L({ type: "user", message: { content: [{ type: "tool_result", is_error: true, tool_use_id: "b", content: "Connection closed" }] } }, "2026-11-08T19:07:03.000Z"),
].join("\n");
test("post hoc: charged wall = time until the handoff call started; cost, steps and context stop there; the row is a failure, not a timeout", () => {
  const row = { task: "c10", variant: "browse-mcp", rep: 1, status: "timeout", success: false, clean: false, timed_out: true, wall_s: 420.5, steps: 9, cost_usd: 0.5, cost_src: "estimate" };
  const r = applyHandoff(row, synthetic)!;
  expect(r.status).toBe("handoff"); expect(r.success).toBe(false); expect(r.clean).toBe(false); expect(r.timed_out).toBe(false); expect(r.handoff).toBe(true);
  expect(r.wall_raw_s).toBe(420.5); expect(r.wall_s).toBeCloseTo(420.5 - 413, 1); expect(r.handoff_at_s).toBe(r.wall_s);
  expect(r.steps).toBe(2); expect(r.cost_usd).toBeLessThan(0.01); expect(r.cost_src).toBe("estimate"); expect(r.peak_ctx).toBe(1102); expect(r.first_ctx).toBe(1102);
  expect(r.handoff_message).toBe("Solve the CAPTCHA"); expect(r.posthoc).toContain("handoff");
  expect(row.status).toBe("timeout");                                                    // input untouched
  expect(applyHandoff(row, synthetic.split("\n").filter((l) => !l.includes("handoff")).join("\n"))).toBeNull();
});
test("post hoc on the stored blind2 transcripts: c10 browse rep 1 handed off a few seconds in (skipped when results are absent)", () => {
  const f = join(import.meta.dir, "../results/2026-11-08T18-30-37-blind2-sonnet/transcripts/c10-browse-mcp-1.jsonl");
  if (!existsSync(f)) return;
  const r = applyHandoff({ task: "c10", variant: "browse-mcp", rep: 1, wall_s: 420.5, timed_out: true, status: "timeout" }, readFileSync(f, "utf8"))!;
  expect(r.handoff_message).toMatch(/CAPTCHA/); expect(r.wall_s).toBeGreaterThan(3); expect(r.wall_s).toBeLessThan(20);
});
test("context profile: first turn, peak, dynamic", () => {
  const ev = transcriptEvents(synthetic); const cp = contextProfile(ev)!;
  expect(cp).toEqual({ first: 1102, peak: 1102, dynamic: 0 });
  const grow = [{ e: { type: "assistant", message: { usage: { input_tokens: 1, cache_read_input_tokens: 100 } } } }, { e: { type: "assistant", message: { usage: { input_tokens: 1, cache_read_input_tokens: 500, cache_creation_input_tokens: 50 } } } }];
  expect(contextProfile(grow)).toEqual({ first: 101, peak: 551, dynamic: 450 });
  expect(contextProfile([])).toBeNull();
});
