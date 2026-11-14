import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { isQuotaText } from "./measure.ts";
const med = (a: number[]) => { a = a.filter((x) => x != null && !Number.isNaN(x)); if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const f = (x: number, d = 0) => (Number.isNaN(x) ? "-" : x.toFixed(d));
const METRICS: [string, string, number?][] = [["cost_usd", "cost USD (primary)", 4], ["wall_s", "wall s", 1], ["steps", "steps"], ["input_tokens", "input"], ["input_excl_cache", "input excl cache"], ["output_tokens", "output"], ["total_excl_cache", "total excl cache reads"], ["cost_weighted", "cost-weighted tokens (proxy)"], ["median_call_ms", "median call ms"], ["tool_bytes", "tool-out bytes"]];

const REF = "browse-mcp";
export function summarize(dir: string) {
  const all = readFileSync(join(dir, "runs.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const invalid = all.filter((r) => r.status === "quota_abort" || (!r.success && isQuotaText(JSON.stringify(r.failure_note ?? "") + (r.error ?? ""))));
  // Descriptive medians only, no intervals and no verdicts: the preregistered statistics (bootstrap CIs, gates) come from `python3 src/final.py <manifest>`.
  const rows = all.filter((r) => !invalid.includes(r));
  const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
  const vs = [...new Set(rows.map((r) => r.variant))].sort((a, b) => (a === REF ? 1 : b === REF ? -1 : 0)), suites = [...new Set(rows.map((r) => r.suite))];
  let md = `# Benchmark summary ${dir.split("/").pop()}\n\n- model/config: see meta.json (${meta.runner} ${meta.model}); agent-browser ${JSON.stringify(meta.ab_versions)}; browse ${meta.browse_version}; warm=${meta.warm}\n- N=${meta.n} per task per variant; interleaved; elapsed ${meta.elapsed_min ?? "?"} min\n- success = checker passed; clean = passed AND no rule violation (shell use outside the tool, direct URL)\n\n`;
  if (existsSync(join(dir, "static.json"))) { const s = JSON.parse(readFileSync(join(dir, "static.json"), "utf8")); md += `## Static context cost ("Say hi.")\n\n| variant | input tokens | vs no-tool baseline |\n|---|---|---|\n${s.map((r: any) => `| ${r.variant} | ${r.input_tokens} | ${r.static_tokens_vs_none >= 0 ? "+" : ""}${r.static_tokens_vs_none} |`).join("\n")}\n\nMCP servers advertise tools via tools/list (codex defers those schemas, so "Say hi" under-counts them). Advertised size:\n\n${s.filter((r: any) => r.advertised).map((r: any) => `- ${r.variant}: ${r.advertised.tools} tools, ${r.advertised.tools_bytes} B schemas + ${r.advertised.instructions_bytes} B instructions (~${r.advertised.est_tokens} tokens at 4 chars/token)`).join("\n")}\n\n`; }
  for (const suite of suites) {
    const R = rows.filter((r) => r.suite === suite); const ts = [...new Set(R.map((r) => r.task))];
    md += `## Suite: ${suite}\n\n### Per-variant (medians over all runs; success over all runs)\n\n| variant | runs | success | compliant (success+clean) | ${METRICS.map((m) => m[1]).join(" | ")} |\n|---|---|---|---|${METRICS.map(() => "---").join("|")}|\n`;
    for (const v of vs) { const r = R.filter((x) => x.variant === v); if (!r.length) continue; md += `| ${v} | ${r.length} | ${r.filter((x) => x.success).length}/${r.length} | ${r.filter((x) => x.clean).length}/${r.length} | ${METRICS.map(([k, , d]) => f(med(r.map((x) => x[k])), d ?? 0)).join(" | ")} |\n`; }
    if (vs.includes(REF)) {
      const geo = (a: number[]) => Math.exp(a.reduce((x, y) => x + Math.log(y), 0) / a.length);
      md += `\n### Per-task ratio geomean vs ${REF} (<1 = better than ${REF}; medians per task)\n\n| variant | compliant success | cost USD | steps | wall s | input excl cache | cost-weighted (proxy) | used batch/chain/run (runs) |\n|---|---|---|---|---|---|---|---|\n`;
      for (const v of vs.filter((x) => x !== REF)) {
        const ratio = (k: string) => { const rs: number[] = []; for (const t of ts) { const a = med(R.filter((x) => x.task === t && x.variant === v).map((x) => x[k])), b = med(R.filter((x) => x.task === t && x.variant === REF).map((x) => x[k])); if (a > 0 && b > 0) rs.push(a / b); } return rs.length ? geo(rs).toFixed(2) : "-"; };
        const rr = R.filter((x) => x.variant === v);
        md += `| ${v} | compliant ${rr.filter((x) => x.clean).length}/${rr.length} vs ${R.filter((x) => x.variant === REF && x.clean).length}/${R.filter((x) => x.variant === REF).length} | ${ratio("cost_usd")} | ${ratio("steps")} | ${ratio("wall_s")} | ${ratio("input_excl_cache")} | ${ratio("cost_weighted")} | batch ${rr.filter((x) => x.used_batch).length}, chain ${rr.filter((x) => x.used_chain).length}, run ${rr.filter((x) => x.used_run).length} |\n`;
      }
    }
    md += `\n### Per task (median of reps; ok = successes/runs)\n\n| task | variant | ok | wall s | steps | input excl cache | output | total excl cache | tool bytes |\n|---|---|---|---|---|---|---|---|---|\n`;
    for (const t of ts) for (const v of vs) { const r = R.filter((x) => x.task === t && x.variant === v); if (!r.length) continue; md += `| ${t} | ${v} | ${r.filter((x) => x.success).length}/${r.length} | ${f(med(r.map((x) => x.wall_s)), 1)} | ${f(med(r.map((x) => x.steps)))} | ${f(med(r.map((x) => x.input_excl_cache)))} | ${f(med(r.map((x) => x.output_tokens)))} | ${f(med(r.map((x) => x.total_excl_cache)))} | ${f(med(r.map((x) => x.tool_bytes)))} |\n`; }
    const bad = R.filter((r) => !r.success || r.violations.length); if (bad.length) { md += `\n### Failures / violations\n\n`; for (const r of bad) md += `- ${r.task} ${r.variant} #${r.rep}: ${r.success ? "passed" : "FAILED"}; answer=${JSON.stringify(String(r.answer).slice(0, 80))} truth=${JSON.stringify(String(r.truth).slice(0, 60))} ${r.failure_note ? "note=" + r.failure_note : ""} ${r.violations.length ? "violations=" + JSON.stringify(r.violations.slice(0, 3)) : ""}\n`; }
    md += "\n";
  }
  if (invalid.length) md += `## Invalid runs (excluded): provider limit (status=quota_abort)\n\n${invalid.map((r) => `- ${r.task} ${r.variant} #${r.rep}`).join("\n")}\n`;
  writeFileSync(join(dir, "summary.md"), md); console.log(md);
}
if (import.meta.main) summarize(process.argv[2]);
