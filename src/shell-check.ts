// Classifies a shell command by PROGRAM NAMES only (heredoc bodies and quoted strings are ignored), so JS inside
// `eval`/`run` scripts that mentions fetch( or node does not count as using other means.
export const FORBIDDEN = new Set(["curl", "wget", "python", "python3", "node", "bun", "npx", "deno", "lynx", "links", "w3m", "nc", "ncat", "telnet", "open", "osascript", "http", "httpie", "playwright", "puppeteer", "chromium", "google-chrome", "ruby", "perl", "php"]);
export function stripHeredocsAndQuotes(cmd: string): string {
  let s = cmd.replace(/<<-?\s*(['"]?)([A-Za-z_][\w]*)\1([^\n]*)\n[\s\S]*?\n\s*\2\s*(?=\n|$)/g, "$3\n");
  s = s.replace(/'[^']*'/g, "''").replace(/"(?:\\.|[^"\\])*"/g, '""');
  return s;
}
export function analyzeShell(cmd: string, abCli: boolean) {
  const flat = stripHeredocsAndQuotes(cmd);
  const segments = flat.split(/\n|;|&&|\|\||\||&(?!>)/).map((x) => x.trim()).filter(Boolean);
  const programs: string[] = []; let sub: string | undefined; const subs: string[] = [];
  for (const seg of segments) {
    const toks = seg.replace(/^\(+|^\{\s*/, "").split(/\s+/).filter((t) => !/^\w+=/.test(t) && t !== "sudo" && t !== "env" && t !== "time");
    const prog = (toks[0] ?? "").replace(/^.*\//, ""); if (!prog || prog === "<<HEREDOC" || prog.startsWith("<<")) continue;
    programs.push(prog);
    if (prog === "agent-browser" || prog === "agent-browser-shim") { const rest = toks.slice(1).filter((t, i, a) => !t.startsWith("-") && !(i > 0 && a[i - 1] === "--session")); sub = sub ?? rest[0]; if (rest[0]) subs.push(rest[0]); }
  }
  const violations: string[] = [];
  for (const p of programs) if (FORBIDDEN.has(p) || /^(python|node|ruby|perl|php)[0-9.]+$/.test(p)) violations.push(`program ${p}: ${cmd.slice(0, 100).replace(/\n/g, " ")}`);
  if (/bench\/|src\/fixtures|\.codex-home|browser-duel/.test(flat)) violations.push(`touches harness paths: ${cmd.slice(0, 100)}`);
  const abCalls = programs.filter((p) => p === "agent-browser").length;
  return { violations, sub, subs, batch: /\bagent-browser\b[^\n]*\bbatch\b/.test(flat), run: /\bagent-browser\b[^\n]*\brun\b/.test(flat), chain: abCalls >= 2 && /&&|;/.test(flat), snapshotFlag: /--snapshot/.test(cmd) };
}
if (import.meta.main) {
  const t = (c: string) => console.log(JSON.stringify(analyzeShell(c, true)));
  t("agent-browser eval \"fetch('/x').then(r=>r.text())\" && agent-browser snapshot -i");
  t("cat <<'EOF' | agent-browser eval --stdin\nfetch('http://x'); node;\nEOF");
  t("curl -s http://x | head");
  t("agent-browser batch \"fill @e1 a\" \"click @e2\" --snapshot");
}
