# Resultado de la evaluacion ciega de r8

Fecha: 2026-11-08. Plan y umbrales: guard/prereg-r8.md (con la desviacion 1: c16 excluida para todas las variantes). r8 = tag r8. 19 tareas ciegas (c1-c20 sin c16), claude-sonnet-5-5, N=3, 171 ejecuciones. Resumen escrito el 2026-11-13 a partir del informe generado el 2026-11-08 (`python3 src/final.py manifest-blind2.json --report blind2`), que va completo abajo sin cambios.

## ab-cli:r8 / browse-mcp (geomedia por tarea, bootstrap jerarquico 95 %)

| criterio | resultado | IC 95 % | cumple |
|---|---|---|---|
| Exito conforme: r8 no por debajo de browse | 41/57 vs 44/57 (-5,3 pts) | -21,1 a +10,5 | no |
| Tiempo <= 0,90 y cota < 1 | 1,03 | 0,64 a 2,12 | no |
| Coste real <= 0,90 y cota < 1 | 0,93 | 0,66 a 1,39 | no |
| Pico de contexto <= 0,90 y cota < 1 | 0,61 | 0,53 a 0,73 | si |
| Pasos (descriptivo) | 1,32 | 0,90 a 2,38 | |

Veredicto: r8 no supera a browse segun los umbrales fijados; solo cumple contexto.

## Eleccion de base, r8 / r7

Exito conforme 41/57 vs 48/57; tiempo 1,47 (1,05 a 2,41), coste 1,40 (1,03 a 2,13), contexto 1,19 (1,03 a 1,44). r8 es peor que r7 en exito y empeora tiempo, coste y contexto por encima del 5 %: la base sigue siendo r7.

## Notas
- browse tuvo 4 timeouts de 57 ejecuciones (7 %), con coste estimado desde el uso parcial. El tiempo con censura en el timeout da r8/browse 1,13 (0,63 a 2,04).
- Un fallo de umbral se informa como fallo.

## Informe generado (sin cambios)

### Blind set 2 (c1..c20, group blind2)

Primary comparison: ab-cli:r8 vs browse-mcp. Secondary: ab-cli:r8 vs ab-cli:r7. Every ratio is a/b, below 1 = the first is better (lower wall, cost, context). Per-task median ratio, geometric mean over tasks, 95% HIERARCHICAL bootstrap (tasks resampled, then runs within tasks), 2000 resamples, seed 7. Steps are descriptive only. No threshold verdicts here: the thresholds belong to the preregistration, which this report does not replace.

#### Completeness

| result dir | expected | present | missing | quota_abort rows dropped | excluded tasks (reason) |
|---|---|---|---|---|---|
| results/2026-11-08T18-30-37-blind2-sonnet | 171 | 171 | 0 | 0 | - |

#### Per variant

| variant | runs | compliant success | raw success | timeouts (rate) | median wall s | median cost USD | median peak context | median steps (descriptive) |
|---|---|---|---|---|---|---|---|---|
| ab-cli:r7 | 57 | 48/57 | 50/57 | 0/57 (0%) | 7.0 | 0.0108 | 5590 | 1 |
| ab-cli:r8 | 57 | 41/57 | 41/57 | 0/57 (0%) | 9.5 | 0.0122 | 5692 | 2 |
| browse-mcp | 57 | 44/57 | 44/57 | 4/57 (7%) | 7.6 | 0.0163 | 10500 | 2 |

Timeout per run: 420 s (recorded in meta.json).

#### Cost coverage

| variant | runs | cost reported | cost ESTIMATED (run cut before its result event; floor, priced from partial usage) | no cost at all |
|---|---|---|---|---|
| ab-cli:r7 | 57 | 57 | 0 | 0 |
| ab-cli:r8 | 57 | 57 | 0 | 0 |
| browse-mcp | 57 | 53 | 4 | 0 |

cost_usd statistics below include the estimates. Rows with no cost at all are absent from the cost columns only (never counted as zero): none.
Sensitivity, cost from reported rows only (ESTIMATED rows removed):

- ab-cli:r8 / browse-mcp: reported only 0.95 [0.67, 1.45] (19 tasks); with estimates 0.93 [0.66, 1.42] (19 tasks)
- ab-cli:r8 / ab-cli:r7: reported only 1.40 [1.02, 2.10] (19 tasks); with estimates 1.40 [1.01, 2.08] (19 tasks)

#### Primary: ab-cli:r8 / browse-mcp

Compliant success: ab-cli:r8 41/57 vs browse-mcp 44/57; difference -5.3 pts [-21.1, +10.5] (pooled rate, hierarchical bootstrap, 19 tasks).

| metric | ratio a/b [95% CI] | tasks | leave-one-task-out range (min .. max) | tasks driving min / max |
|---|---|---|---|---|
| wall s (median) | 1.03 [0.64, 2.12] | 19 | 0.87 .. 1.26 | c9 / c10 |
| cost USD | 0.93 [0.66, 1.39] | 19 | 0.82 .. 0.98 | c1 / c13 |
| peak context (Claude runs) | 0.61 [0.53, 0.73] | 19 | - | - |
| steps (descriptive) | 1.32 [0.90, 2.38] | 19 | - | - |

Timeouts and censored time:

| | ab-cli:r8 | browse-mcp |
|---|---|---|
| timeout rate | 0/57 (0.0%) | 4/57 (7.0%) |

Restricted mean wall up to the timeout (timeouts censored, each contributes tau; per-task mean, geomean over tasks): ratio 1.13 [0.63, 2.04] over 19 tasks; leave-one-task-out 0.95 .. 1.36.
Median wall among runs that FINISHED only (conditional; flatters whoever times out more, shown for completeness): ratio 1.57 [1.01, 2.61] over 19 tasks.

Per task (median wall s / median cost USD / compliant successes):

| task | ab-cli:r8 | browse-mcp | wall ratio | cost ratio |
|---|---|---|---|---|
| c1 | 39.9 / 0.107 / 3/3 | 6.0 / 0.013 / 3/3 | 6.65 | 8.08 |
| c2 | 6.5 / 0.009 / 3/3 | 6.6 / 0.016 / 3/3 | 0.98 | 0.59 |
| c3 | 8.0 / 0.013 / 0/3 | 11.2 / 0.025 / 0/3 | 0.71 | 0.51 |
| c4 | 9.1 / 0.015 / 0/3 | 5.0 / 0.012 / 2/3 | 1.82 | 1.22 |
| c5 | 8.6 / 0.012 / 3/3 | 8.1 / 0.016 / 3/3 | 1.06 | 0.76 |
| c6 | 17.4 / 0.020 / 3/3 | 8.1 / 0.020 / 0/3 | 2.15 | 1.03 |
| c7 | 6.8 / 0.010 / 3/3 | 11.5 / 0.023 / 3/3 | 0.59 | 0.43 |
| c8 | 16.2 / 0.009 / 3/3 | 34.6 / 0.014 / 3/3 | 0.47 | 0.62 |
| c9 | 104.9 / 0.084 / 3/3 | 5.7 / 0.013 / 3/3 | 18.40 | 6.45 |
| c10 | 10.6 / 0.012 / 0/3 | 420.5 / 0.016 / 1/3 T2 | 0.03 | 0.74 |
| c11 | 6.4 / 0.008 / 3/3 | 7.0 / 0.016 / 3/3 | 0.91 | 0.53 |
| c12 | 5.0 / 0.007 / 3/3 | 5.2 / 0.012 / 3/3 | 0.96 | 0.55 |
| c13 | 9.8 / 0.008 / 3/3 | 7.7 / 0.021 / 3/3 | 1.27 | 0.37 |
| c14 | 5.1 / 0.007 / 3/3 | 5.5 / 0.011 / 3/3 | 0.93 | 0.64 |
| c15 | 14.9 / 0.024 / 2/3 | 22.5 / 0.024 / 3/3 | 0.66 | 0.99 |
| c17 | 24.4 / 0.045 / 2/3 | 12.4 / 0.030 / 2/3 | 1.97 | 1.51 |
| c18 | 96.5 / 0.039 / 0/3 | 420.5 / 0.024 / 0/3 T2 | 0.23 | 1.60 |
| c19 | 11.8 / 0.015 / 1/3 | 5.4 / 0.013 / 3/3 | 2.19 | 1.18 |
| c20 | 4.1 / 0.008 / 3/3 | 4.3 / 0.020 / 3/3 | 0.95 | 0.41 |

#### Secondary: ab-cli:r8 / ab-cli:r7

Compliant success: ab-cli:r8 41/57 vs ab-cli:r7 48/57; difference -12.3 pts [-33.3, +8.8] (pooled rate, hierarchical bootstrap, 19 tasks).

| metric | ratio a/b [95% CI] | tasks | leave-one-task-out range (min .. max) | tasks driving min / max |
|---|---|---|---|---|
| wall s (median) | 1.47 [1.05, 2.41] | 19 | 1.27 .. 1.56 | c9 / c15 |
| cost USD | 1.40 [1.03, 2.13] | 19 | 1.26 .. 1.46 | c9 / c11 |
| peak context (Claude runs) | 1.19 [1.03, 1.44] | 19 | - | - |
| steps (descriptive) | 1.21 [0.88, 2.18] | 19 | - | - |

Timeouts and censored time:

| | ab-cli:r8 | ab-cli:r7 |
|---|---|---|
| timeout rate | 0/57 (0.0%) | 0/57 (0.0%) |

Restricted mean wall up to the timeout (timeouts censored, each contributes tau; per-task mean, geomean over tasks): ratio 1.67 [1.11, 2.53] over 19 tasks; leave-one-task-out 1.43 .. 1.78.
Median wall among runs that FINISHED only (conditional; flatters whoever times out more, shown for completeness): ratio 1.47 [1.03, 2.49] over 19 tasks.

Per task (median wall s / median cost USD / compliant successes):

| task | ab-cli:r8 | ab-cli:r7 | wall ratio | cost ratio |
|---|---|---|---|---|
| c1 | 39.9 / 0.107 / 3/3 | 7.4 / 0.012 / 3/3 | 5.39 | 8.84 |
| c2 | 6.5 / 0.009 / 3/3 | 6.9 / 0.011 / 3/3 | 0.94 | 0.87 |
| c3 | 8.0 / 0.013 / 0/3 | 11.1 / 0.015 / 1/3 | 0.72 | 0.87 |
| c4 | 9.1 / 0.015 / 0/3 | 5.1 / 0.012 / 2/3 | 1.78 | 1.22 |
| c5 | 8.6 / 0.012 / 3/3 | 8.6 / 0.014 / 3/3 | 1.00 | 0.85 |
| c6 | 17.4 / 0.020 / 3/3 | 7.0 / 0.013 / 2/3 | 2.49 | 1.52 |
| c7 | 6.8 / 0.010 / 3/3 | 6.2 / 0.008 / 3/3 | 1.10 | 1.24 |
| c8 | 16.2 / 0.009 / 3/3 | 30.1 / 0.009 / 3/3 | 0.54 | 0.95 |
| c9 | 104.9 / 0.084 / 3/3 | 4.7 / 0.008 / 3/3 | 22.32 | 10.04 |
| c10 | 10.6 / 0.012 / 0/3 | 12.6 / 0.016 / 3/3 | 0.84 | 0.77 |
| c11 | 6.4 / 0.008 / 3/3 | 9.0 / 0.013 / 1/3 | 0.71 | 0.65 |
| c12 | 5.0 / 0.007 / 3/3 | 5.1 / 0.007 / 3/3 | 0.98 | 0.96 |
| c13 | 9.8 / 0.008 / 3/3 | 7.8 / 0.008 / 3/3 | 1.26 | 0.99 |
| c14 | 5.1 / 0.007 / 3/3 | 5.4 / 0.008 / 3/3 | 0.94 | 0.93 |
| c15 | 14.9 / 0.024 / 2/3 | 29.0 / 0.029 / 2/3 | 0.51 | 0.84 |
| c17 | 24.4 / 0.045 / 2/3 | 5.5 / 0.010 / 1/3 | 4.44 | 4.34 |
| c18 | 96.5 / 0.039 / 0/3 | 42.1 / 0.026 / 3/3 | 2.29 | 1.52 |
| c19 | 11.8 / 0.015 / 1/3 | 5.8 / 0.008 / 3/3 | 2.03 | 1.95 |
| c20 | 4.1 / 0.008 / 3/3 | 4.2 / 0.008 / 3/3 | 0.98 | 1.03 |

#### Compliance, kept apart

Task-rule violations (they remove a run from compliant success): shell programs outside the tool, direct-URL rules over typed and over recorded navigations.

| variant | runs with a task-rule violation | runs with evidence missing | navigation recorder failed |
|---|---|---|---|
| ab-cli:r7 | 3 | 2 | 0 |
| ab-cli:r8 | 0 | 1 | 0 |
| browse-mcp | 0 | 1 | 0 |

Semantic API use via the browser (navigated API URLs or API calls inside page scripts; same detector and inputs for every tool; descriptive, it does NOT change success or compliance):

| variant | runs with API-like use | of which navigated API URL | of which script API call | runs with an unjudged fetch() (non-literal or non-API URL) |
|---|---|---|---|---|
| ab-cli:r7 | 20 | 14 | 6 | 0 |
| ab-cli:r8 | 3 | 3 | 0 | 0 |
| browse-mcp | 30 | 14 | 20 | 1 |

#### Non-compliant runs

- c3 ab-cli:r7 #2 [FAIL]: answer='unable to determine' truth='(truth unavailable)' note=checker could not compute truth: Error: Unable to connect. Is the computer able 
- c3 ab-cli:r7 #3 [FAIL]: answer='unable to determine' truth='(truth unavailable)' violations=['shell: program curl: agent-browser run - <<\'JS\' page.goto("https://openlibrary.org/"); return page.evaluate(() => documen'] note=checker could not compute truth: Error: Unable to connect. Is the computer able 
- c3 ab-cli:r8 #1 [FAIL]: answer='unable to determine — openlibrary.org was unreachable from t' truth='30' 
- c3 ab-cli:r8 #2 [FAIL]: answer='unable to determine — openlibrary.org refused connections fr' truth='(truth unavailable)' note=checker could not compute truth: Error: Unable to connect. Is the computer able 
- c3 ab-cli:r8 #3 [FAIL]: answer='unable to determine' truth='(truth unavailable)' note=checker could not compute truth: Error: Unable to connect. Is the computer able 
- c3 browse-mcp #1 [FAIL]: answer='Unable to determine. Open Library refused all connections.' truth='(truth unavailable)' note=checker could not compute truth: Error: Unable to connect. Is the computer able 
- c3 browse-mcp #2 [FAIL]: answer='unable to determine (Open Library was unreachable from the b' truth='(truth unavailable)' note=checker could not compute truth: Error: Unable to connect. Is the computer able 
- c3 browse-mcp #3 [FAIL]: answer='Unable to determine. openlibrary.org refused every connectio' truth='(truth unavailable)' note=checker could not compute truth: Error: Unable to connect. Is the computer able 
- c4 ab-cli:r7 #2 [FAIL]: answer='7 | 189 km ENE of Nagqu, China' truth='M7.7 10 km WSW of Pitaloza Arriba, Panam' 
- c4 ab-cli:r8 #1 [FAIL]: answer='7.0 | 189 km ENE of Nagqu, China' truth='M7.7 10 km WSW of Pitaloza Arriba, Panam' 
- c4 ab-cli:r8 #2 [FAIL]: answer='7.0 | 189 km ENE of Nagqu, China' truth='M7.7 10 km WSW of Pitaloza Arriba, Panam' 
- c4 ab-cli:r8 #3 [FAIL]: answer='7.0 | 189 km ENE of Nagqu, China' truth='M7.7 10 km WSW of Pitaloza Arriba, Panam' 
- c4 browse-mcp #3 [FAIL]: answer='7.0 | 189 km ENE of Nagqu, China' truth='M7.7 10 km WSW of Pitaloza Arriba, Panam' 
- c6 ab-cli:r7 #3 [FAIL]: answer='8 | Judgment Day' truth='6 | Judgment Day' 
- c6 browse-mcp #1 [FAIL]: answer='8 | Judgment Day' truth='6 | Judgment Day' 
- c6 browse-mcp #2 [FAIL]: answer='8 | Judgment Day' truth='6 | Judgment Day' 
- c6 browse-mcp #3 [FAIL]: answer='8 | Judgment Day' truth='6 | Judgment Day' 
- c10 ab-cli:r8 #1 [FAIL]: answer='unable to determine (blocked by CAPTCHA)' truth='21' 
- c10 ab-cli:r8 #2 [FAIL]: answer='unable to determine (blocked by CAPTCHA)' truth='21' 
- c10 ab-cli:r8 #3 [FAIL]: answer='unable to determine (blocked by CAPTCHA)' truth='21' 
- c10 browse-mcp #1 [TIMEOUT]: answer='A CAPTCHA is blocking; handing off.' truth='' note=timeout
- c10 browse-mcp #3 [TIMEOUT]: answer='A CAPTCHA blocks this; I need to hand off.' truth='' note=timeout
- c11 ab-cli:r7 #1 [unclean]: answer='7117.42' truth='7117.42' violations=['shell: program python3: python3 -c "print(2000/10.5260*37.459)"'] 
- c11 ab-cli:r7 #2 [unclean]: answer='7117.42' truth='7117.42' violations=['shell: program python3: python3 -c "print(2000/10.5260*37.459)"'] 
- c15 ab-cli:r7 #2 [FAIL]: answer='75' truth='26' 
- c15 ab-cli:r8 #1 [FAIL]: answer='75' truth='26' 
- c17 ab-cli:r7 #1 [FAIL]: answer='27, 1' truth='27, 1' evidence_missing=['nobelprize'] note=evidence missing: nobelprize
- c17 ab-cli:r7 #2 [FAIL]: answer='27, 1' truth='27, 1' evidence_missing=['nobelprize'] note=evidence missing: nobelprize
- c17 ab-cli:r8 #1 [FAIL]: answer='27, 1' truth='27, 1' evidence_missing=['nobelprize'] note=evidence missing: nobelprize
- c17 browse-mcp #1 [FAIL]: answer='27, 1' truth='27, 1' evidence_missing=['nobelprize'] note=evidence missing: nobelprize
- c18 ab-cli:r8 #1 [FAIL]: answer='Unable to determine — browser failed to load Goodreads and t' truth='Romance 752967' 
- c18 ab-cli:r8 #2 [FAIL]: answer='Unable to determine. Goodreads served blank pages, so I coul' truth='Romance 752967' 
- c18 ab-cli:r8 #3 [FAIL]: answer='Unable to determine — Goodreads pages would not load in the ' truth='Romance 752967' 
- c18 browse-mcp #1 [FAIL]: answer='Unable to determine. Goodreads blocked access with a 403 err' truth='Romance 752967' 
- c18 browse-mcp #2 [TIMEOUT]: answer="Goodreads is refusing every request with a 403, so I'll ask " truth='' note=timeout
- c18 browse-mcp #3 [TIMEOUT]: answer='Goodreads is refusing the visit entirely (403 on every page)' truth='' note=timeout
- c19 ab-cli:r8 #2 [FAIL]: answer='01:33 | 11.95' truth='09:33 11.949ft' 
- c19 ab-cli:r8 #3 [FAIL]: answer='01:33 | 11.95' truth='09:33 11.949ft' 
