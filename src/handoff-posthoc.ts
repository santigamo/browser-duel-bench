// Offline post-hoc handoff rule over STORED transcripts (guard/handoff-policy.md). The live rule (run.ts) ends a run at its first human-handoff
// request; this applies the same detector (src/handoff.ts) to runs recorded before the rule existed, so old and new results can be compared.
//
//   bun src/handoff-posthoc.ts <results dir> --out <new runs file.jsonl>
//
// Never writes runs.jsonl or runs.original.jsonl and refuses to overwrite an existing file. Rows without a handoff are copied unchanged.
// For a row with a handoff the charge stops where the handoff call started:
//   wall_s   = recorded wall minus the time after the call started (last timestamped event - the call's timestamp). The raw wall is kept as wall_raw_s.
//   cost_usd = priced from the assistant events up to and including the handoff call (an ESTIMATE, cost_src "estimate", like any cut run)
//   steps, peak_ctx, first_ctx, tokens likewise up to the call.
// status=handoff, success=false, clean=false, timed_out=false (the timeout was the nobody-answers wait, not active execution).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import { detectHandoffEvent, chargedWall } from "./handoff.ts";
import { partialUsage, estimateCostUsd, contextProfile } from "./usage.ts";

export const transcriptEvents = (raw: string): { e: any }[] => { const ev: { e: any }[] = []; for (const l of raw.split("\n")) if (l.startsWith("{")) try { ev.push({ e: JSON.parse(l) }); } catch {} return ev; };
export const transcriptPath = (dir: string, r: { task: string; variant: string; rep: number }) => join(dir, "transcripts", `${r.task}-${r.variant.replace(/:/g, "_")}-${r.rep}.jsonl`);

/** The row as the handoff rule would have recorded it, or null when the transcript holds no handoff request. */
export function applyHandoff(row: any, raw: string): any | null {
  const events = transcriptEvents(raw);
  let idx = -1, hit: ReturnType<typeof detectHandoffEvent> = null;
  for (let i = 0; i < events.length && !hit; i++) { hit = detectHandoffEvent(events[i].e); if (hit) idx = i; }
  if (!hit) return null;
  const ts: string | undefined = events[idx].e.timestamp;
  const lastTs = [...events].reverse().map((x) => x.e.timestamp).find((t) => typeof t === "string");
  const wallRaw = row.wall_raw_s ?? row.wall_s;
  const charged = ts && lastTs ? +chargedWall(wallRaw, ts, lastTs).toFixed(1) : wallRaw;
  const upto = events.slice(0, idx + 1);
  const out: any = { ...row, status: "handoff", success: false, clean: false, answer_ok: false, timed_out: false, handoff: true, handoff_at_s: charged, handoff_tool: hit.tool, handoff_via: hit.via, handoff_message: hit.message,
    wall_raw_s: wallRaw, wall_s: charged, failure_note: "handoff: " + hit.message.slice(0, 160), posthoc: [...(row.posthoc ?? []), "handoff"] };
  if (!ts || !lastTs) out.handoff_wall_unknown = true;   // no timestamps in this transcript (codex): the recorded wall is kept, not invented
  const seen = new Set<string>(); let steps = 0;
  for (const { e } of upto) if (e.type === "assistant") for (const c of e.message?.content ?? []) if (c.type === "tool_use" && !seen.has(c.id)) { seen.add(c.id); steps++; }
  out.steps = steps;
  const pu = partialUsage(upto);
  if (pu) {
    out.raw_input = pu.raw_input; out.cache_creation = pu.cache_creation; out.cache_read = pu.cache_read; out.output_tokens = pu.output_tokens; out.usage_src = "partial-events";
    out.input_tokens = pu.raw_input + pu.cache_creation + pu.cache_read; out.cached_input_tokens = pu.cache_read; out.input_excl_cache = pu.raw_input + pu.cache_creation; out.total_excl_cache = out.input_excl_cache + pu.output_tokens;
    out.cost_weighted = Math.round(out.input_excl_cache + 0.1 * pu.cache_read + pu.output_tokens);
    out.cost_usd = +estimateCostUsd(pu).toFixed(6); out.cost_src = "estimate"; out.cost_partial = true; out.num_turns = pu.turns;
  }
  const cp = contextProfile(upto); if (cp) { out.peak_ctx = cp.peak; out.first_ctx = cp.first; }
  return out;
}

if (import.meta.main) {
  const dir = process.argv[2]; const oi = process.argv.indexOf("--out"); const out = oi > 0 ? process.argv[oi + 1] : "";
  if (!dir || !out) { console.error("usage: bun src/handoff-posthoc.ts <results dir> --out <new runs file.jsonl>"); process.exit(2); }
  if (["runs.jsonl", "runs.original.jsonl"].includes(basename(out)) || existsSync(out)) { console.error(`refusing to write ${out}: pick a new file name (runs files are never overwritten)`); process.exit(2); }
  const rows = readFileSync(join(dir, "runs.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  let n = 0, changed = 0; const lines: string[] = [];
  for (const r of rows) {
    n++; const p = transcriptPath(dir, r);
    const nr = existsSync(p) ? applyHandoff(r, readFileSync(p, "utf8")) : null;
    if (nr) changed++; lines.push(JSON.stringify(nr ?? r));
  }
  writeFileSync(resolve(out), lines.join("\n") + "\n");
  console.log(`${n} rows, ${changed} with a human-handoff request -> ${out}`);
}
