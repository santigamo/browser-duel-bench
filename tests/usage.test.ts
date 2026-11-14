import { test, expect } from "bun:test";
import { partialUsage, estimateCostUsd, PRICE } from "../src/usage.ts";

const asst = (id: string, usage: any, content: any[]) => ({ e: { type: "assistant", message: { id, usage, content } } });
const events = [
  { e: { type: "system", subtype: "init" } },
  asst("m1", { input_tokens: 3, cache_creation_input_tokens: 1000, cache_read_input_tokens: 0, output_tokens: 20 }, [{ type: "text", text: "x".repeat(100) }]),
  asst("m1", { input_tokens: 3, cache_creation_input_tokens: 1000, cache_read_input_tokens: 0, output_tokens: 20 }, [{ type: "tool_use", id: "t1", name: "mcp__browse__execute", input: { code: "y".repeat(400) } }]),
  asst("m2", { input_tokens: 2, cache_creation_input_tokens: 500, cache_read_input_tokens: 1000, output_tokens: 10 }, [{ type: "tool_use", id: "t2", name: "mcp__browse__execute", input: { code: "z" } }]),
];
test("partial usage: one entry per message id, input side exact, output calibrated, floor semantics", () => {
  const u = partialUsage(events)!;
  expect(u.turns).toBe(2); expect(u.raw_input).toBe(5); expect(u.cache_creation).toBe(1500); expect(u.cache_read).toBe(1000);
  expect(u.output_tokens).toBeGreaterThan(30);   // lifted from the 30 reported-at-start tokens by the chars/turn calibration
  const usd = estimateCostUsd(u);
  expect(usd).toBeCloseTo((5 * PRICE.rates.raw_input + 1500 * PRICE.rates.cache_creation + 1000 * PRICE.rates.cache_read + u.output_tokens * PRICE.rates.output_tokens) / 1e6, 10);
  expect(partialUsage([{ e: { type: "system" } }])).toBeNull();
});
test("estimate matches a completed run's reported cost when all events are there (b1 browse sample of the r7 blind run)", () => {
  // result usage of that run: 6 / 2776 / 28112 / 584 -> $0.0197672 reported; the rates must reproduce it
  expect(estimateCostUsd({ raw_input: 6, cache_creation: 2776, cache_read: 28112, output_tokens: 584 })).toBeCloseTo(0.0197672, 7);
});
