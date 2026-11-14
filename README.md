# browser-duel bench

A small benchmark harness that compares browser tools for LLM agents on read-only web tasks, and the pre-registered rounds run with it. The published round compares our fork of [agent-browser](https://github.com/vercel-labs/agent-browser) (a CLI used through Bash) with browse (a stock MCP server) on 40 tasks.

## Result

In a third pre-registered round (the first two failed their thresholds), we compared our fork of agent-browser (tag r9, a CLI used through Bash with an instruction stub we tuned on earlier rounds) with browse 0.0.14 (stock MCP server, 18 tools) on 40 new read-only web tasks, two runs each, using Claude Sonnet 5.5 in Claude Code with headless Chrome for Testing on one machine on 13 November 2026. Each tool solved 70 of 80 runs (difference 0.0 points, 95% CI -6.2 to +7.5, too wide to claim equal reliability). Four tasks failed for both, three blocked by bot protection and one with a wrong reference answer. r9 cost less: 0.75 of browse as the geometric mean of per-task ratios (CI 0.65 to 0.86), 0.83 in total spend. The saving comes from the smaller fixed prompt (5,024 vs 9,845 first-turn tokens) and how it was cached; cost added after the first turn did not differ measurably (0.92, CI 0.77 to 1.09), and with both tools' first-turn cache writes priced alike the ratio is 0.88 (0.78 to 1.00). Peak context was 0.57 of browse's (0.53 to 0.60), and 0.78 (0.61 to 0.96) for the part accumulated during the run. Wall time showed no reliable difference (0.90, CI 0.77 to 1.07). Costs are Claude Code's reported API-equivalent dollars with a one-hour prompt cache. The tasks were written by an LLM agent and the plan by the same coordinator who ran the test. The result does not cover other models, headed or logged-in browsers, or upstream agent-browser.

Full tables, sensitivities and leave-one-task-out ranges: `results/2026-11-13T10-51-21-blind3-final/report-r9.md`. Everything that deviates from the pre-registration is listed, dated, at the end of [`guard/prereg-r9.md`](guard/prereg-r9.md) ("Desviaciones POST HOC"), including a task (d16) whose reference answer is wrong and the withdrawal of the "strict compliant success" measure. The `results/` directory exists only in the public export (see below): it holds scrubbed rows and transcripts.

## Rounds

The guard documents are written in Spanish.

| round | plan | result | outcome |
|---|---|---|---|
| r7 (20 blind tasks, N=3) | [guard/prereg-r7.md](guard/prereg-r7.md) | [guard/resultado-ciego-r7.md](guard/resultado-ciego-r7.md), post hoc re-scoring: [guard/posthoc-rescore-r7-vs-browse.md](guard/posthoc-rescore-r7-vs-browse.md) | failed thresholds (only context passed) |
| r8 (19 blind tasks, N=3) | [guard/prereg-r8.md](guard/prereg-r8.md) | [guard/resultado-ciego-r8.md](guard/resultado-ciego-r8.md) | failed thresholds (only context passed) |
| r9 (40 blind tasks, N=2) | [guard/prereg-r9.md](guard/prereg-r9.md) | `results/2026-11-13T10-51-21-blind3-final/` | cost and context gates passed, success and wall as stated above |

Supporting rules: [endpoint policy](guard/endpoint-policy.md), [handoff policy](guard/handoff-policy.md), [stub rules](guard/skill-rules.md), [held-out tasks](guard/heldout-tasks.md).

## Reproduce the r9 result

Requirements: macOS on Apple silicon (the restricted shell uses `sandbox-exec`, Chrome for Testing is the `mac_arm` build), [Bun](https://bun.sh) 1.3, Node 22, Python 3, the `claude` CLI (the run used 2.1.323) logged in, and network access to the live sites. The tasks read live pages: their reference answers are computed by the checkers at run time, so a new run reproduces the method, not the exact rows.

1. Layout. The harness expects its sibling checkouts next to this directory: `agent-browser-r9/` (our fork at tag r9, commit `bb17a5c23e59ff7cd465317a3af04bcd9d209069`, built with `cargo build --release`; its `skills/agent-browser/SKILL.md` is the instruction stub) and `browse/` (version 0.0.14, commit `8d247e67e40a529b6419f98e50b298ed548a1874`, with `dist/` and `cli/dist/` built).
2. Chrome for Testing 157.0.8103.38 into `.cache/chrome` (the harness picks the first `mac*` directory there), for example `npx @puppeteer/browsers install chrome@157.0.8103.38 --path .cache/chrome`.
3. Check the r9 binary: its sha256 must be `77f6b45cdf252518d6c5794bbd847b2332420766af6339a9872083cb677824b3` (`shasum -a 256 <binary>`), and the rules block sha256 is `a14bcfa4169cc0acfe3f860eb60a68dddaebe3518eb43f5ad97c3fcf99537f9e` (checked by `tests/rules.test.ts`). Optionally `scripts/setup.sh <binary>` links `.bin/agent-browser`.
4. Run (the frozen command of the pre-registration; use any lock or none, the harness only needs that nothing else loads the machine):

   ```
   bun src/run.ts --variants ab-cli:r9,browse-mcp --tasks blind3 --n 2 --seed 9001 --label r9-blind3 --bins r9=<path to the r9 binary>
   ```

   The published run used `--bins main=<bin>,r9=<bin> --static false --label blind3-final` instead; see deviation 2 in the pre-registration. `meta.json` of new runs records the binary, stub and task-file hashes, the agent-browser and browse commits and the operating system.
5. Report: `python3 src/final.py manifest-blind3.json --report r9` (point the manifest at your results directory). It prints the four gates, the pairwise tables, the static/dynamic split, leave-one-task-out ranges and the sensitivities. Bootstrap seed 7, 2000 resamples.
6. Tests: `bun test` and `python3 -m unittest discover -s tests -p 'test_*.py'`. Nothing in the test suites launches an agent or a browser. `tests/nav-synthetic.ts` and `tests/restricted-shell.ts` are manual checks that do need browsers.

The checkers of some tasks call GitHub's API: set `GITHUB_TOKEN` (or be logged in with `gh`) to avoid anonymous rate limits.

Task d4 reads the BART API for its reference answer. The harness uses BART's public demo key as a fallback so the published result stays reproducible; set `BART_API_KEY` to use your own.

The agent environment is an allowlist (`ENV_ALLOW` in `src/run.ts`; extra names via `BENCH_ENV_PASS`). The published run used the earlier denylist (deviation 9).

## Public export

`scripts/export-public.sh` builds `../public-bench` from `git archive HEAD` plus scrubbed copies of the r9 rows and transcripts and the r7/r8 summaries (`scripts/scrub_results.py`: ids, rate-limit and plan fields, local paths and challenge tokens removed; tool-result page text cut to 300 characters plus a sha256).

## Layout

- `src/` harness (`run.ts`), scoring contract, checkers' shared code, report generators (`final.py` is the one used for r9), tests in `tests/`.
- `blind/`, `blind2/`, `blind3/` task suites (b1-b20, c1-c20, d1-d40); `src/tasks.ts` the earlier fixture-based suites.
- `guard/` pre-registrations, results and rules. `manifest-*.json` select which result directories a report uses.

Unmaintained: the Codex runner (`--runner codex`) and the `ab-mcp` / `ab-mcp-min` variants (agent-browser's MCP mode) are kept because earlier rounds used them, but were not exercised for r9 and may not work with current CLIs.

## Known limitations

- Two runs per task: the success difference has a 95% CI of -6.2 to +7.5 points; the benchmark cannot show equal reliability.
- One model, one machine, one day, headless Chrome for Testing, no logins. The tasks read live sites, so results drift and some sites block automation (three tasks failed for both tools for that reason).
- The tasks were written by an LLM agent and the plan by the same coordinator who ran the test. d16's reference answer is wrong for the site UI, so d16 is ungradable (results with and without it are in the report).
- Cost is Claude Code's reported API-equivalent dollars under a one-hour prompt cache. The static/dynamic split is a model built on measured first-turn usage, and the "priced alike" sensitivity depends on how "alike" is defined (here: the same cache-write token count for every run, the median over all runs).
- The workflow-compliance check is vacuous for blind3 (deviation 6); "strict compliant success" is withdrawn.
- Provenance gaps of the published run (commit, binary hash, checker hash) are listed in the pre-registration and were verified after the fact.
- Heuristic detectors: policy violations and "fetch outside the browser" are detected from transcripts and recorded navigations, not proven.
- The Codex runner and ab-mcp variants are unmaintained (above).

## Licence

MIT, see [LICENSE](LICENSE). Nothing in this repository forces a different licence: it contains no code copied from agent-browser (Apache-2.0) or browse (MIT), which are used as external binaries. The benchmark tasks describe public web pages and contain none of their content.
