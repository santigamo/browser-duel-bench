# r10 report: ab-cli:r10 / ab-cli:v043 (secondary browse-mcp)

## r10 gates, PRIMARY (guard/prereg-r10.md): ab-cli:r10 / ab-cli:v043, blind4 tasks

| gate | estimate [95% CI] | threshold | verdict |
|---|---|---|---|
| cost (cost_usd) ratio | 0.56 [0.49, 0.66] (40 tasks) | point <= 0.85 and upper bound < 1 | PASS |
| peak context ratio | 0.74 [0.69, 0.81] (40 tasks) | point <= 0.90 and upper bound < 1 | PASS |
| compliant success difference (pts) | +0.0 [+0.0, +0.0] (40 tasks) | claim "at least equal" only if lower bound >= -5 | CLAIM MADE |
| wall (charged), descriptive | 0.71 [0.61, 0.84] (40 tasks) | claim "not slower" only if upper bound < 1.10 | CLAIM MADE |

All other measures and sensitivities in this report are published whatever the outcome; the gates above do not select which are shown.

## r10 gates, SECONDARY (descriptive): ab-cli:r10 / browse-mcp, blind4 tasks

| gate | estimate [95% CI] | threshold | verdict |
|---|---|---|---|
| cost (cost_usd) ratio | 0.83 [0.72, 0.96] (40 tasks) | point <= 0.85 and upper bound < 1 | PASS |
| peak context ratio | 0.58 [0.54, 0.63] (40 tasks) | point <= 0.90 and upper bound < 1 | PASS |
| compliant success difference (pts) | +0.0 [+0.0, +0.0] (40 tasks) | claim "at least equal" only if lower bound >= -5 | CLAIM MADE |
| wall (charged), descriptive | 1.09 [0.89, 1.30] (40 tasks) | claim "not slower" only if upper bound < 1.10 | CLAIM NOT MADE |

All other measures and sensitivities in this report are published whatever the outcome; the gates above do not select which are shown.

Primary: real cost_usd, peak context (largest prompt of any turn, from the transcript; Claude runs) and compliant success (success AND clean). cost_weighted is a token-weighted proxy and secondary. Provider-limit rows (status=quota_abort) are excluded and counted below. Bootstrap seed 7, 2000 resamples.

## Completeness (expected vs present task x variant x rep cells)

| result dir | expected | present | missing | quota_abort rows dropped | excluded tasks (reason) | replaced tasks (by) |
|---|---|---|---|---|---|---|
| results/2026-11-14T13-58-33-blind4-final | 120 | 120 | 0 | 0 | - | - |

Total: 120 of 120 expected cells present.

## Cost coverage (cost_usd source per row)

| variant | rows | reported | ESTIMATE (cut before result event, priced from partial usage, a floor) | none |
|---|---|---|---|---|
| ab-cli:r10 | 40 | 40 | 0 | 0 |
| ab-cli:v043 | 40 | 40 | 0 | 0 |
| browse-mcp | 40 | 40 | 0 | 0 |
Estimated costs are included in every cost_usd statistic below and are labelled here; rows with none (e.g. Codex, which reports no USD) have no cost_usd and are absent from cost statistics, not counted as zero.

## Success per group: compliant (success AND clean) / raw success

| group | ab-cli:r10 | ab-cli:v043 | browse-mcp |
|---|---|---|---|
| blind4 (g1-g40) | 36/40 (raw 37) | 36/40 (raw 37) | 36/40 (raw 37) |

## Medians per group

| group | variant | cost USD | peak context | wall s | steps | cost-weighted (proxy) |
|---|---|---|---|---|---|---|
| blind4 (g1-g40) | ab-cli:r10 | 0.0141 | 6088 | 8.0 | 2 | 3768 |
| blind4 (g1-g40) | ab-cli:v043 | 0.0276 | 8280 | 11.9 | 4 | 8104 |
| blind4 (g1-g40) | browse-mcp | 0.0181 | 11148 | 7.3 | 2 | 5836 |

## Pairwise comparisons (per-task median ratio, geomean over tasks, 95% bootstrap CI)

### ab-cli:r10 vs ab-cli:v043: ab-cli:r10 / ab-cli:v043 (below 1 = ab-cli:r10 better), FIXED suite, runs resampled within tasks

| group (tasks) | cost USD (primary) | peak context tokens | steps | wall s | cost-weighted tokens (PROXY) | compliant success a-b (pts) |
|---|---|---|---|---|---|---|
| blind4 (g1-g40) (40) | 0.56 [0.56, 0.56] | 0.74 [0.74, 0.74] | 0.45 [0.45, 0.45] | 0.71 [0.71, 0.71] | 0.51 [0.51, 0.51] | +0.0 [+0.0, +0.0] |

### ab-cli:r10 vs ab-cli:v043: ab-cli:r10 / ab-cli:v043 (below 1 = ab-cli:r10 better), HIERARCHICAL, tasks resampled then runs within tasks

| group (tasks) | cost USD (primary) | peak context tokens | steps | wall s | cost-weighted tokens (PROXY) | compliant success a-b (pts) |
|---|---|---|---|---|---|---|
| blind4 (g1-g40) (40) | 0.56 [0.49, 0.66] | 0.74 [0.69, 0.81] | 0.45 [0.37, 0.56] | 0.71 [0.61, 0.85] | 0.51 [0.43, 0.61] | +0.0 [+0.0, +0.0] |

### ab-cli:r10 vs browse-mcp: ab-cli:r10 / browse-mcp (below 1 = ab-cli:r10 better), FIXED suite, runs resampled within tasks

| group (tasks) | cost USD (primary) | peak context tokens | steps | wall s | cost-weighted tokens (PROXY) | compliant success a-b (pts) |
|---|---|---|---|---|---|---|
| blind4 (g1-g40) (40) | 0.83 [0.83, 0.83] | 0.58 [0.58, 0.58] | 1.03 [1.03, 1.03] | 1.09 [1.09, 1.09] | 0.70 [0.70, 0.70] | +0.0 [+0.0, +0.0] |

### ab-cli:r10 vs browse-mcp: ab-cli:r10 / browse-mcp (below 1 = ab-cli:r10 better), HIERARCHICAL, tasks resampled then runs within tasks

| group (tasks) | cost USD (primary) | peak context tokens | steps | wall s | cost-weighted tokens (PROXY) | compliant success a-b (pts) |
|---|---|---|---|---|---|---|
| blind4 (g1-g40) (40) | 0.83 [0.71, 0.97] | 0.58 [0.54, 0.62] | 1.03 [0.88, 1.22] | 1.09 [0.90, 1.31] | 0.70 [0.61, 0.82] | +0.0 [+0.0, +0.0] |

## Per-task medians (cost USD / steps / wall s) and compliant success

| task | ab-cli:r10 | ab-cli:v043 | browse-mcp |
|---|---|---|---|
| g1 | 0.028 / 3 / 36.7 (1/1) | 0.051 / 5 / 13.5 (1/1) | 0.054 / 2 / 6.6 (1/1) |
| g2 | 0.072 / 11 / 51.7 (1/1) | 0.034 / 3 / 15.6 (1/1) | 0.031 / 2 / 10.6 (1/1) |
| g3 | 0.034 / 6 / 21.2 (1/1) | 0.076 / 14 / 39.4 (1/1) | 0.030 / 4 / 9.3 (1/1) |
| g4 | 0.012 / 1 / 7.4 (0/1) | 0.026 / 4 / 10.9 (0/1) | 0.013 / 1 / 5.9 (0/1) |
| g5 | 0.019 / 3 / 12.2 (1/1) | 0.049 / 4 / 20.0 (1/1) | 0.039 / 4 / 109.9 (1/1) |
| g6 | 0.011 / 1 / 6.5 (1/1) | 0.029 / 2 / 8.5 (1/1) | 0.017 / 2 / 7.6 (1/1) |
| g7 | 0.026 / 4 / 11.9 (1/1) | 0.028 / 3 / 13.6 (1/1) | 0.024 / 3 / 9.1 (1/1) |
| g8 | 0.013 / 1 / 4.2 (1/1) | 0.027 / 4 / 10.3 (1/1) | 0.019 / 2 / 5.6 (1/1) |
| g9 | 0.009 / 1 / 4.6 (1/1) | 0.025 / 4 / 10.4 (1/1) | 0.012 / 1 / 5.1 (1/1) |
| g10 | 0.011 / 1 / 7.1 (1/1) | 0.031 / 6 / 13.6 (1/1) | 0.013 / 1 / 5.8 (1/1) |
| g11 | 0.063 / 1 / 6.6 (1/1) | 0.021 / 2 / 7.1 (1/1) | 0.014 / 1 / 5.1 (1/1) |
| g12 | 0.014 / 1 / 6.5 (1/1) | 0.032 / 6 / 15.1 (1/1) | 0.022 / 2 / 7.1 (1/1) |
| g13 | 0.017 / 1 / 5.5 (1/1) | 0.025 / 4 / 9.8 (1/1) | 0.020 / 1 / 5.9 (1/1) |
| g14 | 0.013 / 1 / 8.0 (1/1) | 0.035 / 4 / 20.9 (1/1) | 0.017 / 1 / 8.9 (1/1) |
| g15 | 0.010 / 1 / 5.9 (1/1) | 0.023 / 3 / 9.5 (1/1) | 0.018 / 2 / 7.3 (1/1) |
| g16 | 0.050 / 10 / 51.5 (1/1) | 0.091 / 18 / 39.4 (1/1) | 0.062 / 7 / 34.7 (1/1) |
| g17 | 0.014 / 1 / 4.9 (1/1) | 0.024 / 3 / 9.6 (1/1) | 0.018 / 1 / 5.2 (1/1) |
| g18 | 0.020 / 2 / 6.9 (1/1) | 0.039 / 6 / 17.1 (1/1) | 0.026 / 2 / 7.3 (1/1) |
| g19 | 0.110 / 15 / 96.0 (1/1) | 0.059 / 7 / 41.9 (1/1) | 0.044 / 4 / 68.7 (1/1) |
| g20 | 0.012 / 1 / 5.4 (0/1) | 0.024 / 2 / 7.6 (0/1) | 0.017 / 1 / 5.8 (0/1) |
| g21 | 0.035 / 4 / 11.2 (1/1) | 0.038 / 4 / 13.8 (1/1) | 0.035 / 3 / 11.5 (1/1) |
| g22 | 0.018 / 2 / 14.6 (1/1) | 0.041 / 8 / 24.7 (1/1) | 0.028 / 3 / 14.7 (1/1) |
| g23 | 0.010 / 1 / 10.7 (1/1) | 0.018 / 2 / 9.7 (1/1) | 0.013 / 1 / 11.1 (1/1) |
| g24 | 0.010 / 1 / 5.1 (1/1) | 0.024 / 3 / 10.3 (1/1) | 0.013 / 1 / 4.9 (1/1) |
| g25 | 0.015 / 3 / 9.7 (1/1) | 0.024 / 4 / 11.7 (1/1) | 0.015 / 2 / 6.0 (1/1) |
| g26 | 0.016 / 2 / 9.5 (0/1) | 0.035 / 6 / 28.4 (0/1) | 0.029 / 4 / 10.2 (0/1) |
| g27 | 0.020 / 2 / 11.0 (1/1) | 0.021 / 2 / 7.5 (1/1) | 0.017 / 1 / 7.4 (1/1) |
| g28 | 0.010 / 1 / 10.6 (1/1) | 0.042 / 8 / 31.1 (1/1) | 0.040 / 1 / 11.2 (1/1) |
| g29 | 0.012 / 1 / 6.1 (1/1) | 0.023 / 4 / 11.5 (1/1) | 0.013 / 1 / 4.3 (1/1) |
| g30 | 0.018 / 2 / 7.9 (1/1) | 0.053 / 9 / 20.7 (1/1) | 0.025 / 3 / 9.1 (1/1) |
| g31 | 0.008 / 1 / 4.3 (1/1) | 0.023 / 3 / 10.0 (1/1) | 0.012 / 1 / 4.5 (1/1) |
| g32 | 0.012 / 1 / 5.2 (1/1) | 0.020 / 2 / 7.6 (1/1) | 0.018 / 2 / 7.3 (1/1) |
| g33 | 0.031 / 4 / 25.4 (1/1) | 0.036 / 6 / 16.0 (1/1) | 0.025 / 3 / 11.4 (1/1) |
| g34 | 0.012 / 1 / 8.0 (1/1) | 0.023 / 3 / 10.8 (1/1) | 0.014 / 1 / 6.7 (1/1) |
| g35 | 0.022 / 3 / 13.9 (1/1) | 0.063 / 8 / 26.6 (1/1) | 0.046 / 7 / 51.8 (1/1) |
| g36 | 0.013 / 2 / 6.3 (0/1) | 0.021 / 2 / 7.0 (0/1) | 0.018 / 1 / 4.8 (0/1) |
| g37 | 0.010 / 2 / 5.8 (1/1) | 0.019 / 3 / 7.3 (1/1) | 0.016 / 2 / 6.5 (1/1) |
| g38 | 0.012 / 1 / 7.4 (1/1) | 0.027 / 4 / 12.2 (1/1) | 0.014 / 1 / 5.5 (1/1) |
| g39 | 0.013 / 2 / 8.3 (1/1) | 0.019 / 2 / 7.8 (1/1) | 0.018 / 2 / 8.5 (1/1) |
| g40 | 0.021 / 3 / 9.1 (1/1) | 0.028 / 4 / 12.3 (1/1) | 0.018 / 2 / 6.5 (1/1) |

## Non-compliant runs

- g4 ab-cli:r10 #1: answer does not match the reference. answer='51' truth='{"6.1010":12,"6.1020":15,"6.1210":12,"6.1910":18}=' 
- g4 ab-cli:v043 #1: answer does not match the reference. answer='51' truth='{"6.1010":12,"6.1020":15,"6.1210":12,"6.1910":18}=' 
- g4 browse-mcp #1: answer does not match the reference. answer='51' truth='{"6.1010":12,"6.1020":15,"6.1210":12,"6.1910":18}=' 
- g20 ab-cli:r10 #1: answer ok but not clean (violations or missing evidence). answer='13; 12; 12; 37' truth='13; 12; 12; 37' violations=['direct-url: navigated to a URL matching /\\.json\\b|\\/api\\/|crandb|packages\\.rds|PACKAGES/i'] 
- g20 ab-cli:v043 #1: answer ok but not clean (violations or missing evidence). answer='13; 12; 12; 37' truth='13; 12; 12; 37' violations=['direct-url (recorded navigation): https://cran.r-project.org/web/packages/dplyr/index.html'] 
- g20 browse-mcp #1: answer ok but not clean (violations or missing evidence). answer='13; 12; 12; 37' truth='13; 12; 12; 37' violations=['direct-url: navigated to a URL matching /\\.json\\b|\\/api\\/|crandb|packages\\.rds|PACKAGES/i'] 
- g26 ab-cli:r10 #1: answer does not match the reference. answer='unable to determine – ndbc.noaa.gov returned 403 Request blocked for a' truth='51001; 4842' 
- g26 ab-cli:v043 #1: answer does not match the reference. answer='unable to determine – ndbc.noaa.gov returned 403 (CloudFront blocked) ' truth='51001; 4842' 
- g26 browse-mcp #1: answer does not match the reference. answer='unable to determine – ndbc.noaa.gov returned 403 (CloudFront block) fo' truth='51001; 4842' 
- g36 ab-cli:r10 #1: answer does not match the reference. answer='Montréal; 72.6' truth='Chicago; 72.2 (of 9 big cities)' 
- g36 ab-cli:v043 #1: answer does not match the reference. answer='Montréal; 72.6' truth='Chicago; 72.2 (of 9 big cities)' 
- g36 browse-mcp #1: answer does not match the reference. answer='New York; 69.3' truth='Chicago; 72.2 (of 9 big cities)' 

## Handoff, timeouts and completion

A human handoff (guard/handoff-policy.md) ends the run; when a result predates the rule it is applied post hoc to the stored transcripts and the row says so (handoff=true). Charged wall = time until the handoff call started. completion rate = runs that ended by themselves (status ok or fail) over all runs; timeouts are unresolved active execution only. Active latency = wall of runs that ended by themselves.

| variant | runs | handoff (rate) | timeout (rate) | completion rate | median charged wall s (all runs) | median active latency s (completed runs) | median raw wall s (before the handoff charge) |
|---|---|---|---|---|---|---|---|
| ab-cli:r10 | 40 | 0 (0.0%) | 0 (0.0%) | 100.0% | 8.0 | 8.0 | 8.0 |
| ab-cli:v043 | 40 | 0 (0.0%) | 0 (0.0%) | 100.0% | 11.9 | 11.9 | 11.9 |
| browse-mcp | 40 | 0 (0.0%) | 0 (0.0%) | 100.0% | 7.3 | 7.3 | 7.3 |

## Cost per compliant success

Total cost_usd of the runs that have one, divided by their compliant successes (success AND clean). Failed and handed-off runs still cost money and are in the numerator.

| variant | total cost USD | compliant successes | cost per compliant success | runs without a cost (excluded here) |
|---|---|---|---|---|
| ab-cli:r10 | 0.8758 | 36 | 0.0243 | 0 |
| ab-cli:v043 | 1.3490 | 36 | 0.0375 | 0 |
| browse-mcp | 0.9372 | 36 | 0.0260 | 0 |

- ab-cli:r10 / ab-cli:v043: cost per compliant success ratio 0.65 [0.51, 0.82] over 40 tasks (pooled, hierarchical bootstrap; below 1 = ab-cli:r10 cheaper per compliant success)
- ab-cli:r10 / browse-mcp: cost per compliant success ratio 0.93 [0.74, 1.19] over 40 tasks (pooled, hierarchical bootstrap; below 1 = ab-cli:r10 cheaper per compliant success)

## Static / dynamic split of cost and context

The static part is the first-turn prompt (tool definitions, system prompt, task): it comes from the size of each tool's interface, not from how well the tool is used, and it is re-read on every turn. The dynamic part is what the run itself added. Static cost is a MODEL built on measured numbers, not a measurement: the own input of the first assistant turn (input, cache-write and cache-read tokens) priced at the fitted rates, plus that first-turn prefix re-read at the cache-read rate on each later API turn (turns counted by distinct message id); dynamic cost = cost_usd minus static. Publish both whatever the outcome.

| variant | median static context | median dynamic context | median static cost USD (model) | median dynamic cost USD (model) |
|---|---|---|---|---|
| ab-cli:r10 | 5047 | 1008 | 0.00538 | 0.00902 |
| ab-cli:v043 | 5146 | 3160 | 0.00665 | 0.02054 |
| browse-mcp | 9880 | 1242 | 0.00891 | 0.00955 |

- ab-cli:r10 / ab-cli:v043: static cost ratio 0.84 [0.77, 0.92] over 40 tasks
- ab-cli:r10 / ab-cli:v043: dynamic cost ratio 0.46 [0.38, 0.56] over 40 tasks
- ab-cli:r10 / ab-cli:v043: static context (first turn) ratio 0.98 [0.98, 0.98] over 40 tasks
- ab-cli:r10 / browse-mcp: static cost ratio 0.63 [0.59, 0.68] over 40 tasks
- ab-cli:r10 / browse-mcp: dynamic cost ratio 1.00 [0.83, 1.19] over 40 tasks
- ab-cli:r10 / browse-mcp: static context (first turn) ratio 0.51 [0.51, 0.51] over 40 tasks

## Context: peak and dynamic peak

Dynamic peak = peak prompt size minus the run's first-turn prompt size (the tool definitions, system prompt and task are a fixed cost that differs per tool; dynamic is what the run itself accumulated). Peak is taken from the stored peak_ctx or, where it is missing (all of blind 1), computed from the transcript. Claude runs only.

| variant | runs with usage | median first-turn | median peak | median dynamic peak |
|---|---|---|---|---|
| ab-cli:r10 | 40 | 5047 | 6088 | 1008 |
| ab-cli:v043 | 40 | 5146 | 8280 | 3160 |
| browse-mcp | 40 | 9880 | 11148 | 1242 |

- ab-cli:r10 / ab-cli:v043: peak context ratio 0.74 [0.69, 0.81] over 40 tasks
- ab-cli:r10 / ab-cli:v043: dynamic peak context ratio 0.31 [0.25, 0.40] over 40 tasks
- ab-cli:r10 / browse-mcp: peak context ratio 0.58 [0.54, 0.63] over 40 tasks
- ab-cli:r10 / browse-mcp: dynamic peak context ratio 0.84 [0.65, 1.08] over 40 tasks

## Sensitivity: only tasks where both reach >= 2/3 compliant success: ab-cli:r10 / ab-cli:v043

36 tasks: g1, g2, g3, g5, g6, g7, g8, g9, g10, g11, g12, g13, g14, g15, g16, g17, g18, g19, g21, g22, g23, g24, g25, g27, g28, g29, g30, g31, g32, g33, g34, g35, g37, g38, g39, g40. Same estimators as above restricted to these tasks (the comparison no longer rewards or punishes a tool for tasks the other cannot do).

| metric | ratio ab-cli:r10 / ab-cli:v043 [95% CI] | tasks |
|---|---|---|
| wall s (charged) | 0.72 [0.61, 0.87] | 36 |
| cost USD | 0.57 [0.49, 0.68] | 36 |
| peak context | 0.75 [0.69, 0.82] | 36 |
| dynamic peak context | 0.32 [0.24, 0.43] | 36 |
| steps (descriptive) | 0.45 [0.36, 0.57] | 36 |
| cost per compliant success | 0.66 [0.51, 0.85] | 36 |

Compliant success difference on these tasks: +0.0 pts [+0.0, +0.0].

## Sensitivity: only tasks where both reach >= 2/3 compliant success: ab-cli:r10 / browse-mcp

36 tasks: g1, g2, g3, g5, g6, g7, g8, g9, g10, g11, g12, g13, g14, g15, g16, g17, g18, g19, g21, g22, g23, g24, g25, g27, g28, g29, g30, g31, g32, g33, g34, g35, g37, g38, g39, g40. Same estimators as above restricted to these tasks (the comparison no longer rewards or punishes a tool for tasks the other cannot do).

| metric | ratio ab-cli:r10 / browse-mcp [95% CI] | tasks |
|---|---|---|
| wall s (charged) | 1.09 [0.88, 1.33] | 36 |
| cost USD | 0.84 [0.72, 1.00] | 36 |
| peak context | 0.58 [0.54, 0.64] | 36 |
| dynamic peak context | 0.88 [0.67, 1.18] | 36 |
| steps (descriptive) | 1.03 [0.88, 1.23] | 36 |
| cost per compliant success | 0.96 [0.74, 1.23] | 36 |

Compliant success difference on these tasks: +0.0 pts [+0.0, +0.0].

## Workflow compliance (scored apart from answer correctness)

Only tasks with a workflow rubric (guard/endpoint-policy.md). Descriptive only: the rubric check for form interaction (INTERACT in blind3/tasks.ts) matches almost any tool input, so it cannot fail a run that interacted with nothing. A "strict compliant success" built on it was withdrawn (guard/prereg-r9.md, POST HOC deviation 6) and is not reported.

| variant | runs with a rubric | workflow ok | compliant success (all runs) |
|---|---|---|---|
| ab-cli:r10 | 40 | 38 | 36/40 |
| ab-cli:v043 | 40 | 39 | 36/40 |
| browse-mcp | 40 | 39 | 36/40 |

- ab-cli:r10 - ab-cli:v043 workflow compliance difference -2.5 pts [-7.5, +0.0] over 40 tasks
- ab-cli:r10 - browse-mcp workflow compliance difference -2.5 pts [-7.5, +0.0] over 40 tasks

## Leave-one-task-out ranges (ab-cli:r10 / ab-cli:v043, blind4, PRIMARY)

Each statistic recomputed 40 times, dropping one task each time (point estimates, no resampling). The all-tasks value is the gate point estimate.

| statistic | all tasks | leave-one-out min | task dropped for min | leave-one-out max | task dropped for max |
|---|---|---|---|---|---|
| cost ratio | 0.563 | 0.540 | g11 | 0.576 | g28 |
| peak context ratio | 0.742 | 0.720 | g11 | 0.750 | g35 |
| dynamic peak context ratio | 0.311 | 0.289 | g11 | 0.323 | g28 |
| static cost ratio (model) | 0.836 | 0.812 | g2 | 0.852 | g6 |
| dynamic cost ratio (model) | 0.460 | 0.436 | g11 | 0.474 | g28 |
| wall ratio (charged) | 0.713 | 0.686 | g2 | 0.727 | g26 |
| wall ratio (duration_ms) | 0.684 | 0.656 | g2 | 0.698 | g26 |
| compliant success difference (pts) | +0.0 | +0.0 | g1 | +0.0 | g9 |

## Sensitivities and cache variants (ab-cli:r10 / ab-cli:v043, blind4, PRIMARY)

Hierarchical bootstrap 95% CI, seed 7, 2000 resamples per row; ratios below 1 favour the first tool, success is the first tool minus the second in points. The first row is the gate analysis.

| sensitivity | tasks | cost | peak context | wall | compliant success diff (pts) |
|---|---|---|---|---|---|
| all 40 tasks (gate analysis) | 40 | 0.56 [0.49, 0.66] | 0.74 [0.69, 0.81] | 0.71 [0.61, 0.84] | +0.0 [+0.0, +0.0] |
| tasks where both reach >= 2/3 compliant success (at N=2: both succeed 2 of 2): 36 tasks | 36 | 0.57 [0.49, 0.68] | 0.75 [0.69, 0.82] | 0.72 [0.61, 0.87] | +0.0 [+0.0, +0.0] |
| excluding tasks failed by every tool (g4, g20, g26, g36) | 36 | 0.57 [0.49, 0.68] | 0.75 [0.69, 0.82] | 0.72 [0.61, 0.87] | +0.0 [+0.0, +0.0] |
| wall from Claude Code duration_ms (0 runs without a result event are absent from the wall column) | 40 | 0.56 [0.49, 0.66] | 0.74 [0.69, 0.81] | 0.68 [0.57, 0.82] | +0.0 [+0.0, +0.0] |

Cost, with the first turn priced differently for both tools (all other turns as reported). first-turn cost as measured = input x 2 + cache write x 4 + cache read x 0.1 (per million); each variant replaces only that term:

| cost variant | tasks | cost ratio [95% CI] |
|---|---|---|
| as reported (gate analysis) | 40 | 0.56 [0.49, 0.66] |
| both first-turn cache writes priced alike: every run is charged the same write count (the median over all runs, 1064 tokens) at the write rate, the rest of its first turn at the read rate | 40 | 0.57 [0.49, 0.66] |
| whole first turn read from cache (first_ctx x read rate) | 40 | 0.48 [0.40, 0.58] |
| cold cache: whole first turn written (first_ctx x write rate) | 40 | 0.72 [0.66, 0.80] |

## Leave-one-task-out ranges (ab-cli:r10 / browse-mcp, blind4, SECONDARY)

Each statistic recomputed 40 times, dropping one task each time (point estimates, no resampling). The all-tasks value is the gate point estimate.

| statistic | all tasks | leave-one-out min | task dropped for min | leave-one-out max | task dropped for max |
|---|---|---|---|---|---|
| cost ratio | 0.827 | 0.791 | g11 | 0.852 | g28 |
| peak context ratio | 0.575 | 0.559 | g11 | 0.584 | g28 |
| dynamic peak context ratio | 0.840 | 0.769 | g11 | 0.906 | g28 |
| static cost ratio (model) | 0.632 | 0.614 | g2 | 0.643 | g1 |
| dynamic cost ratio (model) | 0.996 | 0.939 | g11 | 1.044 | g28 |
| wall ratio (charged) | 1.088 | 1.043 | g1 | 1.154 | g5 |
| wall ratio (duration_ms) | 1.138 | 1.089 | g1 | 1.210 | g5 |
| compliant success difference (pts) | +0.0 | +0.0 | g1 | +0.0 | g9 |

## Sensitivities and cache variants (ab-cli:r10 / browse-mcp, blind4, SECONDARY)

Hierarchical bootstrap 95% CI, seed 7, 2000 resamples per row; ratios below 1 favour the first tool, success is the first tool minus the second in points. The first row is the gate analysis.

| sensitivity | tasks | cost | peak context | wall | compliant success diff (pts) |
|---|---|---|---|---|---|
| all 40 tasks (gate analysis) | 40 | 0.83 [0.72, 0.96] | 0.58 [0.54, 0.63] | 1.09 [0.89, 1.30] | +0.0 [+0.0, +0.0] |
| tasks where both reach >= 2/3 compliant success (at N=2: both succeed 2 of 2): 36 tasks | 36 | 0.84 [0.71, 0.98] | 0.58 [0.54, 0.64] | 1.09 [0.88, 1.33] | +0.0 [+0.0, +0.0] |
| excluding tasks failed by every tool (g4, g20, g26, g36) | 36 | 0.84 [0.71, 0.98] | 0.58 [0.54, 0.64] | 1.09 [0.88, 1.33] | +0.0 [+0.0, +0.0] |
| wall from Claude Code duration_ms (0 runs without a result event are absent from the wall column) | 40 | 0.83 [0.72, 0.96] | 0.58 [0.54, 0.63] | 1.14 [0.92, 1.38] | +0.0 [+0.0, +0.0] |

Cost, with the first turn priced differently for both tools (all other turns as reported). first-turn cost as measured = input x 2 + cache write x 4 + cache read x 0.1 (per million); each variant replaces only that term:

| cost variant | tasks | cost ratio [95% CI] |
|---|---|---|
| as reported (gate analysis) | 40 | 0.83 [0.72, 0.96] |
| both first-turn cache writes priced alike: every run is charged the same write count (the median over all runs, 1064 tokens) at the write rate, the rest of its first turn at the read rate | 40 | 0.94 [0.82, 1.09] |
| whole first turn read from cache (first_ctx x read rate) | 40 | 0.90 [0.76, 1.07] |
| cold cache: whole first turn written (first_ctx x write rate) | 40 | 0.63 [0.58, 0.69] |

