// Synthetic end-to-end proof for the navigation recorder, no LLM: a SCRIPT builds URLs in a loop ("base/" + name) in each tool, so the transcript
// never contains the final URL, and the recorder must still see the pages. Needs browsers: run it under the lock.
//   bun tests/nav-synthetic.ts [--ab-bin <path>]
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { handle } from "../src/fixtures.ts";
import { NavRecorder, fixedPortDiscover, processDiscover, chromePids } from "../src/nav-recorder.ts";

const B = resolve(import.meta.dir, ".."), ROOT = resolve(B, "..");
const argv = process.argv.slice(2); const abBin = resolve(argv[argv.indexOf("--ab-bin") + 1] ?? join(ROOT, "agent-browser-r8/cli/target/release/agent-browser"));
const d = join(B, ".cache/chrome"); const v = readdirSync(d).find((x) => x.startsWith("mac"))!;
const CHROME = join(d, v, readdirSync(join(d, v))[0], "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
const NODE = Bun.which("node")!, BROWSE_CLI = join(ROOT, "browse/cli/dist/cli.mjs");
const browseEnv = { OPENCODE_BROWSER_HOME: join(B, ".browse-home"), OPENCODE_BROWSER_AUTO_UPDATE: "off", OPENCODE_BROWSER_UPDATE_CHECK: "0", XDG_CONFIG_HOME: join(B, ".xdg/config"), XDG_DATA_HOME: join(B, ".xdg/data"), XDG_STATE_HOME: join(B, ".xdg/state"), XDG_CACHE_HOME: join(B, ".xdg/cache") };
const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: handle }); const BASE = `http://127.0.0.1:${server.port}`;
const PAGES = ["catalog", "table", "docs"]; let failures = 0;
const check = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`); if (!ok) failures++; };

// ---- ab-cli: the script builds the URL; the command text only has the pieces ----
{
  const run = mkdtempSync("/tmp/bd-navsyn-"); const home = join(run, "home"); mkdirSync(home, { recursive: true }); const bin = join(run, "bin"); mkdirSync(bin);
  const f = join(bin, "agent-browser");
  writeFileSync(f, `#!/bin/sh\nexport HOME=${JSON.stringify(home)} AGENT_BROWSER_EXECUTABLE_PATH=${JSON.stringify(CHROME)}\nexec ${JSON.stringify(abBin)} "$@"\n`); chmodSync(f, 0o755);
  const rec = new NavRecorder(processDiscover(CHROME, await chromePids(CHROME)), 250);
  await rec.start();
  Bun.spawnSync([f, "open", "about:blank"], { cwd: run, timeout: 60000 }); // same warm-up as run.ts, before the agent starts
  await rec.poll();
  const script = `const base = ${JSON.stringify(BASE.replace("://", ":/") + "/")};\nfor (const name of ${JSON.stringify(PAGES)}) { page.goto(base.replace(":/", "://") + name); }\nreturn "done";`;
  const sp = Bun.spawn(["sh", "-c", `${f} run - <<'JS'\n${script}\nJS`], { cwd: run, stdout: "pipe", stderr: "pipe" }); // async: the fixture server lives in this process
  const p = { exitCode: await sp.exited, stdout: await new Response(sp.stdout).text(), stderr: await new Response(sp.stderr).text() };
  await Bun.sleep(600);
  const r = await rec.stop();
  Bun.spawnSync([f, "close", "--all"], { timeout: 30000 });
  const text = script; const want = PAGES.map((n) => `${BASE}/${n}`);
  check("ab-cli: script ran", p.exitCode === 0, p.stdout.slice(0, 80).replace(/\n/g, " ") + p.stderr.slice(0, 120));
  check("ab-cli: final URLs are NOT in the command text", want.every((u) => !text.includes(u)));
  check("ab-cli: every constructed URL was recorded", want.every((u) => r.urls.includes(u)), JSON.stringify(r.urls));
  check("ab-cli: recorder healthy", r.ok && r.errors.length === 0, JSON.stringify(r.errors));
  rmSync(run, { recursive: true, force: true });
}

// ---- browse-mcp: same idea through its MCP `execute` tool ----
{
  const up = await fetch("http://127.0.0.1:9333/json/version").then((r) => r.ok, () => false);
  if (!up) { check("browse: relay Chrome on 9333 is up", false, "start the bench relay first (bun run bench starts it)"); }
  else {
    Bun.spawnSync([NODE, BROWSE_CLI, "tabs", "cleanup", "--idle-minutes", "0"], { env: { ...process.env, ...browseEnv }, timeout: 30000 });
    const rec = new NavRecorder(fixedPortDiscover(9333), 250); await rec.start();
    const p = Bun.spawn([NODE, BROWSE_CLI, "mcp"], { env: { ...browseEnv, HOME: mkdtempSync("/tmp/bd-navsyn-h-"), PATH: `${join(NODE, "..")}:/usr/bin:/bin` }, stdin: "pipe", stdout: "pipe", stderr: "ignore" });
    const dec = new TextDecoder(); let buf = ""; const waiters = new Map<number, (m: any) => void>();
    (async () => { for await (const ch of p.stdout as any) { buf += dec.decode(ch); let i; while ((i = buf.indexOf("\n")) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); try { const m = JSON.parse(l); if (m.id != null) waiters.get(m.id)?.(m); } catch {} } } })();
    let id = 0; const send = (o: any) => p.stdin.write(JSON.stringify(o) + "\n");
    const call = (method: string, params: any = {}) => new Promise<any>((res, rej) => { const i = ++id; waiters.set(i, res); send({ jsonrpc: "2.0", id: i, method, params }); setTimeout(() => rej(new Error("timeout " + method)), 60000); });
    await call("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "navsyn", version: "1" } }); send({ jsonrpc: "2.0", method: "notifications/initialized" });
    const code = `const base = ${JSON.stringify(BASE.replace("://", ":/") + "/")};\nfor (const name of ${JSON.stringify(PAGES)}) { await page.goto(base.replace(":/", "://") + name); }\nreturn "done";`;
    const res = await call("tools/call", { name: "execute", arguments: { code } });
    await Bun.sleep(600);
    const r = await rec.stop(); p.kill();
    Bun.spawnSync([NODE, BROWSE_CLI, "tabs", "cleanup", "--idle-minutes", "0"], { env: { ...process.env, ...browseEnv }, timeout: 30000 });
    const want = PAGES.map((n) => `${BASE}/${n}`);
    check("browse: tool call succeeded", !res.result?.isError && !res.error, JSON.stringify(res.result?.content ?? res.error).slice(0, 100));
    check("browse: final URLs are NOT in the call text", want.every((u) => !code.includes(u)));
    check("browse: every constructed URL was recorded", want.every((u) => r.urls.includes(u)), JSON.stringify(r.urls));
    check("browse: recorder healthy", r.ok && r.errors.length === 0, JSON.stringify(r.errors));
  }
}
server.stop(true);
console.log(failures ? `${failures} FAILED` : "all passed"); process.exit(failures ? 1 : 0);
