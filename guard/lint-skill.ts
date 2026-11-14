// Lints agent-browser's agent-facing texts against guard/skill-rules.md.
// Usage: bun guard/lint-skill.ts [--ab <agent-browser checkout>] [--bin <agent-browser binary>]
// Exits 1 on any violation. Read-only: never writes to the checkout or the bench.
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tasks } from "../src/tasks.ts";
import { blind } from "../blind/tasks.ts";
import { loadBlind2, BLIND2_FILE } from "../src/suites.ts";
import * as fx from "../src/fixtures.ts";

const B = resolve(import.meta.dir, "..");
const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);
const AB = resolve(args.get("ab") ?? join(B, "../agent-browser-skill"));
const BIN = resolve(args.get("bin") ?? join(AB, "cli/target/release/agent-browser"));
if (!existsSync(BIN)) { console.error(`binary not found: ${BIN} (build it or pass --bin)`); process.exit(2); }

const BUDGET = { stub: 2800, mcpInstructions: 2000, core: 16547 };
const errors: string[] = [];
const fail = (m: string) => errors.push(m);

// ---------------- collect the texts ----------------
const stub = readFileSync(join(AB, "skills/agent-browser/SKILL.md"), "utf8");
const core = readFileSync(join(AB, "skill-data/core/SKILL.md"), "utf8");
const prelude = readFileSync(join(AB, "cli/src/codemode/prelude.js"), "utf8");
const help = Bun.spawnSync([BIN, "--help"], { env: { ...process.env, NO_COLOR: "1" } }).stdout.toString();

async function mcp(profileArgs: string[]) {
  const proc = Bun.spawn([BIN, "mcp", ...profileArgs], { stdin: "pipe", stdout: "pipe", stderr: "ignore", env: { ...process.env, HOME: "/tmp/ab-lint-home" } });
  const send = (o: any) => proc.stdin.write(JSON.stringify(o) + "\n");
  send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "lint", version: "0" } } });
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  proc.stdin.flush();
  const tools: any[] = []; let instructions = ""; let pending = 2; let nextId = 3; let buf = "";
  const dec = new TextDecoder();
  const timer = setTimeout(() => proc.kill(), 20000);
  outer: for await (const ch of proc.stdout as any) {
    buf += dec.decode(ch); let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const l = buf.slice(0, i); buf = buf.slice(i + 1); let m: any; try { m = JSON.parse(l); } catch { continue; }
      if (m.id === 1) instructions = String(m.result?.instructions ?? "");
      else if (m.id === pending) {
        tools.push(...(m.result?.tools ?? []));
        if (m.result?.nextCursor) { pending = nextId++; send({ jsonrpc: "2.0", id: pending, method: "tools/list", params: { cursor: m.result.nextCursor } }); proc.stdin.flush(); }
        else break outer;
      }
    }
  }
  clearTimeout(timer); proc.kill();
  return { instructions, tools };
}
const dflt = await mcp([]);
const all = await mcp(["--tools", "all"]);
const coreToolText = dflt.tools.map((t: any) => [t.name, t.title, t.description, JSON.stringify(t.inputSchema)].join("\n")).join("\n");

const texts: Record<string, string> = {
  "stub": stub, "core SKILL.md": core, "mcp instructions": dflt.instructions, "mcp core tools": coreToolText, "--help": help,
};

// ---------------- rule 2: budgets ----------------
const size = (s: string) => Buffer.byteLength(s);
const report: string[] = [];
const budget = (name: string, s: string, max: number) => { report.push(`${name}: ${size(s)} B (budget ${max})`); if (size(s) > max) fail(`${name} is ${size(s)} B, over budget ${max}`); };
budget("stub", stub, BUDGET.stub);
budget("mcp instructions", dflt.instructions, BUDGET.mcpInstructions);
budget("core SKILL.md", core, BUDGET.core);
report.push(`mcp default profile: ${dflt.tools.length} tools, tools/list ${size(JSON.stringify(dflt.tools))} B (all profile: ${all.tools.length} tools)`);

// ---------------- rule 1: leakage denylist ----------------
const STOP = new Set(`about above account active after alpha beta gamma before below budget category check checkout comments compute count create default delivery details done email enabled every filter find first follow form from full home input items left medium name next open page pages password plan price rating region report revenue search second settings sign size start starting stars story table telephone terms then three title total type used using when with your their that this these into only users the and for are not all any but can has its was one two use via what which who why will ago also each else much over than them they very`.split(/\s+/));
const deny = new Map<string, string>(); // term -> source
const add = (t: string, src: string) => { const k = t.trim(); if (k.length < 4) return; if (STOP.has(k.toLowerCase())) return; if (!deny.has(k)) deny.set(k, src); };
const BASE = "http://127.0.0.1:4173";
const tasksSrc = readFileSync(join(B, "src/tasks.ts"), "utf8");
const fixturesSrc = readFileSync(join(B, "src/fixtures.ts"), "utf8");
const blindSrc = readFileSync(join(B, "blind/tasks.ts"), "utf8");
const B2 = await loadBlind2(); // blind2/tasks.ts is optional: when it exists its prompts and checker hosts join the denylist
const blind2Src = B2.present ? readFileSync(BLIND2_FILE, "utf8") : "";
const heldout = existsSync(join(B, "guard/heldout-tasks.md")) ? readFileSync(join(B, "guard/heldout-tasks.md"), "utf8") : "";
const harvest = (text: string, src: string) => {
  for (const m of text.matchAll(/\b(?:[a-z0-9-]+\.)+(?:com|org|io|net|dev)\b/gi)) add(m[0].toLowerCase(), src + " domain");
  for (const m of text.matchAll(/"([^"\n]{3,60})"|'([^'\n]{3,60})'/g)) { const q = m[1] ?? m[2]; if (!/[`$]/.test(q) && !/^https?:/.test(q)) add(q, src + " quoted"); }
  for (const m of text.matchAll(/\b[A-Za-z]+(?:\.[A-Za-z]+)+\(\)|\b[a-z]+\.[a-z]+[A-Z]\w+/g)) add(m[0], src + " identifier");
  for (const m of text.matchAll(/(?<=[\s(])([A-Z][a-z]{3,})(?=[\s),.])/g)) add(m[1], src + " proper noun");
  // times, dates, codes and long numbers the task asks the agent to type or report
  for (const m of text.matchAll(/\b\d{1,4}(?:[:\-\/]\d{2,4})+\b|\b\d{5,}\b/g)) add(m[0], src + " value");
  // every capitalized word of a quoted value (person names, products): "Mara Quint" -> Mara, Quint
  for (const m of text.matchAll(/"([^"\n]{3,60})"|'([^'\n]{3,60})'/g)) for (const w of (m[1] ?? m[2]).matchAll(/\b[A-Z][a-z]{2,}\b/g)) addShort(w[0], src + " name");
};
const addShort = (t: string, src: string) => { if (!STOP.has(t.toLowerCase()) && !deny.has(t)) deny.set(t, src); };
for (const t of tasks) if (t.suite !== "diagnostic") harvest(t.prompt(BASE), `task ${t.id}`);
// blind suite b1..b20: the prompts the agent sees, and the hosts/slugs its checkers and forbidden-URL rules name
for (const t of blind) { const p = t.prompt(BASE); harvest(p, `blind ${t.id}`); for (const m of p.matchAll(/`([^`\n]{4,60})`/g)) add(m[1], `blind ${t.id} code span`); }
for (const m of blindSrc.matchAll(/https?:\/\/[^\s"`'$)]+/g)) { try { add(new URL(m[0].replace(/[),;]+$/, "")).hostname, "blind/tasks.ts checker host"); } catch {} }
for (const t of B2.tasks) { const p = t.prompt(BASE); harvest(p, `blind2 ${t.id}`); for (const m of p.matchAll(/`([^`\n]{4,60})`/g)) add(m[1], `blind2 ${t.id} code span`); }
for (const m of blind2Src.matchAll(/https?:\/\/[^\s"`'$)]+/g)) { try { add(new URL(m[0].replace(/[),;]+$/, "")).hostname, "blind2/tasks.ts checker host"); } catch {} }
report.push(B2.present ? `blind2: ${B2.tasks.length} tasks in the denylist` : "blind2: tasks.ts not present (denylist covers tasks, blind, fixtures, heldout)");
for (const m of tasksSrc.matchAll(/https?:\/\/[^\s"`'$]+/g)) { add(new URL(m[0].replace(/[),;]+$/, "")).hostname, "tasks.ts checker host"); for (const seg of new URL(m[0].replace(/[),;]+$/, "")).pathname.split("/")) if (/[_\d]/.test(seg) && /[a-z]/i.test(seg) && seg.length >= 5 && !/\.html?$/.test(seg)) add(seg, "tasks.ts url slug"); }
for (const [k, v] of Object.entries(fx)) if (/_TRUTH$|_CODE$/.test(k) && typeof v === "string") add(v, `fixtures ${k}`);
for (const m of fixturesSrc.matchAll(/=\s*\[((?:\s*"[^"]+",?)+)\s*\]/g)) for (const q of m[1].matchAll(/"([^"]+)"/g)) add(q[1], "fixtures literal");
// held-out set: domains anywhere, everything else only from the prompts the agent would see
for (const m of heldout.matchAll(/\b(?:[a-z0-9-]+\.)+(?:com|org|io|net|dev)\b/gi)) add(m[0].toLowerCase(), "heldout domain");
for (const m of heldout.matchAll(/- Prompt: "([\s\S]*?)"\s*\n- /g)) harvest(m[1].replace(/\s+/g, " "), "heldout prompt");
// A single word that the product's own CLI help or full MCP catalog already uses is generic vocabulary
// ("Press", "Status"), not a leak. Multi-word phrases, domains, values and slugs are never exempted.
const vocab = new Set((help + "\n" + JSON.stringify(all.tools)).toLowerCase().match(/[a-z]+/g) ?? []);
for (const [term] of [...deny]) if (/^[A-Za-z]+$/.test(term) && vocab.has(term.toLowerCase())) deny.delete(term);
// Harvested terms that are ordinary product vocabulary, each with a reason. Keep this short.
const ALLOW: Record<string, string> = {
  "example.com": "RFC 2606 placeholder domain",
  "agent-browser": "the product's own name",
  "github.com": "not a task target; e1 only reaches it through a search engine",
  "Protection": "capitalized ordinary word in b11's prompt; the core skill's table names Vercel's 'Deployment Protection'",
};
for (const k of Object.keys(ALLOW)) deny.delete(k);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
for (const [term, src] of deny) {
  const re = new RegExp(`(?<![\\w.-])${esc(term)}(?![\\w-])`, "i");
  for (const [name, txt] of Object.entries(texts)) { const m = txt.match(re); if (m) { const at = txt.indexOf(m[0]); fail(`leak: "${term}" (${src}) in ${name}: ...${txt.slice(Math.max(0, at - 40), at + 40).replace(/\n/g, " ")}...`); } }
}
report.push(`denylist: ${deny.size} terms from tasks.ts, blind/tasks.ts, fixtures.ts and heldout-tasks.md`);

// ---------------- rule 3: names exist ----------------
const pageApi = new Set([...prelude.matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1]));
const subOk = new Map<string, boolean>();
const cliOk = (sub: string) => { if (!subOk.has(sub)) subOk.set(sub, Bun.spawnSync([BIN, sub, "--help"], { env: { ...process.env, HOME: "/tmp/ab-lint-home" } }).exitCode === 0); return subOk.get(sub)!; };
const allNames = new Set(all.tools.map((t: any) => t.name));
const coreNames = new Set(dflt.tools.map((t: any) => t.name));
let checked = { cli: 0, page: 0, tools: 0 };
const noFrontmatter = (t: string) => t.replace(/^---\n[\s\S]*?\n---\n/, "");
for (const [name, txt] of Object.entries(texts)) {
  // CLI commands are checked where the texts present them as code: fenced blocks and `inline` spans of the markdown skills.
  const code = name === "stub" || name === "core SKILL.md" ? [...noFrontmatter(txt).matchAll(/```[\s\S]*?```|`[^`\n]+`/g)].map((m) => m[0]).join("\n") : "";
  for (const m of code.matchAll(/(?<![\w/@-])agent-browser[ \t]+(?:--[\w-]+(?:[ \t]+(?!-)[^\s`"']+)?[ \t]+)*([a-z][a-z-]*)\b/g)) {
    const sub = m[1]; if (["mcp"].includes(sub) && name === "mcp core tools") continue;
    checked.cli++; if (!cliOk(sub)) fail(`${name}: "agent-browser ${sub}" is not a CLI command`);
  }
  for (const m of txt.matchAll(/\bpage\.(\w+)\s*\(/g)) { checked.page++; if (!pageApi.has(m[1])) fail(`${name}: page.${m[1]}() is not in the run prelude`); }
  for (const m of txt.matchAll(/\bagent_browser_\w+/g)) {
    checked.tools++;
    if (!allNames.has(m[0])) fail(`${name}: tool ${m[0]} does not exist`);
    else if ((name === "mcp instructions" || name === "mcp core tools") && !coreNames.has(m[0])) fail(`${name}: tool ${m[0]} is not in the default profile`);
  }
}
report.push(`names checked: ${checked.cli} CLI commands (${subOk.size} distinct), ${checked.page} page.* calls (prelude has ${pageApi.size}), ${checked.tools} MCP tool mentions`);

console.log(report.join("\n"));
if (errors.length) { console.log(`\nFAIL: ${errors.length} violation(s)`); for (const e of errors) console.log(" - " + e); process.exit(1); }
console.log("\nPASS");
