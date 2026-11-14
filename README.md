# browser-duel bench

A small benchmark harness that compares browser tools for LLM agents on read-only web tasks, and the pre-registered rounds I ran with it. The latest round (r10) compares my fork of [agent-browser](https://github.com/vercel-labs/agent-browser) with upstream agent-browser 0.43.0 (both used as a CLI through Bash) and with browse (a stock MCP server) on 40 new tasks.

## Result (round r10, fourth pre-registered round)

In my fourth pre-registered round (the first two failed their gates), I compared my fork of agent-browser (r10.1, a CLI used through Bash, with an instruction stub I tuned) with upstream agent-browser 0.43.0 (stock stub), both as a CLI, on 40 new read-only web tasks, one run per task, using Claude Sonnet 5.5 in Claude Code with headless Chrome for Testing on one machine on 14 November 2026. Cost was 0.56 of upstream's (geometric mean of per-task ratios, 95% CI 0.49 to 0.66) and peak context 0.74 (0.69 to 0.81); both pre-registered gates passed. Compliant success was 36/40 for each tool (difference 0.0 points); the same four tasks failed for every tool: g4, g26 and g36 gave wrong answers (g26 because the site blocked the browser), and g20 was marked non-compliant for all three tools because of a rule problem in my checker (below). The first-turn prompt is about the same size (ratio 0.98), but upstream's stock stub tells the agent to load its guide first, and it did in all 40 runs (`agent-browser skills get core | head -60`): one extra step and about 2,000 tokens (median 2,021). My stub carries the workflow, so the fork never loaded a guide. That load explains almost all of the peak-context gap: without it the ratio is about 0.97 (post hoc), and tool output apart from the guide was the same size (median 1,290 vs 1,258 characters per run). What `run` changes is round trips: 105 steps against 191 (151 without the guide step). The cost added after the first turn was 0.46 of upstream's and the context accumulated during the run 0.31, both including the guide load. Post hoc and estimated, repricing each upstream run without its guide step at the rates in `src/final.py`, the cost ratio is about 0.85. Cost per compliant success was 0.65 (0.51 to 0.82). With both tools' first-turn cache writes priced alike the cost ratio is 0.57 (0.49 to 0.66). Total spend over the 40 tasks was 0.65 of upstream's ($0.876 vs $1.349). On time, my fork was not slower: in this test wall time (charged) was 0.71x (CI 0.61 to 0.84; from Claude Code's `duration_ms`, 0.68, CI 0.57 to 0.82). Upstream's time includes its guide step and, in 36 of 40 runs, a cold Chrome start in a session the agent opened itself, as its guide asks. Against browse 0.0.14 (secondary, descriptive) the fork cost 0.83 of browse (0.72 to 0.96) and peak context was 0.58 (0.54 to 0.63) with the same pass count (36/40 each); wall time was 1.09 (0.89 to 1.30), no claim. Limits: one model; headless Chrome for Testing and no logged-in sites; the tasks were written by an LLM agent I started, which had no access to the fork's code or earlier results ("the coordinator" in the preregistration and reports is me, Santi, working with AI agents); my tuned stub is compared with upstream's stock stub, so most of the context difference is the stub's guide-loading instruction, not the code; one run per task (N=1), so the intervals show variation between tasks but not between repetitions of the same task. Costs are Claude Code's reported API-equivalent dollars with a one-hour prompt cache.

The g20 problem: the task's "forbidden" pattern for CRAN was case-insensitive and contained `PACKAGES`, so it also matches the normal page path `cran.r-project.org/web/packages/<pkg>/index.html` that the task asks for. Two tools were flagged for it (the third, upstream, by the recorded-navigation check on the same page), all three gave the right answer, and the row counts as correct but not compliant (raw success 37/40 for each, compliant 36/40). It is the same for every tool, so it does not move the comparison, and the report also gives the 36 tasks that every tool passes. Rows were not rescored. Full tables, sensitivities and leave-one-task-out ranges: `results/2026-11-14T13-58-33-blind4-final/report-r10.md`; plan: [`guard/prereg-r10.md`](guard/prereg-r10.md), with the dated post hoc notes at its end ("Notas POST HOC"). The `results/` directory exists only in the public export (see below): it holds scrubbed rows and transcripts.

## What `run` is

`run` is a command I added to my fork of agent-browser: `agent-browser run -` takes a short script that does several browser steps in order (navigate, click, fill, read text, return a value), so the agent describes a whole page interaction in one call and gets back only what it asked for, instead of making one call per click. The fork is at [github.com/santigamo/agent-browser](https://github.com/santigamo/agent-browser) (branch `r10`, tag `r10.1`; its `CHANGES-FORK.md` lists every difference from upstream). The fork also changes some defaults (listed in `CHANGES-FORK.md`); the benchmark measures the whole fork.

The pre-registration's commit times (the freeze of the plan and the task fingerprint before any run) are recorded in my private working repository; this public repository's history starts after them. I can share them on request.

## Earlier rounds

The guard documents are written in Spanish.

| round | plan | result | outcome |
|---|---|---|---|
| r7 (20 unseen tasks, N=3) | [guard/prereg-r7.md](guard/prereg-r7.md) | [guard/resultado-ciego-r7.md](guard/resultado-ciego-r7.md), post hoc re-scoring: [guard/posthoc-rescore-r7-vs-browse.md](guard/posthoc-rescore-r7-vs-browse.md) | failed its gates (only context passed) |
| r8 (19 unseen tasks, N=3) | [guard/prereg-r8.md](guard/prereg-r8.md) | [guard/resultado-ciego-r8.md](guard/resultado-ciego-r8.md) | failed its gates (only context passed) |
| r9 (40 unseen tasks, N=2), fork r9 vs browse | [guard/prereg-r9.md](guard/prereg-r9.md) | `results/2026-11-13T10-51-21-blind3-final/`, report `report-r9.md` | cost and context gates passed |
| r10 (40 unseen tasks, N=1), fork r10.1 vs upstream 0.43.0 and browse | [guard/prereg-r10.md](guard/prereg-r10.md) | `results/2026-11-14T13-58-33-blind4-final/`, report `report-r10.md` | cost and context gates passed (above) |

r9 in short: on 40 tasks, two runs each, the fork (tag r9) and browse 0.0.14 each solved 70 of 80 runs (difference 0.0 points, 95% CI -6.2 to +7.5, too wide to claim anything about equality). r9 cost 0.75 of browse as the geometric mean of per-task ratios (CI 0.65 to 0.86), and peak context was 0.57 (0.53 to 0.60); in r9 the saving came from the smaller fixed prompt, which is not the case against upstream in r10. Deviations from the r9 plan are listed at the end of its prereg, including a task (d16) whose reference answer is wrong and the withdrawal of the "strict compliant success" measure.

Supporting rules: [endpoint policy](guard/endpoint-policy.md), [handoff policy](guard/handoff-policy.md), [stub rules](guard/skill-rules.md), [held-out tasks](guard/heldout-tasks.md).

## Reproduce the r10 result

Requirements: macOS on Apple silicon (the restricted shell uses `sandbox-exec`, Chrome for Testing is the `mac_arm` build), [Bun](https://bun.sh) 1.3, Node 22, Python 3, Rust (to build the two agent-browser binaries), the `claude` CLI (the run used 2.1.325) logged in, and network access to the live sites. The tasks read live pages: their reference answers are computed by the checkers at run time, so a new run reproduces the method, not the exact rows.

1. Layout. The harness expects its sibling checkouts next to this directory: `agent-browser-r10/` (my fork, tag `r10.1`, commit `de5ec986229d0e10531813f90295baf759f5e387`, built with `cargo build --release` in `cli/`; its `skills/agent-browser/SKILL.md` is the instruction stub), `ab-v043/` (upstream at tag `v0.43.0`, commit `1cc19526f3641c8543d55aa6700e7c55b37ac356`, built the same way) and `browse/` (version 0.0.14, commit `8d247e67e40a529b6419f98e50b298ed548a1874`, with `dist/` and `cli/dist/` built). The published run used the fork checkout one commit after the tag (`0cb80568`, a README line only; see the post hoc notes).
2. Chrome for Testing 157.0.8103.38 into `.cache/chrome` (the harness picks the first `mac*` directory there), for example `npx @puppeteer/browsers install chrome@157.0.8103.38 --path .cache/chrome`.
3. Check the binaries: the r10.1 binary's sha256 was `c0b4a3137fbe4b5ba5e40757d741109bcf6c8091148d55f8640f42b7b17e6c21` and upstream's `e423bf88f9d09a9be4fd630a00cea444937192ac3cbe0659f3194ef4ca90b866` (`shasum -a 256 <binary>`; a rebuild on another toolchain may give a different hash, in which case compare the stub hashes and versions in `meta.json`). Stub sha256: r10.1 `dfe3965f69d8347ffef2e2f6c8130bc77584da7b8c740f7f85f5da2c05664e48`, upstream `60b28db5b700320c51d2b9f69f101631b753156fccee99f57af7c3a37aeaf9f8`. The rules block sha256 is `a14bcfa4169cc0acfe3f860eb60a68dddaebe3518eb43f5ad97c3fcf99537f9e` (checked by `tests/rules.test.ts`).
4. Run (the published run, from `results/blind4-final.log`; use any lock or none, the harness only needs that nothing else loads the machine):

   ```
   bun src/run.ts --variants ab-cli:r10,ab-cli:v043,browse-mcp --bins main=<r10.1 binary>,r10=<r10.1 binary>,v043=<v0.43.0 binary> --tasks blind4 --n 1 --seed 20261114 --static false --label blind4-final
   ```

   `meta.json` of a run records the binary, stub and task-file hashes, the agent-browser and browse commits and the operating system.
5. Report: `python3 src/final.py manifest-blind4.json --report r10` (point the manifest at your results directory). It prints the gates, the pairwise tables, the static/dynamic split, leave-one-task-out ranges and the sensitivities. Bootstrap seed 7, 2000 resamples. To regenerate the published report from the scrubbed files: `python3 src/final.py manifest-blind4.json --report r10 > /tmp/report-r10.md` and compare with `results/2026-11-14T13-58-33-blind4-final/report-r10.md`.
6. Tests: `bun test` and `python3 -m unittest discover -s tests -p 'test_*.py'`. Nothing in the test suites launches an agent or a browser. `tests/nav-synthetic.ts` and `tests/restricted-shell.ts` are manual checks that do need browsers.

For r9, the equivalent is `python3 src/final.py manifest-blind3.json --report r9` over `results/2026-11-13T10-51-21-blind3-final/`.

The checkers of some tasks call GitHub's API: set `GITHUB_TOKEN` (or be logged in with `gh`) to avoid anonymous rate limits. Task d4 (r9) reads the BART API for its reference answer; the harness uses BART's public demo key as a fallback, set `BART_API_KEY` to use your own.

The agent environment is an allowlist (`ENV_ALLOW` in `src/run.ts`; extra names via `BENCH_ENV_PASS`). The r9 run used the earlier denylist (deviation 9 of its prereg).

## Public export

`scripts/export-public.sh` builds `../public-bench` from `git archive HEAD` plus scrubbed copies of the r9 and r10 rows and transcripts and the r7/r8 summaries (`scripts/scrub_results.py`: ids, rate-limit and plan fields, local paths and challenge tokens removed; tool-result page text cut to 300 characters plus a sha256).

## Layout

- `src/` harness (`run.ts`), scoring contract, checkers' shared code, report generators (`final.py` is the one used for r9 and r10), tests in `tests/`.
- `blind/`, `blind2/`, `blind3/`, `blind4/` task suites (b1-b20, c1-c20, d1-d40, g1-g40); `src/tasks.ts` the earlier fixture-based suites.
- `guard/` pre-registrations, results and rules. `manifest-*.json` select which result directories a report uses.

Unmaintained: the Codex runner (`--runner codex`) and the `ab-mcp` / `ab-mcp-min` variants (agent-browser's MCP mode) are kept because earlier rounds used them, but were not exercised for r9 and may not work with current CLIs.

## Known limitations

- r10: one model, one machine, one day, headless Chrome for Testing, no logins. The tasks read live sites, so results drift and some sites block automation (g26 failed for every tool because the site blocked it).
- r10 has one run per task (N=1): the intervals capture variation between tasks, not between repetitions of the same task, and a single run per cell can be dominated by chance on borderline tasks.
- r10 compares my tuned stub (self-contained, so the agent does not spend a step loading a guide) with upstream's stock stub. The static/dynamic split and the step counts are published for that reason; I do not claim that the code alone explains the result.
- The tasks were written by an LLM agent I started, which had no access to the fork's code or earlier results. I also wrote the plan and ran the benchmark, working with AI agents ("the coordinator" in the preregistration is me). g20's forbidden-URL pattern is wrong (it matches the page the task asks for); g4, g26 and g36 were failed by all three tools, and I have not audited their reference answers.
- Cost is Claude Code's reported API-equivalent dollars under a one-hour prompt cache. The static/dynamic split is a model built on measured first-turn usage, and the "priced alike" sensitivity depends on how "alike" is defined (here: the same cache-write token count for every run, the median over all runs).
- Heuristic detectors: policy violations and "fetch outside the browser" are detected from transcripts and recorded navigations, not proven.
- r9: two runs per task, success difference CI -6.2 to +7.5 points; d16's reference answer is wrong; the workflow-compliance check was vacuous for blind3 (deviation 6 of its prereg).
- The Codex runner and ab-mcp variants are unmaintained (above).

## Licence

MIT, see [LICENSE](LICENSE). Nothing in this repository forces a different licence: it contains no code copied from agent-browser (Apache-2.0) or browse (MIT), which are used as external binaries. The benchmark tasks describe public web pages and contain none of their content.
