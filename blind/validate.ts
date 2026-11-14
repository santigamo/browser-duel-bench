// Validates the blind checkers with plain fetch only, through the REAL scoring path (src/scoring.ts: marker gate + checker):
// truth computes now, a correct final message passes, a wrong one fails, a marker-less one fails even when its text is right.
import { blind, blindSamples } from "./tasks.ts";
import { scoreFinal } from "../src/scoring.ts";
import { loadBlind2, loadBlind3, loadBlind4 } from "../src/suites.ts";
const B2 = await loadBlind2();
const B3 = await loadBlind3();
const B4 = await loadBlind4();
const ONLY = process.env.ONLY?.split(",");   // optional: validate only these ids
const all = [...blind, ...B2.tasks, ...B3.tasks, ...B4.tasks].filter((t) => !ONLY || ONLY.includes(t.id)); const samples: Record<string, any> = { ...blindSamples, ...B2.samples, ...B3.samples, ...B4.samples };
console.log(B4.present ? `blind4 present: ${B4.tasks.length} tasks` : "blind4/tasks.ts not present");
console.log(B3.present ? `blind3 present: ${B3.tasks.length} tasks` : "blind3/tasks.ts not present");
console.log(B2.present ? `blind2 present: ${B2.tasks.length} tasks` : "blind2/tasks.ts not present: validating blind only");
let pass = 0;
for (const t of all) {
  const s = samples[t.id];
  if (!s) { console.log(`FAIL ${t.id} no sample (export blind2Samples)`); continue; }
  try {
    const pre = await t.prepare!();
    if (pre?.__err) throw new Error("prepare: " + pre.__err);
    const good = await scoreFinal(t, `reasoning...\nANSWER: ${s.right(pre)}`, { pre });
    const bad = await scoreFinal(t, `ANSWER: ${s.wrong(pre)}`, { pre });
    const none = await scoreFinal(t, "I think it is something.", { pre });
    const bare = await scoreFinal(t, s.right(pre), { pre });
    const ok = good.ok && !bad.ok && !none.ok && !bare.ok;
    if (ok) pass++;
    console.log(`${ok ? "PASS" : "FAIL"} ${t.id} truth=${good.truth.slice(0, 90)} good=${good.ok} bad=${bad.ok} none=${none.ok} bare=${bare.ok}${t.forbidden ? " F" : ""}${t.evidence ? " E" : ""}`);
  } catch (e) { console.log(`FAIL ${t.id} ${String(e).slice(0, 200)}`); }
}
console.log(`${pass}/${all.length} passed; evidence/forbidden on ${all.filter((t) => t.evidence || t.forbidden).length}`);
process.exit(pass === all.length ? 0 : 1);
