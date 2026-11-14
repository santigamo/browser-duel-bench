// Benchmark harness. Runners: claude (default, `claude -p` stream-json) and codex (`codex exec --json`).
// One command: bun run bench --variants ab-cli:main,ab-cli:duel,ab-cli:duelrun,ab-mcp:duel,browse-mcp --bins main=/p,duel=/p,duelrun=/p --tasks everyday,fixtures,heldout --n 3
import { mkdirSync, mkdtempSync, writeFileSync, appendFileSync, readFileSync, existsSync, readdirSync, rmSync, cpSync, chmodSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { tasks, type Task } from "./tasks.ts";
import { handle } from "./fixtures.ts";
import { blind, blindSamples } from "../blind/tasks.ts";
import { loadBlind2, loadBlind3, selects } from "./suites.ts";
import { summarize } from "./summarize.ts";
import { mcpAdvertised } from "./mcp-static.ts";
import { analyzeShell } from "./shell-check.ts";
import { isQuotaText, planRuns, unwrapCodexCommand, transcriptFromEvents } from "./measure.ts";
import { NavRecorder, fixedPortDiscover, processDiscover, chromePids, type NavResult } from "./nav-recorder.ts";
import { linkTextTools, linkHostTools, sandboxed, sandboxAvailable } from "./restricted-env.ts";
import { apiAccess } from "./api-detect.ts";
import { partialUsage, estimateCostUsd } from "./usage.ts";
import { checkerVersion } from "./versions.ts";
import { endpointViolations, scoreWorkflow, outsideBrowserFetch, conductViolations } from "./workflow.ts";
import { RULES_V1, RULES_V1_SHA256, rulesOn, taskPrompt } from "./rules.ts";
import { detectHandoffEvent, type HandoffHit } from "./handoff.ts";
import { finalMessage, splitAnswer, scoreRun, contractPreflight, forbiddenNavApplies, MAX_FINAL, CONTRACT_VERSION } from "./scoring.ts";

const B = resolve(import.meta.dir, "..");
const ROOT = resolve(B, "..");
const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith("--")) { const nx = process.argv[i + 1]; if (nx && !nx.startsWith("--")) { args.set(a.slice(2), nx); i++; } else args.set(a.slice(2), "true"); } }
const RUNNER = (args.get("runner") ?? "claude") as "claude" | "codex";
const MODEL = args.get("model") ?? (RUNNER === "claude" ? "claude-sonnet-5-5" : "");
const variants = (args.get("variants") ?? "ab-cli,ab-mcp,browse-mcp").split(",");
const sel = (args.get("tasks") ?? "everyday").split(",");
const N = Number(args.get("n") ?? 5);
const DEFAULT_AB = resolve(args.get("ab-bin") ?? join(ROOT, "agent-browser/cli/target/release/agent-browser"));
const BINS: Record<string, string> = { main: DEFAULT_AB };
for (const kv of (args.get("bins") ?? "").split(",").filter(Boolean)) { const [k, v] = kv.split("="); BINS[k] = resolve(v); }
const CLAUDE_BIN = Bun.which("claude") ?? "claude";
const CODEX_BIN = Bun.which("codex") ?? "codex"; // absolute: the restricted PATH of ab-cli runs does not contain it
const WARM = (args.get("warm") ?? "true") !== "false";
const TIMEOUT = Number(args.get("timeout") ?? 420) * 1000;
/** Human handoff (src/handoff.ts, guard/handoff-policy.md): by default the run ends at the agent's first explicit request for a human (status=handoff, success=false, wall and cost charged up to that event). `--handoff ignore` restores the old behaviour (the call blocks until the timeout). */
/** Endpoint policy (guard/endpoint-policy.md): API-like requests from page code or navigations count as violations in the blind suites. `--endpoint-policy off` restores the older, navigation-only rule. */
const ENDPOINT = args.get("endpoint-policy") ?? "on";
if (ENDPOINT !== "on" && ENDPOINT !== "off") throw new Error("--endpoint-policy is on or off");
/** Rules block stated to the agent (src/rules.ts), identical for every variant. `--rules v1` always, `--rules off` never; default: on for the suites blind3 and diag-r9, off for older suites (their prompts stay byte-identical). */
const RULES = args.get("rules");
if (RULES !== undefined && RULES !== "v1" && RULES !== "off") throw new Error("--rules is v1 or off");
const HANDOFF = args.get("handoff") ?? "end";
if (HANDOFF !== "end" && HANDOFF !== "ignore") throw new Error("--handoff is end or ignore");
const PORT = Number(process.env.FIXTURE_PORT ?? 4173);
const BASE = `http://127.0.0.1:${PORT}`;
const label = args.get("label") ?? "";
/** ab-cli's Bash is made browser-only like the MCP variants (src/restricted-env.ts): PATH with the wrapper and text tools only + exec-deny sandbox. `--shell open` turns it off (recorded). */
const SHELL_MODE = args.get("shell") ?? "restricted";
if (SHELL_MODE !== "restricted" && SHELL_MODE !== "open") throw new Error("--shell is restricted or open");
if (SHELL_MODE === "restricted" && !sandboxAvailable()) throw new Error("restricted shell needs macOS sandbox-exec; pass --shell open to run without it (recorded in meta.json)");
/** Seed for the per-block variant order (recorded in meta.json and on every row); --seed N replays an order. */
const SEED = Number(args.get("seed") ?? Math.floor(Math.random() * 2 ** 31));
const CHROME = (() => { const d = join(B, ".cache/chrome"); const v = readdirSync(d).find((x) => x.startsWith("mac"))!; return join(d, v, readdirSync(join(d, v))[0], "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"); })();
const BROWSE_CLI = join(ROOT, "browse/cli/dist/cli.mjs");
const NODE = Bun.which("node")!;
const browseEnv = { OPENCODE_BROWSER_HOME: join(B, ".browse-home"), OPENCODE_BROWSER_AUTO_UPDATE: "off", OPENCODE_BROWSER_UPDATE_CHECK: "0",
  XDG_CONFIG_HOME: join(B, ".xdg/config"), XDG_DATA_HOME: join(B, ".xdg/data"), XDG_STATE_HOME: join(B, ".xdg/state"), XDG_CACHE_HOME: join(B, ".xdg/cache") };
const SYS_PATH = "/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin";

// blind2 (c1..c20) comes from bench/blind2/tasks.ts when that file exists (src/suites.ts); it is never part of `all`
const B2 = await loadBlind2();
if (sel.includes("blind2") && !B2.present) throw new Error("--tasks blind2 but blind2/tasks.ts does not exist");
const B3 = await loadBlind3();
if (sel.includes("blind3") && !B3.present) throw new Error("--tasks blind3 but blind3/tasks.ts does not exist");
const wanted: Task[] = [...tasks, ...blind, ...B2.tasks, ...B3.tasks].filter((t) => selects(t, sel));
if (!wanted.length) throw new Error("no tasks selected");
// Contract preflight (src/scoring.ts): a harness/checker mismatch stops here, before any agent run or spend. `--preflight offline` skips only the network part.
const PREFLIGHT = args.get("preflight") ?? "full";
if (PREFLIGHT !== "full" && PREFLIGHT !== "offline") throw new Error("--preflight is full or offline");
const preflightProblems = await contractPreflight(wanted, { ...blindSamples, ...B2.samples, ...B3.samples }, { offline: PREFLIGHT === "offline" });
if (preflightProblems.length) { console.error("SCORING CONTRACT MISMATCH, no run started:\n" + preflightProblems.map((x) => " - " + x).join("\n")); process.exit(2); }
console.log(`scoring contract preflight (${PREFLIGHT}) ok for ${wanted.length} tasks`);
const server = Bun.serve({ port: PORT, hostname: "127.0.0.1", fetch: handle });

// ---------------- browse: isolated relay + throwaway Chrome for Testing with the unpacked extension ----------------
async function ensureBrowse() {
  const up = await fetch("http://127.0.0.1:9333/json/version").then((r) => r.ok, () => false);
  const run = (a: string[]) => Bun.spawnSync([NODE, BROWSE_CLI, ...a], { env: { ...process.env, ...browseEnv } });
  if (!up) {
    const ext = join(B, ".browse-ext"), prof = join(B, ".profiles/browse");
    if (!existsSync(join(prof, "Default/Preferences"))) {
      rmSync(ext, { recursive: true, force: true }); cpSync(join(ROOT, "browse/dist"), ext, { recursive: true });
      mkdirSync(join(prof, "Default"), { recursive: true }); writeFileSync(join(prof, "Default/Preferences"), '{"extensions":{"ui":{"developer_mode":true}}}');
      const code = run(["pair", "--wait-seconds", "1"]).stdout.toString().match(/Pairing code: ([0-9A-Z]{4})-([0-9A-Z]{4})/);
      if (!code) throw new Error("could not mint pairing code");
      writeFileSync(join(ext, "relay-pairing.json"), JSON.stringify({ code: code[1] + code[2] }));
    }
    for (const f of ["SingletonLock", "SingletonSocket", "SingletonCookie"]) rmSync(join(prof, f), { force: true });
    Bun.spawn([CHROME, `--user-data-dir=${prof}`, `--load-extension=${ext}`, "--headless=new", "--no-first-run", "--no-default-browser-check", "--password-store=basic", "--remote-debugging-port=9333", "about:blank"], { stdout: "ignore", stderr: "ignore", stdin: "ignore" }).unref();
  }
  run(["tabs", "cleanup", "--idle-minutes", "0"]); // any relay-backed command starts the relay
  for (let i = 0; i < 60; i++) { if (run(["pair", "--list"]).stdout.toString().trim() && /Extension: connected/i.test(run(["status"]).stdout.toString())) return; await Bun.sleep(500); }
  console.error("WARN: browse extension not reported connected");
}
/** Harness-driven reset between runs (not model-driven): close agent tabs and clear cookies, so each run starts clean. */
async function resetBrowse() {
  Bun.spawnSync([NODE, BROWSE_CLI, "tabs", "cleanup", "--idle-minutes", "0"], { env: { ...process.env, ...browseEnv }, timeout: 30000 });
  try {
    const v = await (await fetch("http://127.0.0.1:9333/json/version")).json();
    await new Promise<void>((res) => { const ws = new WebSocket(v.webSocketDebuggerUrl); ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: "Storage.clearCookies" })); ws.onmessage = () => { ws.close(); res(); }; ws.onerror = () => res(); setTimeout(res, 3000); });
  } catch {}
}

// ---------------- variants ----------------
type Prep = { restricted?: boolean; env: Record<string, string>; mcp?: Record<string, { command: string; args: string[]; env: Record<string, string> }>; systemPrompt?: string; shell: boolean; warm?: () => void; cleanup: () => void; };
type Variant = { id: string; base: string; label: string; toolName: string; prep(runDir: string, home: string): Prep };
const abBin = (lab: string) => BINS[lab] ?? DEFAULT_AB;
function shim(runDir: string, home: string, real: string) {
  const bin = join(runDir, "bin"); mkdirSync(bin, { recursive: true });
  const f = join(bin, "agent-browser");
  writeFileSync(f, `#!/bin/sh\nexport HOME=${JSON.stringify(home)} AGENT_BROWSER_EXECUTABLE_PATH=${JSON.stringify(CHROME)}\nexec ${JSON.stringify(real)} "$@"\n`); chmodSync(f, 0o755);
  return { bin, f };
}
function makeVariant(spec: string): Variant {
  const [base, lab = "main"] = spec.split(":");
  const id = spec;
  if (base === "none") return { id, base, label: lab, toolName: "", prep: () => ({ env: {}, shell: false, cleanup() {} }) };
  if (base === "ab-cli") return { id, base, label: lab, toolName: "agent-browser CLI", prep(r, home) {
    const { bin, f } = shim(r, home, abBin(lab));
    const stub = readFileSync(join(ABDIR(lab), "skills/agent-browser/SKILL.md"), "utf8").replace(/^---[\s\S]*?---\n/, "");
    const sess = () => { const t = Bun.spawnSync([f, "session", "id", "--scope", "worktree", "--prefix", "task"], { cwd: r }).stdout.toString().trim(); return t; };
    const restricted = SHELL_MODE === "restricted"; if (restricted) linkTextTools(bin);
    const host = join(r, "host"); if (restricted && RUNNER === "claude") linkHostTools(host); // claude finds its login through `security`
    return { restricted, env: { PATH: restricted ? (RUNNER === "claude" ? `${bin}:${host}` : bin) : `${bin}:${SYS_PATH}` }, systemPrompt: stub, shell: true,
      warm() { Bun.spawnSync([f, "open", "about:blank"], { cwd: r, timeout: 60000 }); const t = sess(); if (t) Bun.spawnSync([f, "--session", t, "open", "about:blank"], { cwd: r, timeout: 60000 }); },
      cleanup() { Bun.spawnSync([f, "close", "--all"], { timeout: 30000 }); } }; } };
  if (base === "ab-mcp" || base === "ab-mcp-min") return { id, base, label: lab, toolName: "agent_browser MCP tools", prep(r, home) {
    const { f } = shim(r, home, abBin(lab));
    const env = { HOME: home, AGENT_BROWSER_EXECUTABLE_PATH: CHROME, PATH: SYS_PATH };
    return { env: {}, shell: false, mcp: { ab: { command: abBin(lab), args: base === "ab-mcp-min" ? ["mcp", "--tools", "minimal"] : ["mcp"], env } },
      warm() { Bun.spawnSync([f, "open", "about:blank"], { cwd: r, timeout: 60000 }); }, cleanup() { Bun.spawnSync([f, "close", "--all"], { timeout: 30000 }); } }; } };
  if (base === "browse-mcp") return { id, base, label: lab, toolName: "browse MCP tools", prep(_r, home) {
    const env = { ...browseEnv, HOME: home, PATH: `${join(NODE, "..")}:${SYS_PATH}` };
    return { env: {}, shell: false, mcp: { browse: { command: NODE, args: [BROWSE_CLI, "mcp"], env } }, cleanup() {} }; } };
  throw new Error("unknown variant " + spec);
}
/** The agent-browser checkout a binary was built from (for its stub), assumed at <bin>/../../.. */
function ABDIR(lab: string) { const b = abBin(lab); return resolve(b, "../../../.."); }

// ---------------- runners ----------------
type RunOut = { events: { t: number; e: any }[]; err: string; wall: number; timedOut: boolean; raw: string; nav?: NavResult | null; /** first human-handoff request, t = ms since spawn; wall is then the charged wall and wall_raw the process wall */ handoff?: (HandoffHit & { t: number }) | null; wall_raw?: number };
/** Navigation recorder (src/nav-recorder.ts), the same method for every tool: browse's Chrome has a fixed debugging port; agent-browser's Chromes are found by process. Start BEFORE warm-up. */
async function startNav(v: Variant): Promise<NavRecorder | null> {
  if (v.base === "none") return null;
  const rec = v.base === "browse-mcp" ? new NavRecorder(fixedPortDiscover(9333)) : new NavRecorder(processDiscover(CHROME, await chromePids(CHROME)));
  await rec.start(); return rec;
}
async function runClaude(v: Variant, prompt: string, runDir: string, timeout: number): Promise<RunOut> {
  const home = join(runDir, "home"); mkdirSync(home, { recursive: true });
  const p = v.prep(runDir, home);
  const rec = await startNav(v);
  if (WARM) p.warm?.();
  await rec?.poll();
  const mcpFile = join(runDir, "mcp.json");
  writeFileSync(mcpFile, JSON.stringify({ mcpServers: p.mcp ?? {} }));
  const mcpNames = Object.keys(p.mcp ?? {});
  const argv0 = [CLAUDE_BIN, "-p", prompt, "--output-format", "stream-json", "--verbose", "--model", MODEL, "--strict-mcp-config", "--mcp-config", mcpFile,
    "--setting-sources", "", "--disable-slash-commands", "--tools", p.shell ? "Bash" : "", "--permission-mode", "bypassPermissions", "--no-session-persistence",
    ...(mcpNames.length ? ["--allowedTools", ...mcpNames.map((n) => `mcp__${n}`)] : p.shell ? ["--allowedTools", "Bash"] : []),
    ...(p.systemPrompt ? ["--append-system-prompt", p.systemPrompt] : [])];
  const argv = p.restricted ? sandboxed(argv0) : argv0;
  // The agent environment is an ALLOWLIST: nothing from the coordinator's shell (tokens, session ids, other agents' variables) reaches the run unless named here.
  // PATH is set below (restricted runs get only the wrapper and text tools). Extra names can be passed with BENCH_ENV_PASS=NAME1,NAME2 (recorded nowhere: use sparingly).
  const env: Record<string, string> = {};
  for (const [k, val] of Object.entries(process.env)) if (val != null && ENV_ALLOW.test(k)) env[k] = val as string;
  Object.assign(env, p.env, { CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1", CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1", NO_COLOR: "1", PATH: p.restricted ? p.env.PATH : `/opt/homebrew/bin:${p.env.PATH ?? process.env.PATH}`, TMPDIR: runDir });
  const t0 = performance.now();
  const proc = Bun.spawn(argv, { cwd: runDir, env, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  const timer = setTimeout(() => proc.kill(), timeout);
  const events: RunOut["events"] = []; let raw = ""; let buf = "";
  const dec = new TextDecoder();
  const errP = new Response(proc.stderr).text();
  let handoff: RunOut["handoff"] = null;
  for await (const ch of proc.stdout as any) { if (handoff) break; buf += dec.decode(ch); raw += dec.decode(ch); let i; while ((i = buf.indexOf("\n")) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (l.startsWith("{")) try { const t = performance.now() - t0, e = JSON.parse(l); events.push({ t, e }); if (HANDOFF === "end" && !handoff) { const h = detectHandoffEvent(e); if (h) { handoff = { ...h, t }; raw = raw.slice(0, raw.length - buf.length); proc.kill(); } } } catch {} if (handoff) { buf = ""; break; } } }
  await proc.exited; clearTimeout(timer);
  const wallRaw = (performance.now() - t0) / 1000, wall = handoff ? handoff.t / 1000 : wallRaw;
  const nav = rec ? await rec.stop() : null;
  p.cleanup();
  return { events, err: await errP, wall, timedOut: !handoff && wall * 1000 >= timeout - 500, raw, nav, handoff, wall_raw: wallRaw };
}
async function runCodex(v: Variant, prompt: string, runDir: string, timeout: number): Promise<RunOut> {
  const home = join(runDir, "home"); mkdirSync(home, { recursive: true });
  const p = v.prep(runDir, home);
  const rec = await startNav(v);
  if (WARM) p.warm?.();
  await rec?.poll();
  const q = JSON.stringify; const tbl = (o: Record<string, string>) => "{" + Object.entries(o).map(([k, x]) => `${k}=${q(x)}`).join(",") + "}";
  const cfg = Object.entries(p.mcp ?? {}).flatMap(([n, m]) => [`mcp_servers.${n}.command=${q(m.command)}`, `mcp_servers.${n}.args=[${m.args.map(q).join(",")}]`, `mcp_servers.${n}.env=${tbl(m.env)}`, `mcp_servers.${n}.startup_timeout_sec=60`]);
  if (p.systemPrompt) writeFileSync(join(runDir, "AGENTS.md"), p.systemPrompt);
  const argv0 = [CODEX_BIN, "exec", "--json", "--skip-git-repo-check", "--ephemeral", "-C", runDir, ...(MODEL ? ["-m", MODEL] : []), ...cfg.flatMap((c) => ["-c", c]), prompt];
  const argv = p.restricted ? sandboxed(argv0) : argv0;
  const t0 = performance.now();
  const proc = Bun.spawn(argv, { cwd: runDir, env: { ...p.env, CODEX_HOME: join(B, ".codex-home"), HOME: home, TERM: "dumb", NO_COLOR: "1", PATH: p.restricted ? p.env.PATH : `/opt/homebrew/bin:${p.env.PATH ?? SYS_PATH}` }, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  const timer = setTimeout(() => proc.kill(), timeout);
  const events: RunOut["events"] = []; let raw = ""; let buf = ""; const dec = new TextDecoder(); const errP = new Response(proc.stderr).text();
  let handoff: RunOut["handoff"] = null;
  for await (const ch of proc.stdout as any) { if (handoff) break; buf += dec.decode(ch); raw += dec.decode(ch); let i; while ((i = buf.indexOf("\n")) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (l.startsWith("{")) try { const t = performance.now() - t0, e = JSON.parse(l); events.push({ t, e }); if (HANDOFF === "end" && !handoff) { const h = detectHandoffEvent(e); if (h) { handoff = { ...h, t }; raw = raw.slice(0, raw.length - buf.length); proc.kill(); } } } catch {} if (handoff) { buf = ""; break; } } }
  await proc.exited; clearTimeout(timer);
  const wallRaw = (performance.now() - t0) / 1000, wall = handoff ? handoff.t / 1000 : wallRaw; const nav = rec ? await rec.stop() : null; p.cleanup();
  return { events, err: await errP, wall, timedOut: !handoff && wall * 1000 >= timeout - 500, raw, nav, handoff, wall_raw: wallRaw };
}
const ENV_ALLOW = new RegExp("^(" + ["HOME", "USER", "LOGNAME", "SHELL", "LANG", "LC_[A-Z]+", "TERM", "TZ", "__CF_USER_TEXT_ENCODING", "ANTHROPIC_API_KEY", "(HTTPS?|ALL|NO)_PROXY", "(https?|all|no)_proxy", "SSL_CERT_(FILE|DIR)", "NODE_EXTRA_CA_CERTS", ...(process.env.BENCH_ENV_PASS ?? "").split(",").filter(Boolean)].join("|") + ")$");
const runAgent = (v: Variant, prompt: string, runDir: string, timeout = TIMEOUT) => (RUNNER === "claude" ? runClaude : runCodex)(v, prompt, runDir, timeout);

// ---------------- parsing ----------------
function parse(out: RunOut, v: Variant, task?: Task) {
  const m: any = { browser_calls: 0, read_calls: 0, outside_fetch: [] as string[], shell_calls: 0, mcp_calls: 0, other_calls: 0, tool_bytes: 0, tool_errors: 0, violations: [] as string[], tools: {} as Record<string, number>, call_latency_ms: [] as number[], used_batch: false, used_run: false, used_chain: false, used_snapshot_flag: false };
  let final = "", inputsText = "", navText = ""; const open = new Map<string, { t: number; name: string }>();
  let tools_listed: string[] = [];
  // Only navigations count for the direct-URL rule (open/navigate/goto/url args), never wait patterns like waitFor({url}).
  const navs = (txt: string, toolInput?: any) => {
    for (const mm of txt.matchAll(/page\.goto\(\s*(["'`])(.*?)\1/g)) navText += mm[2] + "\n";
    for (const mm of txt.matchAll(/agent-browser(?:\s+--\S+(?:\s+\S+)?)*\s+(?:open|navigate|goto)\s+["']?([^\s"'|;&]+)/g)) navText += mm[1] + "\n";
    if (toolInput && typeof toolInput.url === "string") navText += toolInput.url + "\n";
  };
  const noteShell = (cmd: string) => {
    m.shell_calls++; inputsText += cmd + "\n"; navs(cmd);
    const a = analyzeShell(cmd, v.base === "ab-cli");
    if (a.violations.length) m.violations.push(...a.violations.map((x) => `shell: ${x}`));
    if (a.batch) m.used_batch = true; if (a.run) m.used_run = true; if (a.chain) m.used_chain = true; if (a.snapshotFlag) m.used_snapshot_flag = true;
    if (a.subs.some((s) => !["read", "skills", "help", "--help", "version", "--version"].includes(s))) m.browser_calls++;
    m.read_calls += a.subs.filter((s) => s === "read").length;
    m.tools["sh:" + (a.sub ?? "other")] = (m.tools["sh:" + (a.sub ?? "other")] ?? 0) + 1;
  };
  const noteMcp = (name: string, input: any) => {
    m.mcp_calls++; if (!/^(status|settings|session_list|secrets_)/.test(name)) m.browser_calls++; { const of = outsideBrowserFetch(String(input?.code ?? input?.script ?? "")); if (of) m.outside_fetch.push(of); } inputsText += JSON.stringify(input) + "\n"; navs(String(input?.code ?? input?.script ?? ""), /open$/.test(name) ? input : undefined); m.tools[name] = (m.tools[name] ?? 0) + 1;
    if (/batch/.test(name)) m.used_batch = true; if (/_run$|\.run$/.test(name)) m.used_run = true;
    if (/"--snapshot"/.test(JSON.stringify(input))) m.used_snapshot_flag = true;
    if (/batch/.test(name) || (name.endsWith("execute") && /;\s*\S[\s\S]*;/.test(input?.code ?? ""))) m.multi_action_calls = (m.multi_action_calls ?? 0) + 1;
  };
  let peakCtx = 0;
  if (RUNNER === "claude") {
    for (const { t, e } of out.events) {
      if (e.type === "assistant" && e.message?.usage) { const u = e.message.usage; peakCtx = Math.max(peakCtx, (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)); }
      if (e.type === "system" && e.subtype === "init") { tools_listed = e.tools ?? []; m.init_tools = tools_listed; }
      if (e.type === "assistant") for (const c of e.message?.content ?? []) {
        if (c.type === "tool_use") { open.set(c.id, { t, name: c.name }); if (c.name === "Bash") noteShell(c.input?.command ?? ""); else if (c.name.startsWith("mcp__")) noteMcp(c.name.split("__").slice(2).join("__"), c.input); else { m.other_calls++; m.tools["item:" + c.name] = (m.tools["item:" + c.name] ?? 0) + 1; } }
        if (c.type === "text") final = c.text;
      }
      if (e.type === "user") for (const c of e.message?.content ?? []) if (c.type === "tool_result") {
        const txt = typeof c.content === "string" ? c.content : (c.content ?? []).map((x: any) => x.text ?? (x.type === "image" ? "[image]" : "")).join("");
        const bytes = typeof c.content === "string" ? Buffer.byteLength(c.content) : (c.content ?? []).reduce((a: number, x: any) => a + Buffer.byteLength(x.text ?? "") + (x.type === "image" ? (x.source?.data?.length ?? 0) : 0), 0);
        m.tool_bytes += bytes; if (c.is_error) m.tool_errors++;
        const o = open.get(c.tool_use_id); if (o) m.call_latency_ms.push(Math.round(t - o.t));
      }
      if (e.type === "result") {
        const u = e.usage ?? {};
        m.raw_input = u.input_tokens ?? 0; m.cache_creation = u.cache_creation_input_tokens ?? 0; m.cache_read = u.cache_read_input_tokens ?? 0; m.output_tokens = u.output_tokens ?? 0;
        m.num_turns = e.num_turns; m.cost_usd = e.total_cost_usd; m.duration_api_ms = e.duration_api_ms; if (e.is_error) m.error = String(e.result ?? e.subtype).slice(0, 300);
        if (typeof e.result === "string") final = e.result;
      }
    }
    // Spend of a run that never produced a `result` event (timeout/kill): usage from the assistant events seen so far, priced with the fitted rates.
    // Labelled everywhere: cost_src "estimate", cost_partial true (a floor: the turn in flight is lost). Nothing is silently zero.
    if (m.cost_usd === undefined) {
      const pu = partialUsage(out.events); m.cost_partial = true;
      if (pu) { m.raw_input = pu.raw_input; m.cache_creation = pu.cache_creation; m.cache_read = pu.cache_read; m.output_tokens = pu.output_tokens; m.cost_usd = +estimateCostUsd(pu).toFixed(6); m.cost_src = "estimate"; m.usage_src = "partial-events"; m.usage_turns = pu.turns; }
      else { m.cost_src = "none"; m.usage_src = "none"; m.cost_usd = undefined; }
    } else { m.cost_src = "reported"; m.usage_src = "result"; }
    if (m.usage_src === "none") { m.input_tokens = m.cached_input_tokens = m.input_excl_cache = m.output_tokens = null; }
    else { m.input_tokens = m.raw_input + m.cache_creation + m.cache_read; m.cached_input_tokens = m.cache_read; m.input_excl_cache = m.raw_input + m.cache_creation; }
  } else {
    let usage: any;
    for (const { t, e } of out.events) {
      if (e.type === "turn.completed") usage = e.usage;
      if (e.type === "turn.failed" || e.type === "error") m.error = JSON.stringify(e).slice(0, 300);
      const it = e.item; if (!it) continue;
      if (e.type === "item.started" && (it.type === "command_execution" || it.type === "mcp_tool_call")) open.set(it.id, { t, name: it.tool ?? "sh" });
      if (e.type !== "item.completed") continue;
      if (it.type === "agent_message") final = it.text;
      else if (it.type === "command_execution") { noteShell(unwrapCodexCommand(String(it.command ?? ""))) /* Codex wraps the agent's command in `/bin/zsh -lc '...'`: analyse what the agent wrote, not the quoted wrapper */; const o = it.aggregated_output ?? ""; m.tool_bytes += Buffer.byteLength(o); if (it.exit_code) m.tool_errors++; }
      else if (it.type === "mcp_tool_call") { noteMcp(it.tool, it.arguments); m.tool_bytes += Buffer.byteLength(JSON.stringify(it.result?.content ?? it.error ?? "")); if (it.status === "failed" || it.error || it.result?.isError) m.tool_errors++; }
      else if (!["reasoning", "todo_list", "error"].includes(it.type)) { m.other_calls++; m.tools["item:" + it.type] = (m.tools["item:" + it.type] ?? 0) + 1; }
      const o = open.get(it.id); if (o) m.call_latency_ms.push(Math.round(t - o.t));
    }
    // Codex reports usage only in turn.completed and never reports USD: a run cut before it has NO usage (recorded as such, not as zero) and cost_usd is absent by design.
    m.cost_src = "none"; m.usage_src = usage ? "result" : "none"; if (!usage) m.cost_partial = true;
    const u = usage ?? {}; m.input_tokens = usage ? (u.input_tokens ?? 0) : null; m.cached_input_tokens = usage ? (u.cached_input_tokens ?? 0) : null; m.output_tokens = usage ? (u.output_tokens ?? 0) : null; m.input_excl_cache = usage ? m.input_tokens - m.cached_input_tokens : null;
  }
  if (v.base !== "ab-cli" && v.base !== "none" && m.shell_calls) m.violations.push("shell used in an MCP variant");
  if (task?.forbidden && task.forbidden.test(navText)) m.violations.push(`direct-url: navigated to a URL matching ${task.forbidden}`);
  // the same rule over the URLs the browser really navigated to: a URL a script built ("https://host/x/" + name) is no longer invisible
  if (task && forbiddenNavApplies(task) && out.nav?.ok) { const hit = out.nav.urls.find((u) => task.forbidden!.test(u)); if (hit && !m.violations.some((x: string) => x.startsWith("direct-url"))) m.violations.push(`direct-url (recorded navigation): ${hit.slice(0, 100)}`); }
  // semantic API-use check, identical for both tools (src/api-detect.ts); reported apart from violations and never changes success/clean
  m.api_access = apiAccess(inputsText, out.nav?.ok ? out.nav.urls : null); m.api_access_n = m.api_access.length;
  if (task && ENDPOINT === "on") m.violations.push(...endpointViolations(task, m.api_access));
  m.peak_ctx = peakCtx; 
  m.total_excl_cache = m.usage_src === "none" ? null : m.input_excl_cache + m.output_tokens;
  m.cost_weighted = m.usage_src === "none" ? null : Math.round(m.input_excl_cache + 0.1 * m.cached_input_tokens + m.output_tokens);
  m.steps = m.shell_calls + m.mcp_calls + m.other_calls;
  m.median_call_ms = m.call_latency_ms.length ? [...m.call_latency_ms].sort((a: number, b: number) => a - b)[m.call_latency_ms.length >> 1] : null;
  // one definition of "the final message" and "the answer" for both runners (src/scoring.ts); the checker gets m.answer, the marker removed
  final = finalMessage(out.events);
  const sp = splitAnswer(final);
  m.answer = sp.value; m.has_marker = sp.hasMarker; m.final_text = final.slice(0, MAX_FINAL);
  // conduct violations (src/workflow.ts): a final answer with no browser tool call (every suite, every variant); rules v1: plain HTTP outside the browser (`agent-browser read`, node-side fetch)
  m.violations.push(...conductViolations({ isNone: v.base === "none", hasMarker: sp.hasMarker, browserCalls: m.browser_calls, handedOff: !!out.handoff, rulesStated: !!task && rulesOn(task, RULES), readCalls: m.read_calls, outsideFetch: m.outside_fetch }));
  return m;
}

// ---------------- main ----------------
const sha256File = (f: string) => { try { return createHash("sha256").update(readFileSync(f)).digest("hex"); } catch { return "unavailable"; } };
const gitHead = (dir: string) => { const o = Bun.spawnSync(["git", "-C", dir, "rev-parse", "HEAD"]); return o.exitCode === 0 ? o.stdout.toString().trim() : "unavailable"; };
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const OUT = join(B, "results", stamp + (label ? "-" + label : "")); mkdirSync(join(OUT, "transcripts"), { recursive: true });
const meta: any = { started: new Date().toISOString(), contract_version: CONTRACT_VERSION, preflight: PREFLIGHT, runner: RUNNER, model: MODEL || "(codex config)", variants, tasks: wanted.map((t) => t.id), task_suites: Object.fromEntries(wanted.map((t) => [t.id, t.suite])), blind2_file: B2.present, blind3_file: B3.present, n: N, seed: SEED, order: "variant order shuffled within every task x rep block (measure.ts planRuns)", warm: WARM, timeout_s: TIMEOUT / 1000, shell_mode: SHELL_MODE, rules_flag: RULES ?? "default-by-suite", rules_v1_sha256: RULES_V1_SHA256, rules_v1: RULES_V1, shell_restriction: SHELL_MODE === "restricted" ? { path: "agent-browser wrapper + text tools only", exec_deny: "sandbox-exec profile (src/restricted-env.ts)" } : "none", bins: BINS,
  ab_versions: Object.fromEntries(Object.entries(BINS).map(([k, b]) => [k, Bun.spawnSync([b, "--version"]).stdout.toString().trim()])), browse_version: Bun.spawnSync([NODE, BROWSE_CLI, "--version"]).stdout.toString().trim(),
  claude: Bun.spawnSync([CLAUDE_BIN, "--version"]).stdout.toString().trim(), chrome: CHROME,
  // provenance of what actually ran, so a later reader can check it against the preregistration
  bin_sha256: Object.fromEntries(Object.entries(BINS).map(([k, b]) => [k, sha256File(b)])),
  stub_sha256: Object.fromEntries(Object.keys(BINS).map((k) => [k, sha256File(join(ABDIR(k), "skills/agent-browser/SKILL.md"))])),
  task_file_sha256: Object.fromEntries(["src/tasks.ts", "blind/tasks.ts", "blind2/tasks.ts", "blind3/tasks.ts"].filter((f) => existsSync(join(B, f))).map((f) => [f, sha256File(join(B, f))])),
  ab_commit: Object.fromEntries(Object.keys(BINS).map((k) => [k, gitHead(ABDIR(k))])), browse_commit: gitHead(join(ROOT, "browse")),
  os: [Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(), Bun.spawnSync(["uname", "-mrs"]).stdout.toString().trim()].join(" / ") };
writeFileSync(join(OUT, "meta.json"), JSON.stringify(meta, null, 2));
console.log(`results -> ${OUT}`);

const needsBrowse = variants.some((v) => v.startsWith("browse-mcp"));
if (needsBrowse) await ensureBrowse();

async function staticCost() {
  const rows: any[] = [];
  for (const id of ["none", ...variants]) {
    const v = makeVariant(id); const runDir = mkdtempSync("/tmp/bd-static-");
    const r = await runAgent(v, "Say hi.", runDir, 120000); const { m } = parse(r, v);
    const init = r.events.find((x) => x.e.type === "system" && x.e.subtype === "init")?.e;
    rows.push({ variant: id, input_tokens: m.input_tokens, cached: m.cached_input_tokens, input_excl_cache: m.input_excl_cache, output: m.output_tokens, tools_listed: init?.tools, mcp_servers: init?.mcp_servers?.map((s: any) => s.name + ":" + s.status), skills: init?.skills, wall: r.wall });
    rmSync(runDir, { recursive: true, force: true });
  }
  const base = rows[0].input_tokens; for (const r of rows) r.static_tokens_vs_none = r.input_tokens - base;
  const adv: any = {};
  for (const id of variants) { const [bse, lab = "main"] = id.split(":"); if (bse === "ab-mcp" || bse === "ab-mcp-min") adv[id] = await mcpAdvertised([abBin(lab), "mcp", ...(bse === "ab-mcp-min" ? ["--tools", "minimal"] : [])], { HOME: join(OUT, "adv-home"), AGENT_BROWSER_EXECUTABLE_PATH: CHROME, PATH: SYS_PATH }); if (bse === "browse-mcp") adv[id] = await mcpAdvertised([NODE, BROWSE_CLI, "mcp"], { ...browseEnv, PATH: SYS_PATH } as any); }
  for (const r of rows) if (adv[r.variant]) r.advertised = adv[r.variant];
  writeFileSync(join(OUT, "static.json"), JSON.stringify(rows, null, 2)); console.log("static:", JSON.stringify(rows.map((r) => [r.variant, r.input_tokens, r.static_tokens_vs_none, r.tools_listed])));
}
if (args.get("static") !== "false") await staticCost();
if (args.get("skip-runs") === "true") process.exit(0);

const plan = planRuns(wanted, variants, N, SEED);
const t0 = Date.now(); let aborted = "";
for (const [i, { task, rep, v, pos }] of plan.entries()) {
  const runDir = mkdtempSync("/tmp/bd-run-"); const variant = makeVariant(v);
  const rulesStated = rulesOn(task, RULES);
  const prompt = taskPrompt(task.prompt(BASE), variant.toolName, rulesStated);
  if (v.startsWith("browse-mcp")) { await ensureBrowse(); await resetBrowse(); }
  const pre = task.prepare ? await task.prepare().catch(() => undefined) : undefined;
  const r = await runAgent(variant, prompt, runDir);
  const m = parse(r, variant, task);
  if (v.startsWith("browse-mcp")) await resetBrowse();
  // Scoring contract (src/scoring.ts): marker gate, checker, evidence.
  const errorText = (m.error ?? "") + "\n" + r.err + "\n" + r.raw.slice(-600);
  const sc = await scoreRun(task, { events: r.events, timedOut: r.timedOut, handedOff: !!r.handoff, pre, errorText, navigated: r.nav?.ok ? r.nav.urls : null });
  const chk: any = { ok: sc.ok, truth: sc.truth, note: sc.note };
  const evidenceMissingRaw = sc.evidenceMissingRaw, evidenceMissing = sc.evidenceMissing;
  const answerOk = sc.answerOk, passed = sc.passed, status = sc.status;
  const failNote = passed ? undefined : status === "handoff" ? "handoff: " + (r.handoff?.message ?? "").slice(0, 160) : status === "quota_abort" ? "provider limit: " + (m.error ?? r.err.slice(0, 120)) : (m.error ?? chk.note ?? (answerOk ? "evidence missing: " + evidenceMissing.join("; ") : r.timedOut ? "timeout" : undefined));
  // Prepare-time truth and the snapshots the verdict used are stored so that rescoring never depends on live data (JSON round trip; huge states are flagged, not silently cut).
  const keep = (x: any, cap = 200_000) => { if (x === undefined) return { v: undefined as any, trunc: false }; const j = JSON.stringify(x); return j.length > cap ? { v: { __truncated_bytes: j.length }, trunc: true } : { v: JSON.parse(j), trunc: false }; };
  const kp = keep(pre), ks = keep(sc.state);
  const wf = task.workflow ? scoreWorkflow(task, m.violations, { ...transcriptFromEvents(r.events), navigated: r.nav?.ok ? r.nav.urls : null }) : null;
  const stored = { pre: kp.v, pre_error: pre?.__err, truth_state: ks.v, state_truncated: kp.trunc || ks.trunc || undefined, checker: checkerVersion(task.suite) };
  // success = right answer AND evidence; clean = success AND no rule violations (compliant success, the primary success metric)
  const row = {
    run: i + 1, task: task.id, suite: task.suite, variant: v, rep, seed: SEED, order_pos: pos, status,
    success: passed && !r.timedOut,
    clean: passed && !r.timedOut && m.violations.length === 0,
    answer_ok: answerOk, evidence_missing: evidenceMissing, evidence_missing_raw: evidenceMissingRaw,
    truth: chk.truth, ...stored,
    navigated_urls: r.nav?.ok ? r.nav.urls : null,
    nav_recorder: r.nav ? { ok: r.nav.ok, method: r.nav.method, events: r.nav.events, endpoints: r.nav.endpoints, initial_urls: r.nav.initial_urls, errors: r.nav.errors } : null,
    ...(wf ? { workflow_ok: wf.ok, workflow_missing: wf.missing, workflow_deeplink: wf.deepLink } : {}),
    rules: rulesStated ? "v1" : "off", ...(rulesStated ? { rules_sha256: RULES_V1_SHA256 } : {}),
    wall_s: +r.wall.toFixed(1),
    ...(r.handoff ? { handoff: true, handoff_at_s: +(r.handoff.t / 1000).toFixed(1), handoff_tool: r.handoff.tool, handoff_via: r.handoff.via, handoff_message: r.handoff.message, wall_raw_s: +(r.wall_raw ?? r.wall).toFixed(1) } : {}),
    timed_out: r.timedOut, timeout_s: TIMEOUT / 1000,
    ...m, failure_note: failNote,
  };
  appendFileSync(join(OUT, "runs.jsonl"), JSON.stringify(row) + "\n");
  writeFileSync(join(OUT, "transcripts", `${task.id}-${v.replace(/:/g, "_")}-${rep}.jsonl`), r.raw);
  if (r.err.trim()) writeFileSync(join(OUT, "transcripts", `${task.id}-${v.replace(/:/g, "_")}-${rep}.stderr`), r.err);
  console.log(`[${i + 1}/${plan.length}] ${task.id} ${v} #${rep}: ${row.status === "quota_abort" ? "QUOTA" : row.status === "handoff" ? "HANDOFF" : row.clean ? "OK " : row.success ? "OK(unclean)" : "FAIL"} ${row.wall_s}s steps=${m.steps} usd=${m.cost_usd}${m.cost_src === "estimate" ? "(est)" : ""} in_ex=${m.input_excl_cache} cw=${m.cost_weighted}(proxy) out=${m.output_tokens} viol=${m.violations.length} nav=${r.nav ? (r.nav.ok ? r.nav.urls.length : "FAILED") : "-"} batch=${+m.used_batch} run=${+m.used_run} ans=${JSON.stringify(m.answer.slice(0, 60))} truth=${JSON.stringify(String(chk.truth).slice(0, 40))}`);
  rmSync(runDir, { recursive: true, force: true });
  if (status === "quota_abort") { aborted = "provider usage/rate limit"; console.error("ABORT: " + aborted); break; }
}
meta.finished = new Date().toISOString(); meta.elapsed_min = +((Date.now() - t0) / 60000).toFixed(1); if (aborted) meta.aborted = aborted;
writeFileSync(join(OUT, "meta.json"), JSON.stringify(meta, null, 2));
summarize(OUT);
server.stop(); process.exit(0);
