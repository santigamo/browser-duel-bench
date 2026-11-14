// Measures what an MCP server advertises: initialize.instructions + tools/list (all pages), in bytes and a ~chars/4 token estimate.
export async function mcpAdvertised(cmd: string[], env: Record<string, string>) {
  const p = Bun.spawn(cmd, { env, stdin: "pipe", stdout: "pipe", stderr: "ignore" });
  const dec = new TextDecoder(); let buf = ""; const waiters = new Map<number, (m: any) => void>();
  (async () => { for await (const ch of p.stdout as any) { buf += dec.decode(ch); let i; while ((i = buf.indexOf("\n")) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); try { const m = JSON.parse(l); if (m.id != null) waiters.get(m.id)?.(m); } catch {} } } })();
  let id = 0; const send = (o: any) => p.stdin.write(JSON.stringify(o) + "\n");
  const call = (method: string, params: any = {}) => new Promise<any>((res, rej) => { const i = ++id; waiters.set(i, res); send({ jsonrpc: "2.0", id: i, method, params }); setTimeout(() => rej(new Error("timeout " + method)), 30000); });
  const init = await call("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "bench", version: "1" } });
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  const tools: any[] = []; let cursor: string | undefined;
  do { const r = await call("tools/list", cursor ? { cursor } : {}); tools.push(...r.result.tools); cursor = r.result.nextCursor; } while (cursor);
  p.kill();
  const instr = init.result?.instructions ?? "";
  const toolsJson = JSON.stringify(tools);
  return { tools: tools.length, tools_bytes: toolsJson.length, instructions_bytes: instr.length, est_tokens: Math.round((toolsJson.length + instr.length) / 4) };
}
if (import.meta.main) {
  const [bin, ...rest] = process.argv.slice(2);
  console.log(await mcpAdvertised([bin, ...rest], { ...process.env, PATH: process.env.PATH! } as any));
}
