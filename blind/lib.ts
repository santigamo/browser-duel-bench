// Shared helpers for the blind suite: live fetching, answer parsing, evidence helpers.
import { resultShows, inputShows, anyOf, navigatedTo, type Evidence } from "../src/measure.ts";

export const UA = "browser-duel-blind-checker/1.0";

export async function getText(url: string, init: RequestInit = {}, tries = 3): Promise<string> {
  let err: any;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { redirect: "follow", ...init, headers: { "user-agent": UA, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(30_000) });
      if (r.ok) return await r.text();
      err = new Error(`${url} -> HTTP ${r.status}`);
    } catch (e) { err = e; }
    await Bun.sleep(800 * (i + 1));
  }
  throw err;
}
export const getJson = async (url: string, init: RequestInit = {}) => JSON.parse(await getText(url, init));

/** GitHub API with optional token (env GITHUB_TOKEN, else `gh auth token` if available). */
let ghTok: string | undefined | null = null;
export async function ghJson(url: string) {
  if (ghTok === null) {
    ghTok = process.env.GITHUB_TOKEN;
    if (!ghTok) { try { const r = Bun.spawnSync(["gh", "auth", "token"]); const t = r.stdout.toString().trim(); if (r.exitCode === 0 && t) ghTok = t; } catch {} }
  }
  return getJson(url, { headers: { accept: "application/vnd.github+json", ...(ghTok ? { authorization: `Bearer ${ghTok}` } : {}) } });
}

export const strip = (h: string) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();

/**
 * First line of the answer value. Contract (src/scoring.ts): the harness hands checkers the text after the last "ANSWER:" marker, marker removed,
 * and fails marker-less final messages itself. This still accepts a value that carries a marker (validate/rescore callers, older tests), and a bare
 * value, so the two ends cannot drift apart again; the gate that a marker must exist lives in scoreFinal, not here.
 */
export function answerLine(answer: string): string | null {
  const m = [...answer.matchAll(/ANSWER:[ \t]*(.*)/gi)];
  if (!m.length) return answer.split("\n").map((l) => l.replace(/[`*]/g, "").trim()).find(Boolean) ?? null;
  return m[m.length - 1][1].replace(/[`*]/g, "").trim();
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** Every calendar date found in a string, as YYYY-MM-DD (ISO, "Mar 5, 2024", "5 March 2024", "05/03/2024" is NOT parsed). */
export function datesIn(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) out.push(m[0]);
  for (const m of s.matchAll(/\b([A-Za-z]{3,9})\.? (\d{1,2})(?:st|nd|rd|th)?,? (\d{4})\b/g)) { const i = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()); if (i >= 0) out.push(`${m[3]}-${String(i + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`); }
  for (const m of s.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)? ([A-Za-z]{3,9})\.?,? (\d{4})\b/g)) { const i = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()); if (i >= 0) out.push(`${m[3]}-${String(i + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`); }
  return out;
}
export const dayDiff = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5;
/** Numbers in a string, thousands separators removed. */
export const numsIn = (s: string): number[] => [...s.replace(/(?<=\d),(?=\d{3}(?!\d))/g, "").matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
export const today = () => new Date().toISOString().slice(0, 10);

/**
 * Evidence: the agent really visited / saw the site: the domain in a URL it sent, in what it read, or in a URL the browser actually navigated to
 * (recorded by the harness, so a URL built by a script in a loop counts). Format-neutral.
 */
export const visited = (name: string, re: RegExp): Evidence => anyOf(name, inputShows(name + ":in", re), resultShows(name + ":out", re), navigatedTo(name + ":nav", re));

export type Verdict = { ok: boolean; truth: string; note?: string; state?: any[] };
/**
 * Truth is recomputed live at prepare AND check time. A task passes if the answer fits either snapshot (live drift tolerance).
 * judge(parsedAnswerLine, truth) -> boolean.
 * The snapshots the verdict used come back as `state` and are stored in the run row; with `ctx.snapshots` (rescoring) the checker judges
 * against exactly those and never touches live data.
 */
export function live<T>(compute: () => Promise<T>, fmt: (t: T) => string, judge: (line: string, t: T) => boolean) {
  return {
    snapshotAware: true as const,
    prepare: async () => { try { return await compute(); } catch (e) { return { __err: String(e) }; } },
    check: async (answer: string, ctx: { pre?: any; toolText: string; snapshots?: any[] }): Promise<Verdict> => {
      const line = answerLine(answer);
      let snaps: T[], nowErr = "";
      if (ctx.snapshots) snaps = ctx.snapshots as T[];
      else {
        let now: T | null = null;
        try { now = await compute(); } catch (e) { nowErr = String(e); }
        const pre = ctx.pre && !ctx.pre.__err ? (ctx.pre as T) : null;
        snaps = [pre, now].filter((x): x is T => x != null);
      }
      if (!snaps.length) return { ok: false, truth: "(truth unavailable)", note: `checker could not compute truth: ${ctx.pre?.__err ?? ""} ${nowErr}` };
      const truth = snaps.map(fmt).filter((v, i, a) => a.indexOf(v) === i).join(" | ");
      if (!line) return { ok: false, truth, state: snaps, note: "no ANSWER: line" };
      return { ok: snaps.some((t) => judge(line, t)), truth, state: snaps };
    },
  };
}
export { resultShows, inputShows, anyOf, navigatedTo };
export type { Evidence };
