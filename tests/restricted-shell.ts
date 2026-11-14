// No-LLM check of the browser-only shell: inside the exact environment ab-cli runs get (restricted PATH dir + exec-deny sandbox), agent-browser still
// runs a heredoc script against a page, text tools work, and curl/python3/node/wget fail (by name and by absolute path). Needs a browser: run under the lock.
//   bun tests/restricted-shell.ts [--ab-bin <path>]
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { handle } from "../src/fixtures.ts";
import { linkTextTools, sandboxed, shimScript } from "../src/restricted-env.ts";

const B = resolve(import.meta.dir, ".."), ROOT = resolve(B, "..");
const argv = process.argv.slice(2); const abBin = resolve(argv[argv.indexOf("--ab-bin") + 1] ?? join(ROOT, "agent-browser-r8/cli/target/release/agent-browser"));
const d = join(B, ".cache/chrome"); const v = readdirSync(d).find((x) => x.startsWith("mac"))!;
const CHROME = join(d, v, readdirSync(join(d, v))[0], "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: handle }); const BASE = `http://127.0.0.1:${server.port}`;
const run = mkdtempSync("/tmp/bd-rsh-"); const home = join(run, "home"); mkdirSync(home); const bin = join(run, "bin"); mkdirSync(bin);
writeFileSync(join(bin, "agent-browser"), shimScript(home, CHROME, abBin, true)); chmodSync(join(bin, "agent-browser"), 0o755);
const tools = linkTextTools(bin);
let failures = 0; const check = (n: string, ok: boolean, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${n} ${detail}`); if (!ok) failures++; };
// same flow as run.ts: warm the browser from the harness, then the agent's shell
Bun.spawnSync([join(bin, "agent-browser"), "open", "about:blank"], { cwd: run, timeout: 60000 });
const sh = async (cmd: string) => { const p = Bun.spawn(sandboxed(["/bin/zsh", "-lc", cmd]), { cwd: run, env: { HOME: home, PATH: bin }, stdout: "pipe", stderr: "pipe" }); const code = await p.exited; return { code, out: await new Response(p.stdout).text(), err: await new Response(p.stderr).text() }; };
console.log("text tools linked:", tools.join(" "));
const r1 = await sh(`agent-browser run - <<'JS'\npage.goto(${JSON.stringify(BASE + "/catalog")});\nreturn page.evaluate(() => document.title);\nJS`);
check("agent-browser run - <<'JS' works in the restricted shell", r1.code === 0 && r1.out.trim().length > 0, JSON.stringify(r1.out.trim().slice(0, 60)) + r1.err.slice(0, 100));
const r2 = await sh(`echo "a b c" | cut -d' ' -f2 | tr a-z A-Z && agent-browser get url | head -c 40`);
check("text tools + agent-browser in a pipe", r2.code === 0 && r2.out.startsWith("B"), JSON.stringify(r2.out.slice(0, 60)));
for (const cmd of ["curl --version", "/usr/bin/curl --version", "python3 -V", "/usr/bin/python3 -V", "node -v", "wget -V", "perl -v"]) {
  const r = await sh(cmd); check(`${cmd} fails`, r.code !== 0, JSON.stringify((r.err || r.out).trim().slice(0, 70)));
}
const r3 = await sh("echo $PATH; command -v curl || echo no-curl-on-path");
console.log("PATH inside the login shell:", r3.out.split("\n")[0].slice(0, 90), "...");
Bun.spawnSync([join(bin, "agent-browser"), "close", "--all"], { timeout: 30000 });
rmSync(run, { recursive: true, force: true }); server.stop(true);
console.log(failures ? `${failures} FAILED` : "all passed"); process.exit(failures ? 1 : 0);
