// Pure measurement helpers shared by run.ts, summarize.ts and the tests. No side effects on import.
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ---------------- provider limits ----------------
const Q = JSON.parse(readFileSync(join(import.meta.dir, "quota-patterns.json"), "utf8"));
export const QUOTA_RE = new RegExp(Q.patterns.map((p: string) => `(?:${p})`).join("|"), Q.flags);
/** True when text carries a provider limit message (the run died of quota, not of the task). */
export const isQuotaText = (s: string | undefined | null): boolean => !!s && QUOTA_RE.test(s);

export type RunStatus = "ok" | "fail" | "timeout" | "quota_abort" | "handoff";
/** quota_abort wins over everything except a passed check (a pass cannot be a quota death). A run that asked a human for help (src/handoff.ts) is `handoff`, never ok. */
export function runStatus(o: { checkOk: boolean; timedOut: boolean; errorText: string; handedOff?: boolean }): RunStatus {
  if (o.handedOff) return "handoff";
  if (o.checkOk && !o.timedOut) return "ok";
  if (isQuotaText(o.errorText)) return "quota_abort";
  return o.timedOut ? "timeout" : "fail";
}

// ---------------- ordering ----------------
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Deterministic Fisher-Yates; the same (items, seed) always gives the same order. */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const r = mulberry32(seed), a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** Plan = for each task, for each rep, the variants in a shuffled order. Each block gets its own derived seed. */
export function planRuns<T extends { id: string }>(tasks: T[], variants: string[], n: number, seed: number) {
  const plan: { task: T; rep: number; v: string; pos: number }[] = [];
  let block = 0;
  for (const task of tasks) for (let rep = 1; rep <= n; rep++, block++) seededShuffle(variants, seed * 1000003 + block).forEach((v, pos) => plan.push({ task, rep, v, pos }));
  return plan;
}

// ---------------- transcript evidence ----------------
/** What happened in a run, from the tool side: every call input and every tool result, as text. */
export type Transcript = { inputs: string; results: string; /** URLs the browser actually navigated (src/nav-recorder.ts), same method for every tool; null = not recorded for this run */ navigated?: string[] | null };
export const RESULTS_CAP = 600_000;
/** The shell command inside Codex's `/bin/zsh -lc '<cmd>'` wrapper (single- or double-quoted), as the agent wrote it. */
export function unwrapCodexCommand(command: string): string {
  const m = /^\S*\/(?:zsh|bash|sh) -lc ([\s\S]*)$/.exec(command);
  if (!m) return command;
  const body = m[1];
  if (body.length >= 2 && body.startsWith("'") && body.endsWith("'")) return body.slice(1, -1).replace(/'\\''/g, "'");
  if (body.length >= 2 && body.startsWith('"') && body.endsWith('"')) return body.slice(1, -1).replace(/\\(["\\$`])/g, "$1");
  return body;
}
const mcpText = (c: any): string => (typeof c === "string" ? c : Array.isArray(c) ? c.map((x: any) => x?.text ?? "").join("") : c == null ? "" : JSON.stringify(c));
/**
 * Stream events -> Transcript. Claude stream-json (assistant tool_use / user tool_result) and Codex `exec --json`
 * (item.completed with command_execution or mcp_tool_call items) are both understood; the Claude path is unchanged.
 */
export function transcriptFromEvents(events: { e: any }[]): Transcript {
  let inputs = "", results = "";
  for (const { e } of events) {
    const it = e?.type === "item.completed" ? e.item : undefined;
    if (it?.type === "command_execution") { inputs += unwrapCodexCommand(String(it.command ?? "")) + "\n"; results += String(it.aggregated_output ?? "") + "\n"; continue; }
    if (it?.type === "mcp_tool_call") { inputs += JSON.stringify(it.arguments ?? {}) + "\n"; results += mcpText(it.result?.content ?? it.error) + "\n"; continue; }
    if (e.type === "assistant") for (const c of e.message?.content ?? []) if (c.type === "tool_use") inputs += (c.name === "Bash" ? c.input?.command ?? "" : JSON.stringify(c.input ?? {})) + "\n";
    if (e.type === "user") for (const c of e.message?.content ?? []) if (c.type === "tool_result")
      results += (typeof c.content === "string" ? c.content : (c.content ?? []).map((x: any) => x.text ?? "").join("")) + "\n";
  }
  return { inputs, results: results.slice(0, RESULTS_CAP) };
}
export function transcriptFromRaw(raw: string): Transcript {
  const events: { e: any }[] = [];
  for (const l of raw.split("\n")) if (l.startsWith("{")) try { events.push({ e: JSON.parse(l) }); } catch {}
  return transcriptFromEvents(events);
}

/** A named requirement over the transcript. An answer that satisfies the checker but not every requirement does not pass. */
export type Evidence = { name: string; test: (t: Transcript) => boolean };
// MCP results arrive JSON-escaped (\" and \n); evidence patterns are written against the unescaped text.
const unescaped = (s: string) => s.replace(/\\"/g, '"').replace(/\\n/g, "\n");
export const resultShows = (name: string, re: RegExp): Evidence => ({ name, test: (t) => re.test(t.results) || re.test(unescaped(t.results)) });
export const inputShows = (name: string, re: RegExp): Evidence => ({ name, test: (t) => re.test(t.inputs) });
/** The browser really navigated to a matching URL (recorded by the harness, so URLs a script built in a loop count). Never true when nothing was recorded. */
export const navigatedTo = (name: string, re: RegExp): Evidence => ({ name, test: (t) => !!t.navigated?.some((u) => re.test(u)) });
export const anyOf = (name: string, ...ev: Evidence[]): Evidence => ({ name, test: (t) => ev.some((e) => e.test(t)) });
export const allOf = (name: string, ...ev: Evidence[]): Evidence => ({ name, test: (t) => ev.every((e) => e.test(t)) });
export function missingEvidence(req: Evidence[] | undefined, t: Transcript): string[] {
  return (req ?? []).filter((e) => !e.test(t)).map((e) => e.name);
}
