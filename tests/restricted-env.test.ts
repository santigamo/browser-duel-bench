import { test, expect } from "bun:test";
import { mkdtempSync, readdirSync, lstatSync } from "node:fs";
import { join } from "node:path";
import { linkTextTools, execDenyProfile, sandboxed, sandboxAvailable, TEXT_TOOLS, DENIED } from "../src/restricted-env.ts";
import { apiAccess, looksLikeApi } from "../src/api-detect.ts";
import { analyzeShell } from "../src/shell-check.ts";
import { transcriptFromEvents } from "../src/measure.ts";

test("the browser-only bin dir has the text utilities and none of the forbidden programs", () => {
  const d = mkdtempSync("/tmp/bd-rbin-"); const linked = linkTextTools(d);
  expect(linked).toContain("grep"); expect(linked).toContain("head"); expect(linked).toContain("sleep");
  const names = readdirSync(d); for (const n of names) expect(lstatSync(join(d, n)).isSymbolicLink()).toBe(true);
  for (const bad of ["curl", "wget", "python3", "node", "perl", "ruby", "bun"]) { expect(names).not.toContain(bad); expect(TEXT_TOOLS).not.toContain(bad); }
  for (const bad of ["curl", "wget", "python3", "node", "perl"]) expect(DENIED.join("|") + "|python|node").toContain(bad.replace(/3$/, ""));
});
const mac = sandboxAvailable();
test.skipIf(!mac)("under the exec-deny profile a login shell cannot run curl/python3/node even by absolute path (PATH alone cannot guarantee that)", () => {
  const sh = (cmd: string) => Bun.spawnSync(sandboxed(["/bin/zsh", "-lc", cmd]), { env: { HOME: "/tmp", PATH: "/nonexistent" } });
  for (const cmd of ["curl --version", "/usr/bin/curl --version", "python3 -V", "/usr/bin/python3 -V", "wget --version", "node -v", "perl -v"]) {
    const r = sh(cmd); expect(r.exitCode, cmd).not.toBe(0);
  }
  expect(sh("echo hi | /usr/bin/head -c 2 | /usr/bin/tr a-z A-Z").stdout.toString()).toBe("HI");
  // and the profile alone, with the PATH-restricted environment of the run: the login shell re-adds /usr/bin, the deny list still holds
  const d = mkdtempSync("/tmp/bd-rbin-"); linkTextTools(d);
  const r = Bun.spawnSync(sandboxed(["/bin/zsh", "-lc", "command -v grep >/dev/null && curl --version"]), { env: { HOME: "/tmp", PATH: d } });
  expect(r.exitCode).not.toBe(0); expect(r.stderr.toString()).toMatch(/not permitted|denied/i);
});
test("the violation detector still records an attempt", () => {
  expect(analyzeShell("curl -s https://x.example/api | head", true).violations.length).toBe(1);
  expect(analyzeShell("/usr/bin/python3 -c 'print(1)'", true).violations.length).toBe(1);
});

// ---- semantic API detector: same input shape for both tools ----
test("api shape recognises API endpoints and leaves ordinary pages alone", () => {
  for (const u of ["https://api.github.com/repos/casey/just/releases", "https://formulae.brew.sh/api/formula/git.json", "https://hn.algolia.com/api/v1/search?query=x", "https://proxy.golang.org/github.com/rs/zerolog/@v/list", "https://registry.npmjs.org/left-pad", "/api/items", "https://x.example/v2/things"]) expect(looksLikeApi(u), u).toBe(true);
  for (const u of ["https://github.com/casey/just/releases", "https://pkg.go.dev/github.com/rs/zerolog?tab=versions", "https://news.ycombinator.com/item?id=1", "http://127.0.0.1:4173/catalog"]) expect(looksLikeApi(u), u).toBe(false);
});
test("apiAccess: a navigated API URL and an in-page fetch are found the same way for a CLI heredoc and for an MCP call", () => {
  const cli = transcriptFromEvents([{ e: { type: "assistant", message: { content: [{ type: "tool_use", id: "1", name: "Bash", input: { command: "agent-browser run - <<'JS'\nconst r = await fetch('/api/v1/search?q=x');\nreturn r.text();\nJS" } }] } } }]);
  const mcp = transcriptFromEvents([{ e: { type: "assistant", message: { content: [{ type: "tool_use", id: "1", name: "mcp__browse__execute", input: { code: "const r = await fetch('/api/v1/search?q=x'); return await r.text();" } }] } } }]);
  const codex = transcriptFromEvents([{ e: { type: "item.completed", item: { type: "mcp_tool_call", arguments: { code: "const r = await fetch('/api/v1/search?q=x');" }, result: { content: [] } } } }]);
  for (const t of [cli, mcp, codex]) { const f = apiAccess(t.inputs, null); expect(f.map((x) => x.kind)).toEqual(["script-api-call"]); }
  const nav = apiAccess("", ["https://example.org/page", "https://api.example.org/v1/things"]);
  expect(nav).toEqual([{ kind: "navigated-api-url", url: "https://api.example.org/v1/things" }]);
  expect(apiAccess("page.goto('https://pkg.go.dev/x')", ["https://pkg.go.dev/x"])).toEqual([]);
  expect(apiAccess("const u = base + name; await fetch(u)", null).map((x) => x.url)).toEqual(["(non-literal URL)"]);
});

import { unwrapCodexCommand } from "../src/measure.ts";
test("violation detector sees Codex shell calls through the zsh -lc wrapper (the wrapper's quotes used to hide the program)", () => {
  const raw = [`/bin/zsh -lc 'curl --version'`, `/bin/zsh -lc "python3 -c \\"print(1)\\""`, `/bin/zsh -lc 'curl -s http://x | head'`];
  for (const c of raw) expect(analyzeShell(unwrapCodexCommand(c), true).violations.length, c).toBe(1);
  expect(analyzeShell(`/bin/zsh -lc 'curl --version'`, true).violations.length).toBe(0);   // what the old code analysed
  const ok = analyzeShell(unwrapCodexCommand(`/bin/zsh -lc "agent-browser run - <<'JS'\nreturn 6 * 7;\nJS"`), true);
  expect(ok.violations).toEqual([]); expect(ok.run).toBe(true);
});

import { shimScript, CHROME_IN_SANDBOX_ARGS } from "../src/restricted-env.ts";
test("the ab-cli wrapper runs Chrome without its own sandbox only in restricted runs (Chrome cannot nest Seatbelt inside the exec-deny profile)", () => {
  const r = shimScript("/h", "/c", "/ab", true), o = shimScript("/h", "/c", "/ab", false);
  expect(r).toContain(`AGENT_BROWSER_ARGS=${JSON.stringify(CHROME_IN_SANDBOX_ARGS)}`); expect(CHROME_IN_SANDBOX_ARGS).toBe("--no-sandbox");
  expect(o).not.toContain("AGENT_BROWSER_ARGS");
  for (const s of [r, o]) { expect(s).toContain('export HOME="/h"'); expect(s).toContain('AGENT_BROWSER_EXECUTABLE_PATH="/c"'); expect(s).toContain('exec "/ab" "$@"'); }
});
