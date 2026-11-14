import { test, expect } from "bun:test";
import { NavRecorder, chromeMains, isIgnorableUrl } from "../src/nav-recorder.ts";

// A fake Chrome browser endpoint speaking the one CDP method the recorder uses.
function fakeChrome(initial: { id: string; type: string; url: string }[]) {
  let sock: any; const sent: any[] = [];
  const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch(req, s) { return s.upgrade(req) ? undefined : new Response("no"); },
    websocket: { open(ws) { sock = ws; }, message(ws, m) {
      const d = JSON.parse(String(m)); sent.push(d.method);
      if (d.method === "Target.setDiscoverTargets") { for (const t of initial) ws.send(JSON.stringify({ method: "Target.targetCreated", params: { targetInfo: { targetId: t.id, type: t.type, url: t.url } } })); ws.send(JSON.stringify({ id: d.id, result: {} })); }
    } } });
  const info = (id: string, url: string, type = "page") => sock.send(JSON.stringify({ method: "Target.targetInfoChanged", params: { targetInfo: { targetId: id, type, url } } }));
  return { url: `ws://127.0.0.1:${server.port}/devtools/browser/x`, info, sent, destroy: (id: string) => sock.send(JSON.stringify({ method: "Target.targetDestroyed", params: { targetId: id } })), close: () => server.stop(true) };
}

test("records committed main-frame navigations, including a URL a script built in a loop; only discovery is subscribed", async () => {
  const c = fakeChrome([{ id: "T1", type: "page", url: "https://stale.example/left-over" }, { id: "T2", type: "page", url: "about:blank" }, { id: "W", type: "service_worker", url: "https://sw.example/sw.js" }]);
  const rec = new NavRecorder(() => [c.url], 20); await rec.start();
  for (const name of ["alpha", "beta"]) { c.info("T2", "https://host.example/x/" + name); await Bun.sleep(10); }   // the "https://host/x/"+name loop
  c.info("T2", "https://host.example/x/beta"); c.info("T2", "https://host.example/x/beta"); // title-only updates repeat the url
  c.info("T2", "chrome-error://chromewebdata/"); c.info("T1", "chrome-extension://abc/onboarding.html"); c.info("W", "https://sw.example/other", "service_worker");
  await Bun.sleep(40);
  const r = await rec.stop(); c.close();
  expect(r.ok).toBe(true);
  expect(r.urls).toEqual(["https://host.example/x/alpha", "https://host.example/x/beta"]);
  expect(r.initial_urls).toEqual(["https://stale.example/left-over"]);   // present before the run, not credited to it
  expect(c.sent).toEqual(["Target.setDiscoverTargets"]);                  // no Page/Network/Runtime domain, nothing attached
});
test("two browsers (ab-cli opens a second Chrome mid-run) are both followed; a dead endpoint is reported, not hidden", async () => {
  const a = fakeChrome([]), b = fakeChrome([]); let avail = [a.url];
  const rec = new NavRecorder(() => avail, 15); await rec.start();
  a.info("A", "https://one.example/");
  avail = [a.url, b.url, "ws://127.0.0.1:1/devtools/browser/dead"]; await Bun.sleep(120);
  b.info("B", "https://two.example/p?q=1"); await Bun.sleep(30);
  const r = await rec.stop(); a.close(); b.close();
  expect(r.urls).toEqual(["https://one.example/", "https://two.example/p?q=1"]);
  expect(r.endpoints).toBe(3); expect(r.errors.some((e) => e.includes("dead"))).toBe(true);
});
test("no reachable browser at all is a recorded failure, never an empty success", async () => {
  const rec = new NavRecorder(() => [], 15); await rec.start(); const r = await rec.stop();
  expect(r.ok).toBe(false); expect(r.errors.join()).toMatch(/no browser endpoint/);
});
test("process discovery picks main Chrome processes with an ephemeral port only", () => {
  const exe = "/x/Google Chrome for Testing";
  const ps = [{ pid: 1, command: exe + " --remote-debugging-port=0 --user-data-dir=/tmp/agent-browser-chrome-1 about:blank" },
    { pid: 2, command: exe + " --type=renderer --remote-debugging-port=0 --user-data-dir=/tmp/agent-browser-chrome-1" },
    { pid: 3, command: exe + " --remote-debugging-port=9333 --user-data-dir=/p/browse" }, { pid: 4, command: "/other/chrome --remote-debugging-port=0 --user-data-dir=/tmp/q" }];
  expect(chromeMains(ps, exe)).toEqual([{ pid: 1, dir: "/tmp/agent-browser-chrome-1" }]);
  expect(isIgnorableUrl("about:blank")).toBe(true); expect(isIgnorableUrl("https://a.b/")).toBe(false);
});

// ---- evidence accepts recorded navigations ----
import { blind } from "../blind/tasks.ts";
import { transcriptFromEvents, missingEvidence } from "../src/measure.ts";
import { scoreRun } from "../src/scoring.ts";
import { forbiddenNavApplies } from "../src/scoring.ts";
const b19 = blind.find((t) => t.id === "b19")!;
// the agent looped over names and built the URL inside a script: neither the input nor the output ever contains "cdnjs.com/..." as a literal
const looped = [
  { e: { type: "assistant", message: { content: [{ type: "tool_use", id: "1", name: "Bash", input: { command: "agent-browser run - <<'JS'\nconst host = ['cdn','js'].join('');\npage.goto('https://' + host + '.com/libraries/' + 'bootstrap');\nreturn 'ok'\nJS" } }] } } },
  { e: { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "1", content: "ok" }] } } }];
test("evidence: a constructed URL is a false negative from the transcript alone and is accepted once the recorded navigation is available", async () => {
  expect(missingEvidence(b19.evidence, transcriptFromEvents(looped)).length).toBe(1);
  const t = { ...transcriptFromEvents(looped), navigated: ["https://cdnjs.com/libraries/bootstrap"] };
  expect(missingEvidence(b19.evidence, t)).toEqual([]);
  expect(missingEvidence(b19.evidence, { ...transcriptFromEvents(looped), navigated: null }).length).toBe(1);        // nothing recorded: no credit
  expect(missingEvidence(b19.evidence, { ...transcriptFromEvents(looped), navigated: ["https://other.example/"] }).length).toBe(1);
  const run = await scoreRun({ ...b19, check: async () => ({ ok: true, truth: "t" }) }, { events: [...looped, { e: { type: "result", result: "ANSWER: x" } }], timedOut: false, navigated: ["https://cdnjs.com/libraries/bootstrap"] });
  expect(run.evidenceMissing).toEqual([]); expect(run.passed).toBe(true);
});
test("forbidden-URL rule also applies to recorded navigations for blind suites only", () => {
  expect(forbiddenNavApplies(b19)).toBe(true);
  expect(forbiddenNavApplies({ ...b19, suite: "heldout" })).toBe(false);
  expect(forbiddenNavApplies({ ...b19, suite: "heldout", forbiddenNav: true })).toBe(true);
  expect(forbiddenNavApplies({ ...b19, forbidden: undefined })).toBe(false);
});
