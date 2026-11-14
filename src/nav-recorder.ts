// Navigation evidence recorded by the HARNESS, identically for every tool: a browser-level CDP client per Chrome that only subscribes to
// Target discovery (`Target.setDiscoverTargets`). Chrome then pushes a `targetInfoChanged` with the new URL every time a page target commits a
// navigation (links, scripts, redirects, history changes). Nothing is attached to any page: no Network/Page/Runtime domain is enabled, no
// request is paused or rewritten, the tool's own CDP session is untouched, and no call of the tool waits on this client.
//
//   browse-mcp : the relay's Chrome listens on the fixed debugging port 9333 -> one browser websocket (http://127.0.0.1:9333/json/version).
//   ab-cli/mcp : agent-browser launches its own Chrome with --remote-debugging-port=0 and a throwaway profile; the port is only in that profile's
//                DevToolsActivePort file. Chromes that appear after the baseline process snapshot (same binary, port 0) are found by polling `ps`.
//
// Limits (also in the report): a navigation that fails to commit (DNS error, blocked) is seen as chrome-error://, not as the requested URL;
// two commits inside one poll gap of a Chrome started mid-run can be seen as one; requests the page makes in the background (fetch/XHR) are NOT navigations.
export type NavEvent = { t: number; url: string; target: string; endpoint: string; initial?: boolean };
export type NavResult = { method: "cdp-target-discovery"; ok: boolean; urls: string[]; events: number; endpoints: number; initial_urls: string[]; errors: string[] };

const IGNORE = /^(about:|chrome:|chrome-extension:|chrome-error:|devtools:|chrome-untrusted:|chrome-search:)/i;
export const isIgnorableUrl = (u: string) => !u || IGNORE.test(u);
const MAX_URLS = 500;

export class NavRecorder {
  private events: NavEvent[] = [];
  private errors: string[] = [];
  private socks = new Map<string, WebSocket>();
  private tried = new Set<string>();
  private timer?: ReturnType<typeof setInterval>;
  private t0 = performance.now();
  private stopped = false;
  /** `discover` returns browser websocket URLs currently available; it is polled until stop(). */
  constructor(private discover: () => Promise<string[]> | string[], private pollMs = 250, private label = "") {}

  /** Connect to every endpoint visible now and start polling for new ones. */
  async start() { this.t0 = performance.now(); await this.poll(); this.timer = setInterval(() => { this.poll().catch(() => {}); }, this.pollMs); }
  async poll() {
    if (this.stopped) return;
    let urls: string[] = [];
    try { urls = await this.discover(); } catch (e) { this.err(`discover: ${e}`); return; }
    await Promise.all(urls.filter((u) => !this.tried.has(u)).map((u) => { this.tried.add(u); return this.connect(u); }));
  }
  private err(m: string) { if (this.errors.length < 20) this.errors.push(m); }
  connect(ws: string): Promise<boolean> {
    return new Promise((resolve) => {
      let ready = false; const targets = new Map<string, string>();
      let sock: WebSocket;
      try { sock = new WebSocket(ws); } catch (e) { this.err(`ws ${ws}: ${e}`); return resolve(false); }
      this.socks.set(ws, sock);
      const done = (ok: boolean) => resolve(ok);
      const to = setTimeout(() => { if (!ready) { this.err(`ws ${ws}: no answer to setDiscoverTargets in 3s`); done(false); } }, 3000);
      sock.onopen = () => sock.send(JSON.stringify({ id: 1, method: "Target.setDiscoverTargets", params: { discover: true } }));
      sock.onerror = () => { if (!ready) { this.err(`ws ${ws}: connection error`); done(false); } };
      sock.onclose = () => { this.socks.delete(ws); if (!ready) done(false); };
      sock.onmessage = (m) => {
        let d: any; try { d = JSON.parse(String(m.data)); } catch { return; }
        if (d.id === 1) { ready = true; clearTimeout(to); if (d.error) { this.err(`ws ${ws}: ${JSON.stringify(d.error).slice(0, 120)}`); done(false); } else done(true); return; }
        if (d.method === "Target.targetDestroyed") { targets.delete(d.params?.targetId); return; }
        if (d.method !== "Target.targetCreated" && d.method !== "Target.targetInfoChanged") return;
        const ti = d.params?.targetInfo; if (!ti || ti.type !== "page") return;
        const url = String(ti.url ?? ""); if (targets.get(ti.targetId) === url) return;
        targets.set(ti.targetId, url);
        this.events.push({ t: Math.round(performance.now() - this.t0), url, target: String(ti.targetId).slice(0, 8), endpoint: ws.slice(0, 40), initial: !ready || undefined });
      };
    });
  }
  /** Closes everything; ok = at least one browser endpoint answered. */
  async stop(): Promise<NavResult> {
    if (this.timer) clearInterval(this.timer);
    await this.poll().catch(() => {}); this.stopped = true;
    const urls: string[] = [], initial: string[] = [];
    for (const e of this.events) {
      if (isIgnorableUrl(e.url)) continue;
      if (e.initial) { if (!initial.includes(e.url)) initial.push(e.url); continue; }
      if (!urls.includes(e.url) && urls.length < MAX_URLS) urls.push(e.url);
    }
    const ok = [...this.socks.values()].length > 0 || this.events.length > 0;
    for (const s of this.socks.values()) try { s.close(); } catch {}
    if (!ok && !this.errors.length) this.err("no browser endpoint found");
    return { method: "cdp-target-discovery", ok, urls, events: this.events.length, endpoints: this.tried.size, initial_urls: initial, errors: this.errors };
  }
}

// ---------------- endpoint discovery ----------------
/** browse: the relay's Chrome on a fixed debugging port. */
export const fixedPortDiscover = (port: number) => async (): Promise<string[]> => {
  const v = await (await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1500) })).json();
  return [v.webSocketDebuggerUrl];
};

type Proc = { pid: number; command: string };
async function psList(): Promise<Proc[]> {
  const p = Bun.spawn(["ps", "-axo", "pid=,command="], { stdout: "pipe", stderr: "ignore" });
  const out = await new Response(p.stdout).text();
  return out.split("\n").map((l) => l.match(/^\s*(\d+)\s+(.*)$/)).filter((m): m is RegExpMatchArray => !!m).map((m) => ({ pid: Number(m[1]), command: m[2] }));
}
/** Main (non-helper) Chrome processes of `exe` that were started with an ephemeral debugging port, with their profile dir. */
export function chromeMains(procs: Proc[], exe: string) {
  return procs.filter((p) => p.command.startsWith(exe) && /--remote-debugging-port=0\b/.test(p.command) && !/--type=/.test(p.command))
    .map((p) => ({ pid: p.pid, dir: p.command.match(/--user-data-dir=(\S+)/)?.[1] })).filter((x): x is { pid: number; dir: string } => !!x.dir);
}
export const chromePids = async (exe: string) => new Set(chromeMains(await psList(), exe).map((c) => c.pid));
/** ab-cli/ab-mcp: Chromes of `exe` that were not running at `baseline`; their websocket comes from DevToolsActivePort. */
export const processDiscover = (exe: string, baseline: Set<number>) => async (): Promise<string[]> => {
  const out: string[] = [];
  for (const c of chromeMains(await psList(), exe)) {
    if (baseline.has(c.pid)) continue;
    try { const [port, path] = (await Bun.file(`${c.dir}/DevToolsActivePort`).text()).split("\n"); if (port && path) out.push(`ws://127.0.0.1:${port.trim()}${path.trim()}`); } catch {}
  }
  return out;
};
