// No-LLM regression test for the "agent opens a NEW named session" failure (every new session died with `Auto-launch failed: CDP response channel closed`
// inside the exec-deny sandbox, because Chrome cannot apply its own Seatbelt sandbox under an inherited profile; see CHROME_IN_SANDBOX_ARGS in src/restricted-env.ts).
// For each ab-cli binary it builds the exact ab-cli run environment (wrapper from shimScript, text-tools PATH, exec-deny sandbox, per-run HOME/TMPDIR, same
// /bin/sh login-free shell) and: (1) opens a brand-new named session with NO warm session, (2) warms like run.ts and then opens a second new session,
// (3) checks the sandbox still blocks curl/python3. Needs a browser: run under the lock.
//   ../with-lock.sh bun tests/new-session.ts [--ab-bin <path>]...     (default: every built ab-cli variant checkout)
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, readdirSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { handle } from "../src/fixtures.ts";
import { linkTextTools, linkHostTools, sandboxed, shimScript, sandboxAvailable } from "../src/restricted-env.ts";

const B = resolve(import.meta.dir, ".."), ROOT = resolve(B, "..");
const argv = process.argv.slice(2);
const bins = argv.flatMap((a, i) => (a === "--ab-bin" ? [resolve(argv[i + 1])] : []));
if (!bins.length) bins.push(...readdirSync(ROOT).map((d) => join(ROOT, d, "cli/target/release/agent-browser")).filter(existsSync));
if (!sandboxAvailable()) { console.log("SKIP: needs macOS sandbox-exec"); process.exit(0); }
const d = join(B, ".cache/chrome"); const v = readdirSync(d).find((x) => x.startsWith("mac"))!;
const CHROME = join(d, v, readdirSync(join(d, v))[0], "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: handle }); const BASE = `http://127.0.0.1:${server.port}`;
let failures = 0; const check = (n: string, ok: boolean, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${n} ${detail}`); if (!ok) failures++; };

for (const abBin of bins) {
  const tag = abBin.replace(ROOT + "/", "").split("/")[0];
  const run = mkdtempSync("/tmp/bd-run-"); const home = join(run, "home"); mkdirSync(home); const bin = join(run, "bin"); mkdirSync(bin);
  writeFileSync(join(bin, "agent-browser"), shimScript(home, CHROME, abBin, !process.env.UNFIXED)); chmodSync(join(bin, "agent-browser"), 0o755);
  linkTextTools(bin); const host = join(run, "host"); linkHostTools(host);
  // same environment run.ts gives the agent: PATH = wrapper+text tools (+ security), TMPDIR = run dir, real HOME is overridden by the wrapper
  const sh = async (cmd: string, timeout = 90000) => {
    const p = Bun.spawn(sandboxed(["/bin/sh", "-c", cmd]), { cwd: run, env: { HOME: process.env.HOME ?? "/", USER: process.env.USER ?? "", TERM: "dumb", NO_COLOR: "1", PATH: `${bin}:${host}`, TMPDIR: run }, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
    const t = setTimeout(() => p.kill(), timeout); const code = await p.exited; clearTimeout(t);
    return { code, out: (await new Response(p.stdout).text()) + (await new Response(p.stderr).text()) };
  };
  const real = await sh("command -v agent-browser");
  check(`[${tag}] the wrapper is the agent-browser the agent gets`, real.out.trim() === join(bin, "agent-browser"), real.out.trim());
  const a = await sh(`agent-browser --session fresh-a open ${BASE}/catalog && agent-browser --session fresh-a get title`);
  check(`[${tag}] a new named session launches inside the sandbox with no warm session`, a.code === 0 && !/Auto-launch failed/.test(a.out), JSON.stringify(a.out.trim().slice(0, 120)));
  Bun.spawnSync([join(bin, "agent-browser"), "open", "about:blank"], { cwd: run, timeout: 60000 }); // harness warm-up, outside the sandbox, as in run.ts
  const b = await sh(`agent-browser --session fresh-b open ${BASE}/catalog && agent-browser --session fresh-b get url`);
  check(`[${tag}] a second new session works next to the warm one`, b.code === 0 && !/Auto-launch failed/.test(b.out) && b.out.includes(BASE), JSON.stringify(b.out.trim().slice(0, 120)));
  for (const cmd of ["curl --version", "/usr/bin/curl --version", "python3 -V", "node -v"]) { const r = await sh(cmd); check(`[${tag}] ${cmd} is still blocked`, r.code !== 0, JSON.stringify(r.out.trim().slice(0, 60))); }
  Bun.spawnSync([join(bin, "agent-browser"), "close", "--all"], { timeout: 30000 }); rmSync(run, { recursive: true, force: true });
}
server.stop(); console.log(failures ? `${failures} FAILED` : "all passed"); process.exit(failures ? 1 : 0);
