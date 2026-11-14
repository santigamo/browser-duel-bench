# POST HOC / SENSITIVITY: r7 vs browse under the handoff rule (defensible) and the endpoint policy (NOT evidence)

> **How to read the columns.** `official` = the rows as recorded. `+handoff (defensible sensitivity)`: the handoff rule only; it concerns what the run itself did (it asked a human who never answers) and is a defensible sensitivity to the official wall and cost. `+policy (NOT evidence)`: also applies the endpoint policy, the workflow rubric, the automatic exclusions and a re-evaluation of evidence. Those rules were WRITTEN AFTER THE RESULTS WERE SEEN, the agents were never told them, and the column is **NOT evidence** about the tools: it only shows how much the official numbers depend on unstated rules. The r9 preregistration (guard/prereg-r9.md) states its rules to the agent beforehand instead.

**This is NOT the official result.** The official numbers are guard/resultado-ciego-r7.md (blind 1) and results/2026-11-08T18-30-37-blind2-sonnet/report-blind2.md (blind 2); nothing here replaces them, no runs file was modified, and these rows were never produced by a run. Same runs, re-scored: (1) a run ends at its first human-handoff request, charged wall and cost only up to it (guard/handoff-policy.md); (2) one endpoint policy applied to every task, with a separate workflow rubric (guard/endpoint-policy.md); (3) tasks whose truth could not be computed for most runs are excluded for all variants. Ratios are ab-cli:r7 / browse-mcp (below 1 = r7 better); per-task median, geometric mean over tasks, 95% hierarchical bootstrap, 2000 resamples, seed 7. Claude sonnet-5-5, N=3.

## Exclusions and warnings per scenario

- official, 2026-11-08T10-52-34-blind-sonnet: expected 120, present 120, excluded: -
  - WARNING: b9: truth could not be computed in 4 of 6 runs (exclusion off, ignoring the exclusion threshold); those rows count as failures in the official scoring
- official, 2026-11-08T18-30-37-blind2-sonnet: expected 171, present 171, excluded: -
  - WARNING: c3: truth could not be computed in 7 of 9 runs (exclusion off, ignoring the exclusion threshold); those rows count as failures in the official scoring
- +handoff (defensible sensitivity), 2026-11-08T10-52-34-blind-sonnet: expected 120, present 120, excluded: -
  - WARNING: b9: truth could not be computed in 4 of 6 runs (exclusion off, ignoring the exclusion threshold); those rows count as failures in the official scoring
- +handoff (defensible sensitivity), 2026-11-08T18-30-37-blind2-sonnet: expected 171, present 171, excluded: -
  - WARNING: c3: truth could not be computed in 7 of 9 runs (exclusion off, ignoring the exclusion threshold); those rows count as failures in the official scoring
- +policy (NOT evidence), 2026-11-08T10-52-34-blind-sonnet: expected 114, present 114, excluded: b9: auto: truth could not be computed in 4 of 6 runs (checker source unreachable); excluded for all variants
- +policy (NOT evidence), 2026-11-08T18-30-37-blind2-sonnet: expected 162, present 162, excluded: c3: auto: truth could not be computed in 7 of 9 runs (checker source unreachable); excluded for all variants

## blind 1 (b1-b20)

| metric | official | +handoff (defensible sensitivity) | +policy (NOT evidence) |
|---|---|---|---|
| tasks | 20 | 20 | 19 |
| compliant success | 47/60 vs 50/60 | 47/60 vs 50/60 | 46/57 vs 42/57 |
| compliant success diff (pts) | -5.0 [-20.0, +8.3] | -5.0 [-20.0, +8.3] | +7.0 [-3.5, +19.3] |
| workflow compliance | n/a (no rubric rows) | n/a (no rubric rows) | 45/45 vs 42/45 |
| handoff rate | 0/60 vs 0/60 | 0/60 vs 5/60 | 0/57 vs 3/57 |
| timeout rate | 0/60 vs 5/60 | 0/60 vs 0/60 | 0/57 vs 0/57 |
| wall (charged) | 0.76 [0.44, 1.40] | 1.03 [0.73, 1.56] | 1.11 [0.80, 1.67] |
| cost_usd | 0.85 [0.66, 1.16] | 0.85 [0.67, 1.15] | 0.90 [0.70, 1.20] |
| peak context | 0.58 [0.53, 0.67] | 0.58 [0.52, 0.67] | 0.59 [0.53, 0.68] |
| dynamic context | 0.94 [0.65, 1.43] | 0.94 [0.65, 1.45] | 1.00 [0.69, 1.53] |
| steps | 1.19 [0.86, 1.68] | 1.19 [0.86, 1.70] | 1.26 [0.91, 1.79] |
| cost per compliant success | 1.06 [0.74, 1.57] | 1.06 [0.75, 1.60] | 0.96 [0.66, 1.38] |
| cost per compliant success, r7 (USD) | 0.0275 | 0.0275 | 0.0270 |
| cost per compliant success, browse (USD) | 0.0260 | 0.0260 | 0.0282 |
| workflow compliance diff (pts) | - | - | +6.7 [+0.0, +20.0] |
| strict compliant success diff (pts) | - | - | +7.0 [-3.5, +19.3] |

Change official -> +policy (NOT evidence): compliant success 47/60 vs 50/60 -> 46/57 vs 42/57; wall (charged) 0.76 -> 1.11; cost_usd 0.85 -> 0.90; cost per compliant success 1.06 -> 0.96; peak context 0.58 -> 0.59; dynamic context 0.94 -> 1.00; steps 1.19 -> 1.26.

## blind 2 (c1-c20)

| metric | official | +handoff (defensible sensitivity) | +policy (NOT evidence) |
|---|---|---|---|
| tasks | 19 | 19 | 18 |
| compliant success | 48/57 vs 44/57 | 48/57 vs 44/57 | 29/54 vs 23/54 |
| compliant success diff (pts) | +7.0 [-12.3, +26.3] | +7.0 [-10.5, +24.6] | +11.1 [-7.4, +31.5] |
| workflow compliance | n/a (no rubric rows) | n/a (no rubric rows) | 34/54 vs 27/54 |
| handoff rate | 0/57 vs 0/57 | 0/57 vs 4/57 | 0/54 vs 4/54 |
| timeout rate | 0/57 vs 4/57 | 0/57 vs 0/57 | 0/54 vs 0/54 |
| wall (charged) | 0.70 [0.48, 1.10] | 1.02 [0.79, 1.27] | 1.02 [0.82, 1.30] |
| cost_usd | 0.66 [0.54, 0.79] | 0.66 [0.54, 0.79] | 0.67 [0.54, 0.79] |
| peak context | 0.51 [0.49, 0.54] | 0.51 [0.49, 0.55] | 0.52 [0.49, 0.54] |
| dynamic context | 0.72 [0.56, 0.96] | 0.72 [0.55, 0.96] | 0.73 [0.55, 0.98] |
| steps | 1.07 [0.82, 1.28] | 1.07 [0.81, 1.30] | 1.08 [0.83, 1.32] |
| cost per compliant success | 0.62 [0.48, 0.79] | 0.62 [0.48, 0.80] | 0.53 [0.32, 0.86] |
| cost per compliant success, r7 (USD) | 0.0151 | 0.0151 | 0.0233 |
| cost per compliant success, browse (USD) | 0.0244 | 0.0244 | 0.0436 |
| workflow compliance diff (pts) | - | - | +13.0 [+0.0, +27.8] |
| strict compliant success diff (pts) | - | - | +11.1 [-7.4, +31.5] |

Change official -> +policy (NOT evidence): compliant success 48/57 vs 44/57 -> 29/54 vs 23/54; wall (charged) 0.70 -> 1.02; cost_usd 0.66 -> 0.67; cost per compliant success 0.62 -> 0.53; peak context 0.51 -> 0.52; dynamic context 0.72 -> 0.73; steps 1.07 -> 1.08.

## POOLED

| metric | official | +handoff (defensible sensitivity) | +policy (NOT evidence) |
|---|---|---|---|
| tasks | 39 | 39 | 37 |
| compliant success | 95/117 vs 94/117 | 95/117 vs 94/117 | 75/111 vs 65/111 |
| compliant success diff (pts) | +0.9 [-11.1, +12.8] | +0.9 [-11.1, +12.8] | +9.0 [-1.8, +21.6] |
| workflow compliance | n/a (no rubric rows) | n/a (no rubric rows) | 79/99 vs 69/99 |
| handoff rate | 0/117 vs 0/117 | 0/117 vs 9/117 | 0/111 vs 7/111 |
| timeout rate | 0/117 vs 9/117 | 0/117 vs 0/117 | 0/111 vs 0/111 |
| wall (charged) | 0.73 [0.53, 1.10] | 1.03 [0.83, 1.31] | 1.07 [0.88, 1.36] |
| cost_usd | 0.75 [0.64, 0.91] | 0.75 [0.64, 0.90] | 0.78 [0.65, 0.92] |
| peak context | 0.55 [0.52, 0.60] | 0.55 [0.52, 0.59] | 0.55 [0.52, 0.60] |
| dynamic context | 0.83 [0.66, 1.09] | 0.83 [0.66, 1.08] | 0.87 [0.67, 1.13] |
| steps | 1.13 [0.91, 1.37] | 1.13 [0.89, 1.37] | 1.18 [0.92, 1.43] |
| cost per compliant success | 0.84 [0.65, 1.14] | 0.84 [0.65, 1.12] | 0.76 [0.56, 1.04] |
| cost per compliant success, r7 (USD) | 0.0212 | 0.0212 | 0.0255 |
| cost per compliant success, browse (USD) | 0.0252 | 0.0252 | 0.0336 |
| workflow compliance diff (pts) | - | - | +10.1 [+1.0, +21.2] |
| strict compliant success diff (pts) | - | - | +9.0 [-2.7, +20.7] |

Change official -> +policy (NOT evidence): compliant success 95/117 vs 94/117 -> 75/111 vs 65/111; wall (charged) 0.73 -> 1.07; cost_usd 0.75 -> 0.78; cost per compliant success 0.84 -> 0.76; peak context 0.55 -> 0.55; dynamic context 0.83 -> 0.87; steps 1.13 -> 1.18.

## Reading notes

- compliant success = answer right AND evidence AND no rule violation (clean); in `+policy` the violations include the uniform endpoint policy, so runs that read the API of the site no longer count. workflow compliance is scored apart (only tasks with a rubric) and does not change compliant success.
- Costs of runs cut at a handoff are ESTIMATES priced from the turns up to the handoff call (cost_src=estimate); rows with a reported cost elsewhere are unchanged.
- Blind 1 transcripts have no recorded navigations (no navigated_urls) and no api_access: the policy there is evaluated over typed navigations and page-code requests only, so it is looser than for blind 2.
- The `+policy` column also re-evaluates evidence with the current rules (recorded navigations when present), which flips b3 r7 reps 2 and 3 (formula pages opened in a loop) back to success; that correction is a measurement fix, but the column as a whole is still NOT evidence.
- Peak context was missing for all of blind 1 and is computed from the transcripts; dynamic context = peak minus the first-turn prompt.
