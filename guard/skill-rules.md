# Rules for agent-browser's agent-facing texts

Scope: everything an LLM agent reads before or while using agent-browser:

- `skills/agent-browser/SKILL.md` (the stub; ab-cli receives its body as system prompt / AGENTS.md)
- `skill-data/core/SKILL.md` (what `agent-browser skills get core` prints)
- the MCP `initialize` instructions and the tool titles/descriptions/schemas of the default
  (`core`) MCP profile, as served by `agent-browser mcp`
- `agent-browser --help`

`guard/lint-skill.ts` checks rules 1-4 mechanically. Rule 5 is for the human/agent reviewer.

## 1. No benchmark leakage

The texts must not contain anything that only makes sense because of our benchmark:
site names or domains used by our tasks, task wording, fixture details (product names,
people, codes, config keys) or expected answers. That includes the held-out set in
`guard/heldout-tasks.md`. Examples must use `example.com`-style placeholders and generic
selectors (`input[name=q]`, `h2 a`), never a real page we test on.

The lint builds its denylist from `bench/src/tasks.ts` (domains and quoted terms in prompts,
URL path slugs used by checkers, distinctive dotted/call identifiers), from the exported
`*_TRUTH`/`*_CODE` constants of `bench/src/fixtures.ts`, and from the domains and quoted
terms of `guard/heldout-tasks.md`. Generic English words are skipped via a stoplist.

## 2. Byte budgets

| text | budget |
| --- | --- |
| stub `skills/agent-browser/SKILL.md`, whole file incl. frontmatter | <= 2800 bytes |
| MCP `initialize` instructions (default profile) | <= 2000 bytes |
| core `skill-data/core/SKILL.md` | <= 16547 bytes (its size on `duel-run` before this rewrite) |

Models weight early text more, so the most decisive guidance goes first in each text.

## 3. Every name must exist

- Every `agent-browser <command>` in the texts is a real CLI command
  (`agent-browser <command> --help` exits 0).
- Every `page.<method>` used in the texts exists in the `run` prelude
  (`cli/src/codemode/prelude.js`).
- Every `agent_browser_<tool>` named in the texts exists in `agent-browser mcp --tools all`;
  every tool named in the MCP instructions or in a core tool description is enabled in the
  default profile, so the agent can actually call it.

## 4. Size of what the default MCP profile advertises

Report (not fail) the number of tools and bytes of the default profile's `tools/list`, so a
change that bloats the catalog shows up in the lint output.

## 5. Claims are true and generic (review, not linted)

- Every behavioural claim (output caps, error format, what persists after a failed step,
  defaults such as batch stopping at the first error) must match the code. When a text and
  the code disagree, fix the text, or fix the code in a separate commit with a test.
- Generic for any agent and any model: no "Claude", no harness-specific tool names, no
  advice that only pays off for one site or one task shape.
- Do not tune the texts against `guard/heldout-tasks.md`; run those only after freezing.
