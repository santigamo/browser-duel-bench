// Re-applies the CURRENT evidence rules to stored transcripts without touching the (frozen) results dirs.
// Usage: bun src/evidence-overlay.ts overlays/out.json results/<dir> [results/<dir> ...]
// Output maps "<dir>|<task>|<variant>|<rep>" -> missing evidence names (only rows that fail). final.py applies it via manifest "overlays".
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tasks as baseTasks } from "./tasks.ts";
import { blind } from "../blind/tasks.ts";
import { loadBlind2 } from "./suites.ts";
const tasks = [...baseTasks, ...blind, ...(await loadBlind2()).tasks];
import { transcriptFromRaw, missingEvidence } from "./measure.ts";
const [out, ...dirs] = process.argv.slice(2);
const overlay: Record<string, string[]> = {}; let checked = 0;
for (const d of dirs) {
  const rows = readFileSync(join(d, "runs.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  for (const r of rows) {
    const t = tasks.find((x) => x.id === r.task); if (!t?.evidence) continue;
    const f = join(d, "transcripts", `${r.task}-${r.variant.replace(/:/g, "_")}-${r.rep}.jsonl`);
    if (!existsSync(f)) { overlay[`${d}|${r.task}|${r.variant}|${r.rep}`] = ["transcript missing"]; continue; }
    checked++;
    const miss = missingEvidence(t.evidence, { ...transcriptFromRaw(readFileSync(f, "utf8")), navigated: Array.isArray(r.navigated_urls) ? r.navigated_urls : null }); // recorded navigations count when the row has them
    if (miss.length) overlay[`${d}|${r.task}|${r.variant}|${r.rep}`] = miss;
  }
}
mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(overlay, null, 2) + "\n");
console.log(`checked ${checked} rows with evidence rules, ${Object.keys(overlay).length} fail them -> ${out}`);
