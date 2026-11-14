import { test, expect } from "bun:test";
import { createHash } from "node:crypto";
import { RULES_V1, RULES_V1_SHA256, rulesOn, taskPrompt } from "../src/rules.ts";
import { conductViolations, outsideBrowserFetch } from "../src/workflow.ts";
import { analyzeShell } from "../src/shell-check.ts";
import { selects, loadBlind3, loadBlind4 } from "../src/suites.ts";

test("rules v1: the text is fixed and its sha256 is pinned (guard/prereg-r9.md quotes the same hash)", () => {
  expect(RULES_V1).toBe("Use the website's own pages through the browser tool. Do not call the site's data or API endpoints, or fetch data outside the browser, unless the task says so. Do any arithmetic or text processing inside the browser tool, not with other programs. Answer only from what you observed in the browser during this task.");
  expect(RULES_V1_SHA256).toBe(createHash("sha256").update(RULES_V1).digest("hex"));
  expect(RULES_V1_SHA256).toBe("a14bcfa4169cc0acfe3f860eb60a68dddaebe3518eb43f5ad97c3fcf99537f9e");
});
test("default by suite: on for blind3 and diag-r9, off for older suites; the flag overrides; off keeps the old prompt byte for byte", () => {
  for (const s of ["blind3", "blind4", "diag-r9"] as const) { expect(rulesOn({ suite: s })).toBe(true); expect(rulesOn({ suite: s }, "off")).toBe(false); }
  for (const s of ["everyday", "fixtures", "heldout", "blind", "blind2", "diagnostic"] as const) { expect(rulesOn({ suite: s })).toBe(false); expect(rulesOn({ suite: s }, "v1")).toBe(true); }
  const old = "T\n\nUse only the browse MCP tools to interact with the browser. Put your final answer on the last line as ANSWER: ...";
  expect(taskPrompt("T", "browse MCP tools", false)).toBe(old);
  const on = taskPrompt("T", "agent-browser CLI", true), on2 = taskPrompt("T", "browse MCP tools", true);
  expect(on).toContain(RULES_V1); expect(on.replace("agent-browser CLI", "X")).toBe(on2.replace("browse MCP tools", "X"));   // identical block for every variant
});
test("blind3 and diag-r9 are never part of `all`; a missing blind3 file loads as absent", async () => {
  for (const s of ["blind3", "blind4", "diag-r9"] as const) { expect(selects({ id: "x", suite: s }, ["all"])).toBe(false); expect(selects({ id: "x", suite: s }, [s])).toBe(true); }
  expect((await loadBlind3("/nonexistent/blind3.ts")).present).toBe(false); expect((await loadBlind4("/nonexistent/blind4.ts")).present).toBe(false);
});
test("agent-browser read is counted as fetching outside the browser, also when chained; other subcommands are browser calls", () => {
  expect(analyzeShell("agent-browser snapshot -i && agent-browser read https://example.com/x", true).subs).toEqual(["snapshot", "read"]);
  expect(analyzeShell("agent-browser read https://example.com", true).subs).toEqual(["read"]);
});
test("outside-browser fetch in MCP code: node-side fetch and Playwright's request client count, in-page fetch does not (the endpoint policy covers it)", () => {
  expect(outsideBrowserFetch("const r = await fetch('https://a.example/x'); return await r.text()")).toBe("fetch(");
  expect(outsideBrowserFetch("return await context.request.get('https://a.example').then(r=>r.text())")).toMatch(/request/);
  expect(outsideBrowserFetch("return await page.evaluate(() => fetch('/x').then(r=>r.text()))")).toBeNull();
  expect(outsideBrowserFetch("await page.goto('https://a.example'); return await page.title()")).toBeNull();
});
test("conduct violations: memory answer is a violation for every variant and suite; fetch rules only when stated; a handoff or no answer is not memory", () => {
  const base = { hasMarker: true, browserCalls: 0, handedOff: false, rulesStated: false, readCalls: 0, outsideFetch: [] as string[] };
  expect(conductViolations(base)[0]).toMatch(/^answered from memory/);
  expect(conductViolations({ ...base, browserCalls: 3 })).toEqual([]);
  expect(conductViolations({ ...base, hasMarker: false })).toEqual([]); expect(conductViolations({ ...base, handedOff: true })).toEqual([]); expect(conductViolations({ ...base, isNone: true })).toEqual([]);
  const r = { ...base, browserCalls: 2, readCalls: 1, outsideFetch: ["fetch("] };
  expect(conductViolations(r)).toEqual([]);
  expect(conductViolations({ ...r, rulesStated: true }).length).toBe(2);
});
