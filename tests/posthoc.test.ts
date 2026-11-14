import { test, expect } from "bun:test";
import { rescoreRow, typedNavText } from "../src/posthoc.ts";
import { blind2 } from "../blind2/tasks.ts";
import { blind } from "../blind/tasks.ts";

const call = (id: string, name: string, input: any) => JSON.stringify({ type: "assistant", timestamp: "2026-11-08T19:00:05.000Z", message: { id: "m" + id, content: [{ type: "tool_use", id, name, input }], usage: { input_tokens: 2, cache_read_input_tokens: 100, cache_creation_input_tokens: 10, output_tokens: 3 } } });
const c1 = blind2.find((t) => t.id === "c1")!;
const base = { task: "c1", variant: "browse-mcp", rep: 1, success: true, answer_ok: true, clean: true, violations: [], wall_s: 20, steps: 2, status: "ok" };

test("post hoc: a run that read the API from page code stops being compliant, success and the official values are kept apart", async () => {
  const raw = call("a", "mcp__browse__execute", { code: `return await fetch("https://www.themealdb.com/api/json/v1/1/filter.php?c=Seafood").then(r=>r.text())` });
  const r = await rescoreRow(base, raw, c1);
  expect(r.success).toBe(true); expect(r.clean).toBe(false); expect(r.clean_official).toBe(true); expect(r.violations[0]).toMatch(/endpoint-policy|direct-url/);
  expect(r.workflow_ok).toBe(false); expect(r.posthoc).toContain("endpoint-policy");
});
test("post hoc: site pages and deep links stay compliant, old shell violations are kept, a typed forbidden navigation is caught", async () => {
  const page = call("a", "mcp__browse__execute", { code: `await page.goto("https://www.themealdb.com/browse.php?c=Seafood"); return 1` });
  const ok = await rescoreRow(base, page, c1); expect(ok.clean).toBe(true); expect(ok.workflow_ok).toBe(true);
  const sh = await rescoreRow({ ...base, violations: ["shell: program curl: x"] }, page, c1); expect(sh.violations).toEqual(["shell: program curl: x"]); expect(sh.clean).toBe(false);
  const nav = call("a", "mcp__browse__execute", { code: `await page.goto("https://www.themealdb.com/api/json/v1/1/lookup.php?i=1")` });
  expect((await rescoreRow(base, nav, c1)).violations[0]).toMatch(/^direct-url/);
  expect(typedNavText(nav)).toContain("themealdb.com/api");
});
test("post hoc: rows are never mutated and a row without a transcript is only copied", async () => {
  const row = { ...base }; await rescoreRow(row, call("a", "mcp__browse__execute", { code: "await handoff('x')" }), c1);
  expect(row).toEqual(base);
  expect((await rescoreRow(base, null, c1)).posthoc_note).toMatch(/only copied/);
});

test("b3-type false negative: formula pages opened in a loop satisfy the evidence from the transcript or from recorded navigations", async () => {
  const b3 = blind.find((t) => t.id === "b3")!;
  const loop = JSON.stringify({ type: "assistant", message: { id: "m", content: [{ type: "tool_use", id: "a", name: "Bash", input: { command: `agent-browser run - <<'JS'\nfor (const f of ["ffmpeg","git"]) { page.goto("https://formulae.brew.sh/formula/"+f); }\nJS` } }] } })
    + "\n" + JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "a", content: "ffmpeg depends on ... git depends on ..." }] } });
  const row = { task: "b3", variant: "ab-cli:r7", rep: 2, success: false, answer_ok: true, clean: false, violations: [], evidence_missing: ["brew formula pages"], wall_s: 9, status: "fail" };
  const r = await rescoreRow(row, loop, b3);
  expect(r.evidence_missing).toEqual([]); expect(r.success).toBe(true); expect(r.posthoc).toContain("evidence");
  const nav = await rescoreRow({ ...row, navigated_urls: ["https://formulae.brew.sh/formula/ffmpeg", "https://formulae.brew.sh/formula/git"] }, "", b3);   // recorded navigations alone
  expect(nav.evidence_missing).toEqual([]);
  const api = await rescoreRow(row, loop.replace("/formula/", "/api/formula/"), b3);                                                   // the API URL does not count as visiting the pages
  expect(api.evidence_missing).toEqual(["brew formula pages"]);
});
