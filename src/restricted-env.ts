// Makes the ab-cli Bash environment browser-only, matching the MCP variants (browse-mcp and ab-mcp have no shell at all).
//
//  1. PATH: a directory with the `agent-browser` wrapper and symlinks to a short list of text utilities only (the ones agents really used in
//     3627 earlier ab-cli commands: grep head sed cut tail wc sort uniq awk tr diff sleep, plus cat ls tee xargs date basename dirname for
//     heredoc/pipe patterns). curl, wget, python3, node, ... are simply not on it.
//  2. Exec deny: PATH alone is NOT enough. Login shells rebuild PATH (macOS /etc/zprofile -> path_helper adds /usr/bin; Codex runs `zsh -lc`;
//     Claude Code sources a shell snapshot that exports the user's PATH), and /usr/bin/curl can be run by absolute path. So the agent process is
//     started under a macOS `sandbox-exec` profile that only denies process-exec of the same programs shell-check.ts calls forbidden. Everything else
//     is allowed (`(allow default)`): no filesystem, network or Chrome restriction, so the tool behaves as before. A blocked program fails with
//     "operation not permitted", which is also what the violation detector still records as an attempt.
import { mkdirSync, symlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { FORBIDDEN } from "./shell-check.ts";

export const TEXT_TOOLS = ["cat", "grep", "head", "tail", "sed", "cut", "wc", "sort", "uniq", "awk", "tr", "diff", "sleep", "ls", "tee", "xargs", "date", "basename", "dirname"];
/** Programs whose execution the sandbox denies (basename match, any directory): exactly the violation detector's list (shell-check.ts), plus version-suffixed interpreters. */
export const DENIED = [...FORBIDDEN];

/** Fills `dir` with symlinks to TEXT_TOOLS found in the system directories; returns what was linked. The wrapper itself is written by the caller. */
export function linkTextTools(dir: string): string[] {
  mkdirSync(dir, { recursive: true });
  const linked: string[] = [];
  for (const t of TEXT_TOOLS) {
    for (const d of ["/usr/bin", "/bin"]) {
      const src = join(d, t);
      if (existsSync(src)) { try { symlinkSync(src, join(dir, t)); linked.push(t); } catch {} break; }
    }
  }
  return linked;
}

/**
 * Claude Code finds its login by running `security` (macOS keychain) through PATH: with a PATH that lacks it the run starts "Not logged in".
 * It is linked into a separate dir that is appended after the browser-only one; it is the only host tool the runner process itself needs.
 */
export function linkHostTools(dir: string): string[] {
  mkdirSync(dir, { recursive: true });
  const linked: string[] = [];
  for (const t of ["security"]) { const src = join("/usr/bin", t); if (existsSync(src)) { try { symlinkSync(src, join(dir, t)); linked.push(t); } catch {} } }
  return linked;
}

export function execDenyProfile(): string {
  const names = [...new Set(DENIED)].map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return `(version 1)(allow default)(deny process-exec (regex #"/(${names}|python[0-9.]*|node[0-9.]*|ruby[0-9.]*|perl[0-9.]*|php[0-9.]*)$"))`;
}
export const SANDBOX_EXEC = "/usr/bin/sandbox-exec";
export const sandboxAvailable = () => process.platform === "darwin" && existsSync(SANDBOX_EXEC);
/** argv -> the same command under the exec-deny profile. */
export const sandboxed = (argv: string[]) => [SANDBOX_EXEC, "-p", execDenyProfile(), ...argv];
