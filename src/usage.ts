// Spend of a run that has no `result` event (timeout, kill): usage from the assistant events received before it ended, priced with the
// rates fitted from completed runs (src/price-fit.json). Anything derived here is an ESTIMATE and rows say so (cost_src, cost_partial).
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Usage = { raw_input: number; cache_creation: number; cache_read: number; output_tokens: number; turns: number };
export const PRICE = JSON.parse(readFileSync(join(import.meta.dir, "price-fit.json"), "utf8")) as { model: string; rates: Record<keyof Omit<Usage, "turns">, number>; output_calibration: { chars_per_token_inv: number; per_turn: number } };

/**
 * Claude stream-json: every assistant event carries the usage of its message; several events can share a message id (one per content block),
 * so take the per-field maximum per id and sum over ids. Input-side counts are exact. `output_tokens` in these events is the count when the message
 * started (about a third of the final one), so it is replaced by max(that, 0.4 * chars + 40 * turns) calibrated on completed runs (price-fit.json).
 * The turn that was still streaming when the run died is not in the stream at all, so the result is a floor. Null when no assistant event carried usage.
 */
export function partialUsage(events: { e: any }[]): Usage | null {
  const byId = new Map<string, Omit<Usage, "turns">>(); const seenBlocks = new Set<string>();
  let anon = 0, chars = 0;
  for (const { e } of events) {
    if (e?.type !== "assistant") continue;
    const u = e.message?.usage; if (!u) continue;
    const id = e.message?.id ?? `anon${anon++}`;
    const cur = byId.get(id) ?? { raw_input: 0, cache_creation: 0, cache_read: 0, output_tokens: 0 };
    cur.raw_input = Math.max(cur.raw_input, u.input_tokens ?? 0); cur.cache_creation = Math.max(cur.cache_creation, u.cache_creation_input_tokens ?? 0);
    cur.cache_read = Math.max(cur.cache_read, u.cache_read_input_tokens ?? 0); cur.output_tokens = Math.max(cur.output_tokens, u.output_tokens ?? 0);
    byId.set(id, cur);
    for (const c of e.message?.content ?? []) {
      const key = id + "|" + (c.id ?? c.type + String(c.text ?? "").length); if (seenBlocks.has(key)) continue; seenBlocks.add(key);
      if (c.type === "text") chars += String(c.text ?? "").length; else if (c.type === "tool_use") chars += JSON.stringify(c.input ?? {}).length + String(c.name ?? "").length;
    }
  }
  if (!byId.size) return null;
  const t: Usage = { raw_input: 0, cache_creation: 0, cache_read: 0, output_tokens: 0, turns: byId.size };
  for (const c of byId.values()) { t.raw_input += c.raw_input; t.cache_creation += c.cache_creation; t.cache_read += c.cache_read; t.output_tokens += c.output_tokens; }
  const cal = PRICE.output_calibration;
  t.output_tokens = Math.max(t.output_tokens, Math.round(cal.chars_per_token_inv * chars + cal.per_turn * t.turns));
  return t;
}
export const estimateCostUsd = (u: Omit<Usage, "turns">, rates = PRICE.rates) =>
  (u.raw_input * rates.raw_input + u.cache_creation * rates.cache_creation + u.cache_read * rates.cache_read + u.output_tokens * rates.output_tokens) / 1e6;

/** Normal-equation least squares for the four rates, used by src/fit-prices.ts. */
export function fitRates(X: number[][], y: number[]): number[] {
  const n = y.length, k = 4;
  const A = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => X.reduce((s, r) => s + r[i] * r[j], 0)));
  const b = Array.from({ length: k }, (_, i) => X.reduce((s, r, q) => s + r[i] * y[q], 0));
  const M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < k; i++) {
    let p = i; for (let q = i + 1; q < k; q++) if (Math.abs(M[q][i]) > Math.abs(M[p][i])) p = q;
    [M[i], M[p]] = [M[p], M[i]];
    for (let q = i + 1; q < k; q++) { const f = M[q][i] / M[i][i]; for (let j = i; j <= k; j++) M[q][j] -= f * M[i][j]; }
  }
  const x = new Array(k).fill(0);
  for (let i = k - 1; i >= 0; i--) x[i] = (M[i][k] - M.slice(i + 1).reduce((s, _, jj) => s + M[i][i + 1 + jj] * x[i + 1 + jj], 0)) / M[i][i];
  void n; return x;
}

/**
 * Context profile of a Claude run from its assistant events: the prompt size (input + cache read + cache creation) each turn was sent with.
 * `first` = the first turn (system prompt, tool definitions and the task, which differ per tool and are fixed cost), `peak` = the largest turn,
 * `dynamic` = peak - first: how much context the run itself accumulated. Null when no assistant event carries usage.
 */
export function contextProfile(events: { e: any }[]): { first: number; peak: number; dynamic: number } | null {
  let first: number | null = null, peak = 0;
  for (const { e } of events) {
    if (e?.type !== "assistant") continue;
    const u = e.message?.usage; if (!u) continue;
    const c = (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
    if (first === null) first = c;
    peak = Math.max(peak, c);
  }
  return first === null ? null : { first, peak, dynamic: Math.max(0, peak - first) };
}
