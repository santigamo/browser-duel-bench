// Rules block stated to the agent (guard/prereg-r9.md). ONE fixed text, identical for every variant (ab-cli and browse-mcp), appended to the prompt suffix.
// Changing a single character changes RULES_V1_SHA256, which the preregistration pins and tests/rules.test.ts checks.
import { createHash } from "node:crypto";
import type { Task } from "./tasks.ts";

export const RULES_V1 = "Use the website's own pages through the browser tool. Do not call the site's data or API endpoints, or fetch data outside the browser, unless the task says so. Do any arithmetic or text processing inside the browser tool, not with other programs. Answer only from what you observed in the browser during this task.";
export const RULES_V1_SHA256 = createHash("sha256").update(RULES_V1).digest("hex");
/** Suites for which the rules are stated by default; older suites stay as they were so past results remain reproducible. */
export const RULES_DEFAULT_SUITES: Task["suite"][] = ["blind3", "blind4", "diag-r9"];
/** flag: undefined (default by suite) | "v1" | "off" */
export const rulesOn = (t: Pick<Task, "suite">, flag?: string): boolean => flag === "v1" ? true : flag === "off" ? false : RULES_DEFAULT_SUITES.includes(t.suite);
/** The prompt for a task: unchanged when the rules are off (byte-identical to the old suffix), the rule block between task and tool line when on. */
export function taskPrompt(taskPrompt: string, toolName: string, rules: boolean, extra = ""): string {
  return `${taskPrompt}${rules ? "\n\n" + RULES_V1 : ""}\n\nUse only the ${toolName} to interact with the browser. Put your final answer on the last line as ANSWER: ...${extra}`;
}
