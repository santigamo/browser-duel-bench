# r9 report: ab-cli:r9 / browse-mcp

## r9 gates (guard/prereg-r9.md): ab-cli:r9 / browse-mcp, blind3 tasks

| gate | estimate [95% CI] | threshold | verdict |
|---|---|---|---|
| cost (cost_usd) ratio | 0.75 [0.65, 0.86] (40 tasks) | point <= 0.85 and upper bound < 1 | PASS |
| peak context ratio | 0.57 [0.53, 0.60] (40 tasks) | point <= 0.90 and upper bound < 1 | PASS |
| compliant success difference (pts) | +0.0 [-6.2, +7.5] (40 tasks) | claim "at least equal" only if lower bound >= -5 | CLAIM NOT MADE |
| wall (charged), descriptive | 0.90 [0.77, 1.07] (40 tasks) | claim "not slower" only if upper bound < 1.10 | CLAIM MADE |

All other measures and sensitivities in this report are published whatever the outcome; the gates above do not select which are shown.

Primary: real cost_usd, peak context (largest prompt of any turn, from the transcript; Claude runs) and compliant success (success AND clean). cost_weighted is a token-weighted proxy and secondary. Provider-limit rows (status=quota_abort) are excluded and counted below. Bootstrap seed 7, 2000 resamples.

## Completeness (expected vs present task x variant x rep cells)

| result dir | expected | present | missing | quota_abort rows dropped | excluded tasks (reason) | replaced tasks (by) |
|---|---|---|---|---|---|---|
| results/2026-11-13T10-51-21-blind3-final | 160 | 160 | 0 | 0 | - | - |

Total: 160 of 160 expected cells present.

## Cost coverage (cost_usd source per row)

| variant | rows | reported | ESTIMATE (cut before result event, priced from partial usage, a floor) | none |
|---|---|---|---|---|
| ab-cli:r9 | 80 | 80 | 0 | 0 |
| browse-mcp | 80 | 77 | 3 | 0 |
Estimated costs are included in every cost_usd statistic below and are labelled here; rows with none (e.g. Codex, which reports no USD) have no cost_usd and are absent from cost statistics, not counted as zero.

## Success per group: compliant (success AND clean) / raw success

| group | ab-cli:r9 | browse-mcp |
|---|---|---|
| blind3 (d1-d40) | 70/80 (raw 70) | 70/80 (raw 70) |

## Medians per group

| group | variant | cost USD | peak context | wall s | steps | cost-weighted (proxy) |
|---|---|---|---|---|---|---|
| blind3 (d1-d40) | ab-cli:r9 | 0.0158 | 6312 | 9.0 | 2 | 4190 |
| blind3 (d1-d40) | browse-mcp | 0.0193 | 11374 | 8.7 | 1 | 6251 |

## Pairwise comparisons (per-task median ratio, geomean over tasks, 95% bootstrap CI)

### ab-cli:r9 vs browse-mcp: ab-cli:r9 / browse-mcp (below 1 = ab-cli:r9 better), FIXED suite, runs resampled within tasks

| group (tasks) | cost USD (primary) | peak context tokens | steps | wall s | cost-weighted tokens (PROXY) | compliant success a-b (pts) |
|---|---|---|---|---|---|---|
| blind3 (d1-d40) (40) | 0.75 [0.71, 0.80] | 0.57 [0.56, 0.58] | 1.05 [0.99, 1.16] | 0.90 [0.85, 1.00] | 0.65 [0.61, 0.70] | +0.0 [-2.5, +2.5] |

### ab-cli:r9 vs browse-mcp: ab-cli:r9 / browse-mcp (below 1 = ab-cli:r9 better), HIERARCHICAL, tasks resampled then runs within tasks

| group (tasks) | cost USD (primary) | peak context tokens | steps | wall s | cost-weighted tokens (PROXY) | compliant success a-b (pts) |
|---|---|---|---|---|---|---|
| blind3 (d1-d40) (40) | 0.75 [0.66, 0.86] | 0.57 [0.54, 0.60] | 1.05 [0.91, 1.25] | 0.90 [0.77, 1.07] | 0.65 [0.57, 0.75] | +0.0 [-6.2, +7.5] |

## Per-task medians (cost USD / steps / wall s) and compliant success

| task | ab-cli:r9 | browse-mcp |
|---|---|---|
| d1 | 0.012 / 1 / 6.6 (2/2) | 0.034 / 1 / 6.8 (2/2) |
| d2 | 0.021 / 4 / 11.3 (2/2) | 0.021 / 3 / 9.2 (2/2) |
| d3 | 0.012 / 1 / 11.6 (2/2) | 0.018 / 1 / 9.9 (2/2) |
| d4 | 0.107 / 16 / 62.0 (0/2) | 0.081 / 12 / 139.8 (0/2) |
| d5 | 0.014 / 4 / 8.0 (0/2) | 0.014 / 2 / 5.8 (0/2) |
| d6 | 0.039 / 6 / 64.8 (2/2) | 0.033 / 4 / 44.1 (2/2) |
| d7 | 0.011 / 1 / 22.7 (2/2) | 0.012 / 1 / 19.2 (2/2) |
| d8 | 0.030 / 4 / 13.0 (1/2) | 0.050 / 6 / 14.6 (2/2) |
| d9 | 0.013 / 2 / 10.6 (2/2) | 0.017 / 2 / 8.7 (2/2) |
| d10 | 0.014 / 2 / 7.5 (2/2) | 0.019 / 2 / 24.9 (2/2) |
| d11 | 0.019 / 2 / 7.0 (2/2) | 0.023 / 2 / 7.5 (2/2) |
| d12 | 0.064 / 8 / 69.3 (1/2) | 0.050 / 4 / 74.2 (2/2) |
| d13 | 0.010 / 1 / 7.9 (2/2) | 0.017 / 1 / 7.9 (2/2) |
| d14 | 0.011 / 2 / 16.2 (2/2) | 0.013 / 1 / 12.9 (2/2) |
| d15 | 0.006 / 1 / 5.2 (2/2) | 0.033 / 1 / 4.6 (2/2) |
| d16 | 0.087 / 12 / 85.7 (0/2) | 0.098 / 12 / 98.7 (0/2) |
| d17 | 0.010 / 2 / 6.3 (0/2) | 0.012 / 1 / 4.8 (0/2) |
| d18 | 0.075 / 12 / 44.3 (2/2) | 0.044 / 4 / 34.6 (2/2) |
| d19 | 0.022 / 1 / 5.0 (2/2) | 0.026 / 1 / 5.2 (2/2) |
| d20 | 0.009 / 1 / 4.3 (2/2) | 0.010 / 1 / 3.8 (2/2) |
| d21 | 0.017 / 3 / 7.4 (2/2) | 0.015 / 3 / 15.0 (0/2) |
| d22 | 0.019 / 1 / 9.8 (2/2) | 0.028 / 1 / 11.4 (2/2) |
| d23 | 0.017 / 2 / 10.6 (2/2) | 0.034 / 2 / 12.8 (2/2) |
| d24 | 0.019 / 2 / 11.4 (2/2) | 0.019 / 2 / 26.3 (2/2) |
| d25 | 0.008 / 1 / 5.5 (2/2) | 0.012 / 1 / 5.0 (2/2) |
| d26 | 0.036 / 7 / 19.1 (2/2) | 0.034 / 4 / 12.8 (2/2) |
| d27 | 0.016 / 3 / 9.6 (2/2) | 0.019 / 2 / 7.3 (2/2) |
| d28 | 0.011 / 1 / 5.8 (2/2) | 0.013 / 1 / 5.0 (2/2) |
| d29 | 0.011 / 1 / 5.7 (2/2) | 0.014 / 1 / 5.1 (2/2) |
| d30 | 0.010 / 2 / 11.5 (2/2) | 0.013 / 2 / 13.6 (2/2) |
| d31 | 0.018 / 2 / 11.8 (2/2) | 0.063 / 8 / 73.3 (2/2) |
| d32 | 0.016 / 2 / 7.2 (2/2) | 0.020 / 3 / 7.3 (2/2) |
| d33 | 0.015 / 2 / 7.2 (2/2) | 0.023 / 2 / 8.3 (2/2) |
| d34 | 0.008 / 1 / 5.3 (2/2) | 0.011 / 1 / 4.7 (2/2) |
| d35 | 0.008 / 1 / 10.1 (2/2) | 0.016 / 1 / 8.8 (2/2) |
| d36 | 0.015 / 2 / 7.8 (2/2) | 0.033 / 4 / 44.4 (2/2) |
| d37 | 0.015 / 1 / 7.8 (2/2) | 0.017 / 1 / 8.5 (2/2) |
| d38 | 0.017 / 2 / 11.0 (2/2) | 0.022 / 1 / 8.7 (2/2) |
| d39 | 0.020 / 2 / 9.7 (2/2) | 0.026 / 2 / 10.3 (2/2) |
| d40 | 0.008 / 1 / 4.7 (2/2) | 0.012 / 1 / 4.1 (2/2) |

## Non-compliant runs

- d4 ab-cli:r9 #1: answer does not match the reference. answer='unavailable — the fare calculator returned an error, so no fares were ' truth='clipper=15.35 senior=5.75' 
- d4 ab-cli:r9 #2: answer does not match the reference. answer='unavailable — the calculator returned an error and showed no fares' truth='clipper=15.35 senior=5.75' 
- d4 browse-mcp #1: handoff to a human (The BART fare calculator returns a 403 error when automated. Dublin/Pleasanton and SFO are). answer='Let me try a real mouse click on the Go button after scrolling it into' truth='' 
- d4 browse-mcp #2: answer does not match the reference. answer='unable to determine; the BART fare calculator returned a 403 error and' truth='clipper=15.35 senior=5.75' 
- d5 ab-cli:r9 #1: answer does not match the reference. answer='unable to determine — registry.faa.gov returned Access Denied' truth='N172SP:1977 N100:1940 N77:1988' 
- d5 ab-cli:r9 #2: answer does not match the reference. answer='unable to determine – registry.faa.gov denied access' truth='N172SP:1977 N100:1940 N77:1988' 
- d5 browse-mcp #1: answer does not match the reference. answer='unable to determine, the FAA registry blocked access (403 Access Denie' truth='N172SP:1977 N100:1940 N77:1988' 
- d5 browse-mcp #2: answer does not match the reference. answer='unable to determine — registry.faa.gov blocked access' truth='N172SP:1977 N100:1940 N77:1988' 
- d8 ab-cli:r9 #2: answer does not match the reference. answer='CA=6.003; WA=5.298; higher=CA' truth='CA=5.888 WA=5.203' 
- d12 ab-cli:r9 #2: answer does not match the reference. answer='VT=25; NH=44; ME=29' truth='VT=12 NH=16 ME=22' 
- d16 ab-cli:r9 #1: answer does not match the reference. answer='0' truth='50' 
- d16 ab-cli:r9 #2: answer does not match the reference. answer='0' truth='50' 
- d16 browse-mcp #1: answer does not match the reference. answer='0' truth='50' 
- d16 browse-mcp #2: answer does not match the reference. answer='0' truth='50' 
- d17 ab-cli:r9 #1: answer does not match the reference. answer='odyssey=unknown; f150=unknown' truth='odyssey2018=16 f150_2015=14' 
- d17 ab-cli:r9 #2: answer does not match the reference. answer='odyssey=unknown; f150=unknown' truth='odyssey2018=16 f150_2015=14' 
- d17 browse-mcp #1: answer does not match the reference. answer='odyssey=unknown; f150=unknown' truth='odyssey2018=16 f150_2015=14' 
- d17 browse-mcp #2: answer does not match the reference. answer='odyssey=unknown; f150=unknown' truth='odyssey2018=16 f150_2015=14' 
- d21 browse-mcp #1: handoff to a human (Solve the security check on https://lichess.org, then click Continue). answer='' truth='' 
- d21 browse-mcp #2: handoff to a human (Please complete the Cloudflare verification on the lichess.org tab, then I'll continue.). answer='Cloudflare challenge; let me wait briefly to see if it clears itself.' truth='' 

## Handoff, timeouts and completion

A human handoff (guard/handoff-policy.md) ends the run; when a result predates the rule it is applied post hoc to the stored transcripts and the row says so (handoff=true). Charged wall = time until the handoff call started. completion rate = runs that ended by themselves (status ok or fail) over all runs; timeouts are unresolved active execution only. Active latency = wall of runs that ended by themselves.

| variant | runs | handoff (rate) | timeout (rate) | completion rate | median charged wall s (all runs) | median active latency s (completed runs) | median raw wall s (before the handoff charge) |
|---|---|---|---|---|---|---|---|
| ab-cli:r9 | 80 | 0 (0.0%) | 0 (0.0%) | 100.0% | 9.0 | 9.0 | 9.0 |
| browse-mcp | 80 | 3 (3.8%) | 0 (0.0%) | 96.2% | 8.7 | 8.6 | 8.7 |

Handoff runs (charged wall s / raw wall s): d4 browse-mcp #1 164.1/164.4; d21 browse-mcp #1 18.9/19.3; d21 browse-mcp #2 11.2/11.8

## Cost per compliant success

Total cost_usd of the runs that have one, divided by their compliant successes (success AND clean). Failed and handed-off runs still cost money and are in the numerator.

| variant | total cost USD | compliant successes | cost per compliant success | runs without a cost (excluded here) |
|---|---|---|---|---|
| ab-cli:r9 | 1.7792 | 70 | 0.0254 | 0 |
| browse-mcp | 2.1393 | 70 | 0.0306 | 0 |

- ab-cli:r9 / browse-mcp: cost per compliant success ratio 0.83 [0.67, 1.00] over 40 tasks (pooled, hierarchical bootstrap; below 1 = ab-cli:r9 cheaper per compliant success)

## Static / dynamic split of cost and context

The static part is the first-turn prompt (tool definitions, system prompt, task): it comes from the size of each tool's interface, not from how well the tool is used, and it is re-read on every turn. The dynamic part is what the run itself added. Static cost is a MODEL built on measured numbers, not a measurement: the own input of the first assistant turn (input, cache-write and cache-read tokens) priced at the fitted rates, plus that first-turn prefix re-read at the cache-read rate on each later API turn (turns counted by distinct message id); dynamic cost = cost_usd minus static. Publish both whatever the outcome.

| variant | median static context | median dynamic context | median static cost USD (model) | median dynamic cost USD (model) |
|---|---|---|---|---|
| ab-cli:r9 | 5024 | 1288 | 0.00491 | 0.01049 |
| browse-mcp | 9845 | 1536 | 0.00781 | 0.01045 |

- ab-cli:r9 / browse-mcp: static cost ratio 0.53 [0.46, 0.58] over 40 tasks
- ab-cli:r9 / browse-mcp: dynamic cost ratio 0.92 [0.77, 1.08] over 40 tasks
- ab-cli:r9 / browse-mcp: static context (first turn) ratio 0.51 [0.51, 0.51] over 40 tasks

## Context: peak and dynamic peak

Dynamic peak = peak prompt size minus the run's first-turn prompt size (the tool definitions, system prompt and task are a fixed cost that differs per tool; dynamic is what the run itself accumulated). Peak is taken from the stored peak_ctx or, where it is missing (all of blind 1), computed from the transcript. Claude runs only.

| variant | runs with usage | median first-turn | median peak | median dynamic peak |
|---|---|---|---|---|
| ab-cli:r9 | 80 | 5024 | 6312 | 1288 |
| browse-mcp | 80 | 9845 | 11374 | 1536 |

- ab-cli:r9 / browse-mcp: peak context ratio 0.57 [0.54, 0.60] over 40 tasks
- ab-cli:r9 / browse-mcp: dynamic peak context ratio 0.78 [0.62, 0.97] over 40 tasks

## Sensitivity: only tasks where both reach >= 2/3 compliant success: ab-cli:r9 / browse-mcp

33 tasks: d1, d2, d3, d6, d7, d9, d10, d11, d13, d14, d15, d18, d19, d20, d22, d23, d24, d25, d26, d27, d28, d29, d30, d31, d32, d33, d34, d35, d36, d37, d38, d39, d40. Same estimators as above restricted to these tasks (the comparison no longer rewards or punishes a tool for tasks the other cannot do).

| metric | ratio ab-cli:r9 / browse-mcp [95% CI] | tasks |
|---|---|---|
| wall s (charged) | 0.91 [0.75, 1.11] | 33 |
| cost USD | 0.71 [0.61, 0.83] | 33 |
| peak context | 0.55 [0.52, 0.58] | 33 |
| dynamic peak context | 0.74 [0.57, 0.94] | 33 |
| steps (descriptive) | 1.00 [0.86, 1.19] | 33 |
| cost per compliant success | 0.75 [0.60, 0.94] | 33 |

Compliant success difference on these tasks: +0.0 pts [+0.0, +0.0].

## Workflow compliance (scored apart from answer correctness)

Only tasks with a workflow rubric (guard/endpoint-policy.md). Descriptive only: the rubric check for form interaction (INTERACT in blind3/tasks.ts) matches almost any tool input, so it cannot fail a run that interacted with nothing. A "strict compliant success" built on it was withdrawn (guard/prereg-r9.md, POST HOC deviation 6) and is not reported.

| variant | runs with a rubric | workflow ok | compliant success (all runs) |
|---|---|---|---|
| ab-cli:r9 | 80 | 78 | 70/80 |
| browse-mcp | 80 | 78 | 70/80 |

- ab-cli:r9 - browse-mcp workflow compliance difference +0.0 pts [+0.0, +0.0] over 40 tasks

## Leave-one-task-out ranges (r9 / browse-mcp, blind3)

Each statistic recomputed 40 times, dropping one task each time (point estimates, no resampling). The all-tasks value is the gate point estimate.

| statistic | all tasks | leave-one-out min | task dropped for min | leave-one-out max | task dropped for max |
|---|---|---|---|---|---|
| cost ratio | 0.751 | 0.735 | d18 | 0.777 | d15 |
| peak context ratio | 0.567 | 0.558 | d4 | 0.575 | d15 |
| dynamic peak context ratio | 0.780 | 0.761 | d20 | 0.841 | d15 |
| static cost ratio (model) | 0.531 | 0.520 | d12 | 0.540 | d1 |
| dynamic cost ratio (model) | 0.916 | 0.899 | d18 | 0.966 | d15 |
| wall ratio (charged) | 0.897 | 0.886 | d26 | 0.938 | d31 |
| wall ratio (duration_ms) | 0.945 | 0.933 | d26 | 0.991 | d31 |
| compliant success difference (pts) | +0.0 | -2.6 | d21 | +1.3 | d8 |

## Sensitivities (r9 / browse-mcp, blind3)

Hierarchical bootstrap 95% CI, seed 7, 2000 resamples per row; ratios below 1 favour r9, success is r9 minus browse in points. The first row is the gate analysis.

| sensitivity | tasks | cost | peak context | wall | compliant success diff (pts) |
|---|---|---|---|---|---|
| all 40 tasks (gate analysis) | 40 | 0.75 [0.65, 0.86] | 0.57 [0.53, 0.60] | 0.90 [0.77, 1.07] | +0.0 [-6.2, +7.5] |
| tasks where both reach >= 2/3 compliant success (at N=2: both succeed 2 of 2): 33 tasks | 33 | 0.71 [0.61, 0.83] | 0.55 [0.52, 0.59] | 0.91 [0.76, 1.12] | +0.0 [+0.0, +0.0] |
| excluding tasks failed by every tool (d4, d5, d16, d17) | 36 | 0.73 [0.63, 0.85] | 0.56 [0.53, 0.59] | 0.90 [0.75, 1.09] | +0.0 [-6.9, +8.3] |
| excluding d16 (reference answer wrong for the site UI, ungradable) | 39 | 0.75 [0.65, 0.86] | 0.56 [0.53, 0.60] | 0.90 [0.77, 1.08] | +0.0 [-6.4, +7.7] |
| excluding d21 (browse blocked by Cloudflare, r9 passed) | 39 | 0.74 [0.65, 0.86] | 0.57 [0.53, 0.60] | 0.91 [0.78, 1.09] | -2.6 [-7.7, +0.0] |
| repetition 1 only | 40 | 0.82 [0.71, 0.94] | 0.58 [0.54, 0.62] | 0.87 [0.70, 1.06] | +2.5 [+0.0, +7.5] |
| repetition 2 only | 40 | 0.69 [0.60, 0.80] | 0.56 [0.52, 0.59] | 1.01 [0.87, 1.16] | -2.5 [-12.5, +5.0] |
| wall from Claude Code duration_ms (3 runs without a result event are absent from the wall column) | 40 | 0.75 [0.65, 0.86] | 0.57 [0.53, 0.60] | 0.95 [0.79, 1.15] | +0.0 [-6.2, +7.5] |

Cost, with the first turn priced differently for both tools (all other turns as reported). first-turn cost as measured = input x 2 + cache write x 4 + cache read x 0.1 (per million); each variant replaces only that term:

| cost variant | tasks | cost ratio [95% CI] |
|---|---|---|
| as reported (gate analysis) | 40 | 0.75 [0.65, 0.86] |
| both first-turn cache writes priced alike: every run is charged the same write count (the median over all runs, 1007 tokens) at the write rate, the rest of its first turn at the read rate | 40 | 0.88 [0.78, 1.00] |
| whole first turn read from cache (first_ctx x read rate) | 40 | 0.84 [0.72, 0.98] |
| cold cache: whole first turn written (first_ctx x write rate) | 40 | 0.62 [0.57, 0.67] |

