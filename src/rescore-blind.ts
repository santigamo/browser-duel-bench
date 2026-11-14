// Rescores a results dir through the shared scoring path (src/scoring.ts), from what the rows stored, not from live data:
//   final message : row.final_text, else read from the transcript (noted)
//   truth         : row.truth_state (the snapshots the original verdict used), else [row.pre] (prepare-time truth), else LIVE fallback (noted)
// Every row gets truth_source and rescore_notes. Original rows are kept once in runs.original.jsonl and always rescored from there.
// Usage: bun src/rescore-blind.ts results/<dir> [--live] [--evidence]
//   --live      force recomputing truth now (recorded as such)
//   --evidence  re-evaluate the evidence rules with the CURRENT rules over the transcript plus the row's stored navigated_urls (recorded in rescore_notes)
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs"; import { join } from "node:path";
import { tasks as baseTasks } from "./tasks.ts"; import { blind } from "../blind/tasks.ts"; import { loadBlind2 } from "./suites.ts";
import { finalMessage, scoreFinal } from "./scoring.ts"; import { transcriptFromRaw, missingEvidence } from "./measure.ts"; import { checkerHash } from "./versions.ts";
const dir = process.argv[2]; const FORCE_LIVE = process.argv.includes("--live"), REEVAL = process.argv.includes("--evidence");
const f = join(dir, "runs.jsonl"); const bak = join(dir, "runs.original.jsonl"); if (!existsSync(bak)) copyFileSync(f, bak);
const rows = readFileSync(bak, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const all = [...baseTasks, ...blind, ...(await loadBlind2()).tasks]; const count: Record<string, number> = {}; let nomark = 0;
const fromTranscript = (path: string) => { const ev: { e: any }[] = []; for (const l of readFileSync(path, "utf8").split("\n")) if (l.startsWith("{")) try { ev.push({ e: JSON.parse(l) }); } catch {} return finalMessage(ev); };
for (const r of rows) {
  const t = all.find((x) => x.id === r.task)!; const notes: string[] = [];
  let finalText = r.final_text;
  if (finalText === undefined) { finalText = fromTranscript(join(dir, "transcripts", `${r.task}-${r.variant.replace(/:/g, "_")}-${r.rep}.jsonl`)); notes.push("final message read from the transcript (row has no final_text)"); }
  let snapshots: any[] | undefined, source: string;
  if (FORCE_LIVE) { source = "live (forced)"; notes.push("truth recomputed live by request (--live)"); }
  else if (Array.isArray(r.truth_state) && !r.state_truncated) { snapshots = r.truth_state; source = "stored-state"; }
  else if (r.pre && !r.pre_error && !r.state_truncated) { snapshots = [r.pre]; source = "stored-pre"; notes.push("no stored verdict state: judged against the prepare-time truth only"); }
  else { source = "live-fallback"; notes.push(`no stored truth (${r.pre_error ? "prepare failed: " + String(r.pre_error).slice(0, 80) : r.state_truncated ? "state too large to store" : "row predates stored truth"}): truth recomputed live at ${new Date().toISOString()}`); }
  if (snapshots && !t.snapshotAware) { source = "live (checker not snapshot-aware)"; notes.push("this checker recomputes its truth itself; stored state not used"); snapshots = undefined; }
  const cur = checkerHash(t.suite);
  notes.push(r.checker?.checker_sha ? (r.checker.checker_sha === cur ? "checker unchanged since the run" : `checker CHANGED since the run (${r.checker.checker_sha} -> ${cur})`) : "row predates checker_version");
  const c = await scoreFinal(t, finalText, { timedOut: r.timed_out, snapshots, pre: r.pre });
  count[source] = (count[source] ?? 0) + 1; if (!c.hasMarker && !r.timed_out) nomark++;
  let ev: string[] = r.evidence_missing ?? [];
  if (REEVAL) {
    const tf = join(dir, "transcripts", `${r.task}-${r.variant.replace(/:/g, "_")}-${r.rep}.jsonl`);
    if (!existsSync(tf)) notes.push("evidence NOT re-evaluated: transcript missing");
    else {
      const nv = missingEvidence(t.evidence, { ...transcriptFromRaw(readFileSync(tf, "utf8")), navigated: Array.isArray(r.navigated_urls) ? r.navigated_urls : null });
      notes.push(Array.isArray(r.navigated_urls) ? "evidence re-evaluated with recorded navigated_urls" : "evidence re-evaluated from the transcript only (row has no navigated_urls)");
      if (nv.join() !== ev.join()) notes.push(`evidence_missing changed: [${ev.join("; ")}] -> [${nv.join("; ")}]`);
      r.evidence_missing_before = ev; ev = nv; r.evidence_missing = nv;
    }
  }
  const ok = c.ok && ev.length === 0 && !r.timed_out;
  r.answer = c.answer; r.has_marker = c.hasMarker; r.answer_ok = c.ok; r.success = ok; r.clean = ok && (r.violations ?? []).length === 0; r.status = r.timed_out ? "timeout" : ok ? "ok" : "fail";
  r.truth_rescored = c.truth; r.truth_source = source; r.rescore_notes = notes; r.rescored = true;
  r.failure_note = ok ? undefined : (c.note ?? (c.ok ? "evidence missing: " + ev.join("; ") : r.timed_out ? "timeout" : "wrong answer"));
}
writeFileSync(f, rows.map((r) => JSON.stringify(r)).join("\n") + "\n"); console.log("rescored", rows.length, "no-marker", nomark, "truth sources", JSON.stringify(count));
