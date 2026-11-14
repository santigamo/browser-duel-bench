// Refits src/price-fit.json from completed claude runs. Usage: bun src/fit-prices.ts [model]   (prints; pass --write to overwrite the rates)
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fitRates, estimateCostUsd } from "./usage.ts";
const B = resolve(import.meta.dir, ".."); const model = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "claude-sonnet-5-5";
const X: number[][] = [], y: number[] = [], rows: any[] = [];
for (const d of readdirSync(join(B, "results"))) {
  const mp = join(B, "results", d, "meta.json"), rp = join(B, "results", d, "runs.jsonl"); if (!existsSync(mp) || !existsSync(rp)) continue;
  const meta = JSON.parse(readFileSync(mp, "utf8")); if (meta.runner !== "claude" || meta.model !== model) continue;
  for (const l of readFileSync(rp, "utf8").split("\n")) { if (!l.trim()) continue; const r = JSON.parse(l); if (r.cost_usd && r.raw_input != null && r.cost_src !== "estimate") { X.push([r.raw_input, r.cache_creation, r.cache_read, r.output_tokens]); y.push(r.cost_usd); rows.push(r); } }
}
const w = fitRates(X, y); const names = ["raw_input", "cache_creation", "cache_read", "output_tokens"];
const rates = Object.fromEntries(names.map((n, i) => [n, +(w[i] * 1e6).toFixed(4)]));
const errs = X.map((r, i) => Math.abs(estimateCostUsd({ raw_input: r[0], cache_creation: r[1], cache_read: r[2], output_tokens: r[3] }, rates as any) - y[i]) / y[i]).sort((a, b) => a - b);
console.log(JSON.stringify({ model, runs: y.length, rates, median_rel_err: errs[errs.length >> 1], max_rel_err: errs[errs.length - 1] }));
