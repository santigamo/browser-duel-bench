// POST HOC / SENSITIVITY re-scoring of a stored results dir under the handoff rule (guard/handoff-policy.md) and the endpoint policy
// (guard/endpoint-policy.md). Never the official result. Reads runs.jsonl + transcripts, writes a NEW rows file, never a runs file:
//   bun src/posthoc.ts <results dir> --out <new rows file.jsonl>
// Per row: (1) handoff rule via src/handoff-posthoc.ts; (2) direct-url / endpoint-policy violations recomputed with the CURRENT task rules over the
// transcript (typed navigations, page-code requests and, where the row has them, recorded navigated_urls) replacing the row's old direct-url
// violations while keeping its shell violations; (3) workflow rubric. success is NOT recomputed (answer + evidence as scored officially); clean is.
// Original values are kept as success_official / clean_official / violations_official.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import { tasks as baseTasks } from "./tasks.ts"; import { blind } from "../blind/tasks.ts"; import { loadBlind2 } from "./suites.ts";
import { transcriptFromRaw, missingEvidence } from "./measure.ts";
import { apiAccess } from "./api-detect.ts";
import { endpointViolations, scoreWorkflow } from "./workflow.ts";
import { applyHandoff, transcriptEvents, transcriptPath } from "./handoff-posthoc.ts";

/** URLs the agent typed as navigations, same extraction as run.ts parse(). */
export function typedNavText(raw: string): string {
  let nav = "";
  const navs = (txt: string, input?: any) => {
    for (const mm of txt.matchAll(/page\.goto\(\s*(["'`])(.*?)\1/g)) nav += mm[2] + "\n";
    for (const mm of txt.matchAll(/agent-browser(?:\s+--\S+(?:\s+\S+)?)*\s+(?:open|navigate|goto)\s+["']?([^\s"'|;&]+)/g)) nav += mm[1] + "\n";
    if (input && typeof input.url === "string") nav += input.url + "\n";
  };
  for (const { e } of transcriptEvents(raw)) if (e.type === "assistant") for (const c of e.message?.content ?? []) if (c.type === "tool_use") {
    if (c.name === "Bash") navs(c.input?.command ?? ""); else navs(String(c.input?.code ?? c.input?.script ?? ""), /open$/.test(c.name) ? c.input : undefined);
  }
  return nav;
}

export async function rescoreRow(row: any, raw: string | null, task: any): Promise<any> {
  let r = { ...row, success_official: row.success, clean_official: row.clean, violations_official: row.violations ?? [], status_official: row.status, wall_official: row.wall_s, cost_official: row.cost_usd };
  r.posthoc = [...(row.posthoc ?? [])];
  if (raw === null || !task) { r.posthoc_note = "no transcript or task: only copied"; return r; }
  const h = applyHandoff(r, raw); if (h) r = h;
  const tr = transcriptFromRaw(raw);
  const navigated: string[] | null = Array.isArray(row.navigated_urls) ? row.navigated_urls : null;
  const keepOld = (row.violations ?? []).filter((v: string) => !v.startsWith("direct-url") && !v.startsWith("endpoint-policy"));
  const nv: string[] = [];
  if (task.forbidden) {
    if (task.forbidden.test(typedNavText(raw))) nv.push(`direct-url: navigated to a URL matching ${task.forbidden}`);
    const hit = navigated?.find((u) => task.forbidden.test(u)); if (hit && !nv.length) nv.push(`direct-url (recorded navigation): ${hit.slice(0, 100)}`);
  }
  const findings = apiAccess(tr.inputs, navigated);
  nv.push(...endpointViolations(task, findings));
  r.violations = [...keepOld, ...nv]; r.api_access = findings; r.posthoc.push("endpoint-policy");
  // evidence re-evaluated with the CURRENT rules (recorded navigations when the row has them): fixes false negatives such as b3's URLs built in a loop
  const ev = missingEvidence(task.evidence, { ...tr, navigated });
  if (ev.join() !== (row.evidence_missing ?? []).join()) { r.evidence_missing_official = row.evidence_missing ?? []; r.evidence_missing = ev; r.posthoc.push("evidence"); }
  if (!r.handoff) r.success = !!row.answer_ok && ev.length === 0 && !row.timed_out;
  r.clean = !!r.success && r.violations.length === 0;
  const wf = scoreWorkflow(task, r.violations, { ...tr, navigated });
  if (wf) { r.workflow_ok = wf.ok; r.workflow_missing = wf.missing; r.workflow_deeplink = wf.deepLink; }
  return r;
}

if (import.meta.main) {
  const dir = process.argv[2]; const oi = process.argv.indexOf("--out"); const out = oi > 0 ? process.argv[oi + 1] : "";
  if (!dir || !out) { console.error("usage: bun src/posthoc.ts <results dir> --out <new rows file.jsonl>"); process.exit(2); }
  if (["runs.jsonl", "runs.original.jsonl"].includes(basename(out)) || existsSync(out)) { console.error(`refusing to write ${out}: pick a new file name`); process.exit(2); }
  const all = [...baseTasks, ...blind, ...(await loadBlind2()).tasks];
  const rows = readFileSync(join(dir, "runs.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const lines: string[] = []; let hand = 0, flipped = 0;
  for (const r of rows) {
    const p = transcriptPath(dir, r); const n = await rescoreRow(r, existsSync(p) ? readFileSync(p, "utf8") : null, all.find((t) => t.id === r.task));
    if (n.handoff && !r.handoff) hand++; if (n.clean_official && !n.clean) flipped++;
    lines.push(JSON.stringify(n));
  }
  writeFileSync(resolve(out), lines.join("\n") + "\n");
  console.log(`${rows.length} rows -> ${out}; handoff ${hand}; compliant -> not compliant ${flipped}`);
}
