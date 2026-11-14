// Endpoint policy and workflow rubric (guard/endpoint-policy.md). Pure helpers shared by run.ts and the post hoc re-scoring (src/posthoc.ts).
import type { Task } from "./tasks.ts";
import type { ApiFinding } from "./api-detect.ts";
import { missingEvidence, type Transcript } from "./measure.ts";

/** Endpoint policy applies to the blind suites; `allowApi` on a task is the only exception (the prompt itself allows those endpoints). */
export const endpointPolicyApplies = (t: Task) => t.suite === "blind" || t.suite === "blind2" || t.suite === "blind3" || t.suite === "diag-r9";

/**
 * Violations of the endpoint policy beyond the typed/recorded navigations run.ts already tests against `task.forbidden`:
 *  - a literal request made from page code (fetch / XHR / axios / $.get) to a URL matching `task.forbidden`;
 *  - any navigation or page-code request to an API-like URL (src/api-detect.ts) unless the prompt allows it (`task.allowApi`).
 * Site pages and on-site deep links never match; JSON/API data endpoints do.
 */
export function endpointViolations(task: Task, findings: ApiFinding[]): string[] {
  if (!endpointPolicyApplies(task)) return [];
  const out: string[] = [];
  for (const f of findings) {
    if (task.allowApi?.test(f.url)) continue;
    if (f.kind === "navigated-api-url" || f.kind === "script-api-call") out.push(`endpoint-policy: ${f.kind === "script-api-call" ? "page-code request" : "navigation"} to API-like URL ${f.url.slice(0, 100)}`);
    else if (task.forbidden?.test(f.url)) out.push(`direct-url (script request): ${f.url.slice(0, 100)}`);
  }
  return out;
}

export type WorkflowVerdict = { ok: boolean; missing: string[]; deepLink: "satisfies" | "does-not-satisfy" };
/**
 * Workflow compliance, scored apart from answer correctness. Only tasks whose prompt says to use the site's interface carry a rubric (null otherwise).
 * ok = no endpoint-policy violation AND, when a deep link does not satisfy the rubric, the interaction evidence holds.
 * (A deep link that satisfies the rubric needs nothing more than the page evidence every task already has.)
 */
export function scoreWorkflow(task: Task, violations: string[], tr: Transcript): WorkflowVerdict | null {
  const w = task.workflow; if (!w) return null;
  const missing: string[] = [];
  const ep = violations.filter((v) => v.startsWith("direct-url") || v.startsWith("endpoint-policy"));
  if (ep.length) missing.push("used a data endpoint instead of the site's interface: " + ep[0].slice(0, 120));
  if (w.deepLink === "does-not-satisfy") missing.push(...missingEvidence(w.interaction, tr).map((n) => "interaction: " + n));
  return { ok: missing.length === 0, missing, deepLink: w.deepLink };
}

/**
 * Fetching outside the browser from an MCP tool's code (rules v1): Playwright's HTTP client (`page.request`, `context.request`, `request.get/post/fetch`) or a bare
 * `fetch(` in code that never calls page.evaluate (so it runs in the tool's own process, not in the page). In-page fetch is covered by the endpoint policy, for both tools.
 * Heuristic, URL-independent: any such call is plain HTTP outside the browser whatever it fetches.
 */
export function outsideBrowserFetch(code: string): string | null {
  const c = code.replace(/\/\*[\s\S]*?\*\//g, " ");
  const m = /\b(?:page|context|browser)\.request\b|(?<![\w$.])request\.(?:get|post|fetch|head)\s*\(/.exec(c);
  if (m) return m[0];
  if (/(?<![\w$.])fetch\s*\(/.test(c) && !/\.evaluate(?:Handle)?\s*\(|\$eval|addInitScript|\.eval\s*\(/.test(c)) return "fetch(";
  return null;
}

/** Violations the agent's own conduct produces, from counters run.ts keeps while parsing. `memory` applies to every suite and variant; the fetch ones only when the rules block was stated. */
export function conductViolations(o: { isNone?: boolean; hasMarker: boolean; browserCalls: number; handedOff: boolean; rulesStated: boolean; readCalls: number; outsideFetch: string[] }): string[] {
  const v: string[] = [];
  if (!o.isNone && o.hasMarker && o.browserCalls === 0 && !o.handedOff) v.push("answered from memory: final answer with no browser tool call");
  if (o.rulesStated) {
    if (o.readCalls) v.push(`outside-browser fetch: agent-browser read x${o.readCalls} (plain HTTP)`);
    if (o.outsideFetch.length) v.push(`outside-browser fetch: ${o.outsideFetch[0]} in tool code`);
  }
  return v;
}
