import { test, expect } from "bun:test";
import { endpointViolations, scoreWorkflow } from "../src/workflow.ts";
import { blind } from "../blind/tasks.ts";
import { blind2 } from "../blind2/tasks.ts";
import { contractPreflight } from "../src/scoring.ts";
import { apiAccess } from "../src/api-detect.ts";

const T = (id: string) => [...blind, ...blind2].find((t) => t.id === id)!;
const FR_API = "https://www.federalregister.gov/api/v1/documents.json?per_page=1";
const FR_PAGE = "https://www.federalregister.gov/documents/search?conditions[agencies][]=environmental-protection-agency&conditions[type][]=RULE";

test("same site, same rule: b11 and c10 both forbid the Federal Register API and allow its search page", () => {
  for (const id of ["b11", "c10"]) { expect(T(id).forbidden!.test(FR_API)).toBe(true); expect(T(id).forbidden!.test(FR_PAGE)).toBe(false); expect(T(id).workflow?.deepLink).toBe("satisfies"); }
});
test("every blind and blind2 task has a data-endpoint rule or is named as covered only by the generic detector; none allows APIs", () => {
  const generic = new Set(["b15", "c16", "c18", "c20"]);
  for (const t of [...blind, ...blind2]) { expect(t.allowApi).toBeUndefined(); if (!generic.has(t.id)) expect(!!t.forbidden).toBe(true); }
});
test("endpoint policy: API-like navigation or page-code request is a violation, site pages and deep links are not, allowApi is the only exception", () => {
  const c1 = T("c1");
  const api = apiAccess(`await page.evaluate(() => fetch("https://www.themealdb.com/api/json/v1/1/filter.php?c=Seafood"))`, null);
  expect(endpointViolations(c1, api)[0]).toMatch(/^endpoint-policy: page-code request/);
  expect(endpointViolations(c1, apiAccess("", ["https://www.themealdb.com/api/json/v1/1/lookup.php?i=1"]))[0]).toMatch(/navigation to API-like/);
  expect(endpointViolations(c1, apiAccess("", ["https://www.themealdb.com/browse.php?c=Seafood", "https://www.themealdb.com/meal/53243"]))).toEqual([]);
  expect(endpointViolations({ ...c1, allowApi: /themealdb\.com\/api\// }, api)).toEqual([]);
  expect(endpointViolations({ ...c1, suite: "everyday" }, api)).toEqual([]);   // only the blind suites
});
test("script request matching a task's forbidden pattern is named as such even when the URL does not look like an API", () => {
  const b6 = { ...T("b6"), forbidden: /example\.org\/secret/ };
  expect(endpointViolations(b6, [{ kind: "script-fetch", url: "https://example.org/secret/data" }])[0]).toMatch(/^direct-url \(script request\)/);
});
test("workflow is scored apart: deep link satisfies by default, endpoint use fails it, interaction required where a deep link cannot satisfy", () => {
  const tr = { inputs: 'agent-browser fill @e3 "Ada Quill"\nagent-browser click @e9', results: "" };
  expect(scoreWorkflow(T("b5"), [], { inputs: "", results: "" })).toEqual({ ok: true, missing: [], deepLink: "satisfies" });
  const bad = scoreWorkflow(T("b5"), ["direct-url: navigated to a URL matching x"], tr)!; expect(bad.ok).toBe(false); expect(bad.missing[0]).toMatch(/data endpoint/);
  expect(scoreWorkflow(T("b14"), [], tr)!.ok).toBe(true);
  const no = scoreWorkflow(T("b14"), [], { inputs: "agent-browser open https://httpbin.org/forms/post", results: "" })!; expect(no.ok).toBe(false); expect(no.missing[0]).toMatch(/^interaction:/);
  expect(scoreWorkflow(T("b10"), [], tr)).toBeNull();                              // no rubric: prompt does not ask for the interface
});
test("tasks still pass the offline scoring contract after the policy edit", async () => {
  expect(await contractPreflight([...blind, ...blind2], {}, { offline: true })).toEqual([]);
});
