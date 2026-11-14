// Human-handoff detection (guard/handoff-policy.md). Pure functions, no side effects on import. Reads its patterns from src/handoff-patterns.json
// and is exercised by tests/handoff.test.ts.
//
// A handoff is the agent's explicit request that a human act in the browser (browse: `await handoff("Solve the CAPTCHA ...")` inside
// its `execute` tool). In a headless benchmark nobody answers, so the call blocks until the run timeout. The first such request ends the run.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const P = JSON.parse(readFileSync(join(import.meta.dir, "handoff-patterns.json"), "utf8"));
const CODE_CALL = new RegExp(P.code_call);
const MESSAGE_ARG = new RegExp(P.message_arg);
const TOOL_NAME = new RegExp(P.tool_name, "i");
const AB_CLI = new RegExp(P.ab_cli_subcommand);
const CODE_FIELDS: string[] = P.code_fields;

export type HandoffHit = { tool: string; via: "mcp-code" | "mcp-tool" | "ab-cli" | "codex-command"; message: string };

/** JS source without comments (block comments, and `//` comments that do not sit inside a URL like https://x). */
export function stripJsComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[\s;{}()])\/\/[^\n]*/g, "$1");
}
/** The handoff message of a code string that calls handoff(...), "" when the call has no literal message, null when there is no call. */
export function handoffInCode(code: string): string | null {
  const c = stripJsComments(code);
  if (!CODE_CALL.test(c)) return null;
  return MESSAGE_ARG.exec(c)?.[2] ?? "";
}
/** One tool call (name as the transport reports it, input object or shell command string) -> a handoff hit or null. */
export function detectHandoffCall(name: string, input: any): HandoffHit | null {
  const short = name.startsWith("mcp__") ? name.split("__").slice(2).join("__") : name;
  if (TOOL_NAME.test(short)) return { tool: name, via: "mcp-tool", message: String(input?.message ?? input?.reason ?? "").slice(0, 300) };
  if (name === "Bash" || name === "shell") {
    const cmd = typeof input === "string" ? input : String(input?.command ?? "");
    return AB_CLI.test(cmd) ? { tool: name, via: "ab-cli", message: cmd.slice(0, 300) } : null;
  }
  if (input && typeof input === "object") for (const f of CODE_FIELDS) if (typeof input[f] === "string") {
    const m = handoffInCode(input[f]);
    if (m !== null) return { tool: name, via: "mcp-code", message: m.slice(0, 300) };
  }
  return null;
}
/** One stream event (claude stream-json or codex `exec --json`) -> the handoff it carries, or null. Result events never count: only the agent's own call. */
export function detectHandoffEvent(e: any): HandoffHit | null {
  if (e?.type === "assistant") for (const c of e.message?.content ?? []) if (c?.type === "tool_use") { const h = detectHandoffCall(String(c.name ?? ""), c.input); if (h) return h; }
  const it = e?.item;
  if ((e?.type === "item.started" || e?.type === "item.completed") && it) {
    if (it.type === "mcp_tool_call") return detectHandoffCall(`mcp__${it.server ?? "mcp"}__${it.tool ?? ""}`, it.arguments);
    if (it.type === "command_execution") return detectHandoffCall("Bash", { command: String(it.command ?? "") });
  }
  return null;
}
/** First handoff in a list of events -> its index and hit. */
export function firstHandoff(events: { e: any }[]): { index: number; hit: HandoffHit } | null {
  for (let i = 0; i < events.length; i++) { const hit = detectHandoffEvent(events[i].e); if (hit) return { index: i, hit }; }
  return null;
}
/**
 * Post-hoc charged wall of a run whose transcript carries ISO timestamps: wall minus what happened after the handoff call started
 * (last timestamped event minus the handoff call's timestamp). Never negative, never above the recorded wall.
 */
export function chargedWall(wallS: number, handoffTs: string, lastTs: string): number {
  const after = (Date.parse(lastTs) - Date.parse(handoffTs)) / 1000;
  return Math.min(wallS, Math.max(0, wallS - Math.max(0, after)));
}
