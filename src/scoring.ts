// THE scoring contract, in one place. Used by run.ts (live scoring), rescore-blind.ts (rescoring), blind/validate.ts and the pre-run preflight.
//
//   final message (runner events) --finalMessage()--> text --splitAnswer()--> { hasMarker, value }
//   value (marker removed) --task.check(value, ctx)--> verdict
//
// * The marker is "ANSWER:" (case-insensitive); the value is everything after the LAST marker, trimmed.
// * A final message without a marker FAILS (note "no ANSWER: marker"), unless the task sets markerOptional.
// * A timed-out run FAILS, whatever its last message says.
// * Checkers receive the marker-less value. They may also be handed a value that still has a marker (answerLine copes with both),
//   but the harness never relies on that: the gate is here, not in the checkers.
import type { Task } from "./tasks.ts";
import { transcriptFromEvents, missingEvidence, runStatus, type RunStatus, type Transcript } from "./measure.ts";

export const CONTRACT_VERSION = 2;

/** Whether recorded browser navigations count against a task's `forbidden` pattern (see Task.forbiddenNav). */
export const forbiddenNavApplies = (t: Task) => !!t.forbidden && (t.forbiddenNav ?? (t.suite === "blind" || t.suite === "blind2"));

/** The agent's final message from either runner's event stream (claude stream-json or codex `exec --json`). */
export function finalMessage(events: { e: any }[]): string {
  let final = "";
  for (const { e } of events) {
    if (e?.type === "assistant") for (const c of e.message?.content ?? []) if (c.type === "text") final = c.text;
    if (e?.type === "result" && typeof e.result === "string") final = e.result;
    if (e?.type === "item.completed" && e.item?.type === "agent_message") final = e.item.text ?? final;
  }
  return final;
}

export function splitAnswer(final: string): { hasMarker: boolean; value: string } {
  const ms = [...final.matchAll(/ANSWER:[ \t]*/gi)];
  if (ms.length) { const m = ms[ms.length - 1]; return { hasMarker: true, value: final.slice(m.index! + m[0].length).trim() }; }
  return { hasMarker: false, value: final.trim().split("\n").filter(Boolean).pop()?.trim() ?? "" };
}

export type Scored = { hasMarker: boolean; answer: string; ok: boolean; truth: string; note?: string; state?: any[] };
/** Final message text -> verdict. The only place where marker, timeout and checker meet. */
export async function scoreFinal(task: Task, finalText: string, o: { timedOut?: boolean; handedOff?: boolean; pre?: any; snapshots?: any[]; toolText?: string } = {}): Promise<Scored> {
  const { hasMarker, value } = splitAnswer(finalText);
  if (o.handedOff) return { hasMarker, answer: value, ok: false, truth: "", note: "handoff" };   // the run was ended at its first human-handoff request (src/handoff.ts)
  if (o.timedOut) return { hasMarker, answer: value, ok: false, truth: "", note: "timeout" };
  if (!hasMarker && !task.markerOptional) return { hasMarker, answer: value, ok: false, truth: "", note: "no ANSWER: marker in final message" };
  try {
    const v = await task.check(value, { pre: o.pre, toolText: o.toolText ?? "", snapshots: o.snapshots });
    return { hasMarker, answer: value, ok: !!v.ok, truth: v.truth, note: v.note, state: v.state };
  } catch (e) { return { hasMarker, answer: value, ok: false, truth: "", note: "checker error " + e }; }
}

export type RunScore = Scored & { finalText: string; answerOk: boolean; evidenceMissing: string[]; evidenceMissingRaw: string[]; passed: boolean; status: RunStatus };
/** Events of one run -> everything run.ts records about its correctness. */
export async function scoreRun(task: Task, o: { events: { e: any }[]; timedOut: boolean; handedOff?: boolean; pre?: any; snapshots?: any[]; toolText?: string; errorText?: string; navigated?: string[] | null }): Promise<RunScore> {
  const finalText = finalMessage(o.events);
  const s = await scoreFinal(task, finalText, o);
  const tr: Transcript = { ...transcriptFromEvents(o.events), navigated: o.navigated ?? null };
  const evidenceMissingRaw = missingEvidence(task.evidence, tr);
  const evidenceMissing = evidenceMissingRaw;
  const passed = s.ok && evidenceMissing.length === 0;
  const status = runStatus({ checkOk: passed, timedOut: o.timedOut, errorText: o.errorText ?? "", handedOff: o.handedOff });
  return { ...s, finalText, answerOk: s.ok, evidenceMissing, evidenceMissingRaw, passed, status };
}

// ---------------- preflight: a contract mismatch must stop the run BEFORE it starts ----------------
const claudeEvents = (text: string, timedOut = false) => [
  { e: { type: "assistant", message: { content: [{ type: "text", text }] } } },
  ...(timedOut ? [] : [{ e: { type: "result", subtype: "success", result: text, is_error: false } }])];
const codexEvents = (text: string, timedOut = false) => [
  { e: { type: "thread.started" } }, { e: { type: "item.completed", item: { id: "m1", type: "agent_message", text } } },
  ...(timedOut ? [] : [{ e: { type: "turn.completed", usage: {} } }])];
export const syntheticEvents = { claude: claudeEvents, codex: codexEvents };

export type Samples = Record<string, { right: (t: any) => string; wrong: (t: any) => string }>;
/**
 * For every selected task: (1) the harness hands the checker exactly the value after the marker (both event formats),
 * and fails a marker-less message; (2) for tasks with samples, a right answer passes, a wrong one fails, a marker-less right
 * one fails, and the stored-state path (JSON round trip of the truth snapshot) agrees with the live path.
 * `offline` skips (2) because it needs the network. Returns the list of problems (empty = contract holds).
 */
export async function contractPreflight(tasks: Task[], samples: Samples, opts: { offline?: boolean; log?: (s: string) => void } = {}): Promise<string[]> {
  const problems: string[] = [];
  for (const fmt of ["claude", "codex"] as const) {
    for (const task of tasks) {
      let seen: string | undefined;
      const probe: Task = { ...task, markerOptional: false, evidence: undefined, check: async (a) => { seen = a; return { ok: true, truth: "probe" }; } };
      const good = await scoreRun(probe, { events: syntheticEvents[fmt]("thinking...\nANSWER: __probe_7__"), timedOut: false });
      if (seen !== "__probe_7__" || !good.passed) problems.push(`${task.id} [${fmt}]: harness handed the checker ${JSON.stringify(seen)} instead of "__probe_7__"`);
      seen = undefined;
      const bare = await scoreRun(probe, { events: syntheticEvents[fmt]("__probe_7__"), timedOut: false });
      if (bare.passed || seen !== undefined) problems.push(`${task.id} [${fmt}]: a final message without ANSWER: was not failed by the harness`);
      const late = await scoreRun(probe, { events: syntheticEvents[fmt]("ANSWER: __probe_7__", true), timedOut: true });
      if (late.passed || late.status !== "timeout") problems.push(`${task.id} [${fmt}]: a timed-out run was not scored as timeout`);
      const handed = await scoreRun(probe, { events: syntheticEvents[fmt]("ANSWER: __probe_7__", true), timedOut: false, handedOff: true });
      if (handed.passed || handed.status !== "handoff") problems.push(`${task.id} [${fmt}]: a handed-off run was not scored as handoff`);
    }
  }
  if (opts.offline) return problems;
  const withSamples = tasks.filter((t) => samples[t.id] && t.prepare);
  const queue = [...withSamples];
  const worker = async () => {
    for (let t; (t = queue.shift()); ) {
      try {
        const pre = await t.prepare!();
        if (pre?.__err) { problems.push(`${t.id}: prepare failed: ${String(pre.__err).slice(0, 160)}`); continue; }
        const smp = samples[t.id];
        const good = await scoreFinal(t, `reasoning\nANSWER: ${smp.right(pre)}`, { pre });
        const bad = await scoreFinal(t, `ANSWER: ${smp.wrong(pre)}`, { pre });
        const bare = await scoreFinal(t, smp.right(pre), { pre });
        if (!good.ok) problems.push(`${t.id}: the right sample was rejected (${good.note ?? good.truth})`);
        if (bad.ok) problems.push(`${t.id}: the wrong sample was accepted`);
        if (bare.ok && !t.markerOptional) problems.push(`${t.id}: a right answer without the marker was accepted`);
        if (t.snapshotAware && good.state) {
          const stored = await scoreFinal(t, `ANSWER: ${smp.right(pre)}`, { snapshots: JSON.parse(JSON.stringify(good.state)) });
          if (!stored.ok) problems.push(`${t.id}: the stored truth state does not reproduce the verdict offline (not JSON-safe?)`);
        }
        opts.log?.(`preflight ${t.id}: ok`);
      } catch (e) { problems.push(`${t.id}: preflight error ${String(e).slice(0, 160)}`); }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return problems;
}

/** Row fields for the answer, shared by run.ts and the rescoring path. */
export const MAX_FINAL = 8000;
