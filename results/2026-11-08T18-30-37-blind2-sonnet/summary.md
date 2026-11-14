# Benchmark summary 2026-11-08T18-30-37-blind2-sonnet

- model/config: see meta.json (claude claude-sonnet-5-5); agent-browser {"main":"agent-browser 0.41.2","r8":"agent-browser 0.41.2","r7":"agent-browser 0.41.2"}; browse 0.0.14; warm=true
- N=3 per task per variant; interleaved; elapsed 93.2 min
- success = checker passed; clean = passed AND no rule violation (shell use outside the tool, direct URL)

## Suite: blind2

### Per-variant (medians over all runs; success over all runs)

| variant | runs | success | compliant (success+clean) | cost USD (primary) | wall s | steps | input | input excl cache | output | total excl cache reads | cost-weighted tokens (proxy) | median call ms | tool-out bytes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ab-cli:r8 | 57 | 41/57 | 41/57 | 0 | 10 | 2 | 15068 | 1736 | 512 | 2001 | 3229 | 1046 | 1440 |
| ab-cli:r7 | 57 | 50/57 | 48/57 | 0 | 7 | 1 | 11080 | 1325 | 448 | 1730 | 2914 | 1042 | 674 |
| browse-mcp | 57 | 44/57 | 44/57 | 0 | 8 | 2 | 29813 | 2182 | 517 | 2739 | 5398 | 726 | 897 |

### Claim-format deltas (medians, all runs)

- browse vs ab-cli:r8: 20% faster, 26% more input tokens (excl cache), 98% more input tokens (incl cache), 0% fewer steps, 37% more tokens excl. cache reads
- browse vs ab-cli:r7: 9% slower, 65% more input tokens (excl cache), 169% more input tokens (incl cache), 100% more steps, 58% more tokens excl. cache reads

### Per-task ratio geomean vs browse-mcp (<1 = better than browse-mcp; medians per task)

| variant | compliant success | cost USD | steps | wall s | input excl cache | cost-weighted (proxy) | used batch/chain/run (runs) |
|---|---|---|---|---|---|---|---|
| ab-cli:r8 | compliant 41/57 vs 44/57 | 0.93 | 1.32 | 1.03 | 0.77 | 0.81 | batch 0, chain 15, run 54 |
| ab-cli:r7 | compliant 48/57 vs 44/57 | 0.66 | 1.07 | 0.70 | 0.52 | 0.56 | batch 0, chain 2, run 55 |

### Per task (median of reps; ok = successes/runs)

| task | variant | ok | wall s | steps | input excl cache | output | total excl cache | tool bytes |
|---|---|---|---|---|---|---|---|---|
| c1 | ab-cli:r8 | 3/3 | 39.9 | 16 | 15281 | 3390 | 18464 | 24064 |
| c1 | ab-cli:r7 | 3/3 | 7.4 | 2 | 865 | 658 | 1586 | 154 |
| c1 | browse-mcp | 3/3 | 6.0 | 1 | 1562 | 517 | 2079 | 458 |
| c2 | ab-cli:r8 | 3/3 | 6.5 | 2 | 869 | 444 | 1329 | 261 |
| c2 | ab-cli:r7 | 3/3 | 6.9 | 2 | 1325 | 436 | 1730 | 446 |
| c2 | browse-mcp | 3/3 | 6.6 | 2 | 1863 | 569 | 2417 | 738 |
| c3 | ab-cli:r8 | 0/3 | 8.0 | 3 | 1093 | 633 | 1726 | 571 |
| c3 | ab-cli:r7 | 1/3 | 11.1 | 4 | 1208 | 727 | 1935 | 601 |
| c3 | browse-mcp | 0/3 | 11.2 | 5 | 2844 | 747 | 3591 | 2536 |
| c4 | ab-cli:r8 | 0/3 | 9.1 | 2 | 2132 | 416 | 2548 | 2803 |
| c4 | ab-cli:r7 | 2/3 | 5.1 | 1 | 1518 | 448 | 2091 | 405 |
| c4 | browse-mcp | 2/3 | 5.0 | 1 | 1619 | 383 | 1991 | 704 |
| c5 | ab-cli:r8 | 3/3 | 8.6 | 1 | 1754 | 434 | 2187 | 3212 |
| c5 | ab-cli:r7 | 3/3 | 8.6 | 1 | 1837 | 553 | 2452 | 3011 |
| c5 | browse-mcp | 3/3 | 8.1 | 1 | 2656 | 416 | 3023 | 3334 |
| c6 | ab-cli:r8 | 3/3 | 17.4 | 3 | 3049 | 587 | 3636 | 4233 |
| c6 | ab-cli:r7 | 2/3 | 7.0 | 2 | 1801 | 461 | 2225 | 1285 |
| c6 | browse-mcp | 0/3 | 8.1 | 2 | 2202 | 762 | 3049 | 730 |
| c7 | ab-cli:r8 | 3/3 | 6.8 | 1 | 874 | 354 | 1419 | 457 |
| c7 | ab-cli:r7 | 3/3 | 6.2 | 1 | 860 | 259 | 1209 | 591 |
| c7 | browse-mcp | 3/3 | 11.5 | 3 | 2741 | 779 | 3615 | 2216 |
| c8 | ab-cli:r8 | 3/3 | 16.2 | 2 | 829 | 401 | 1230 | 465 |
| c8 | ab-cli:r7 | 3/3 | 30.1 | 2 | 1086 | 342 | 1428 | 838 |
| c8 | browse-mcp | 3/3 | 34.6 | 2 | 2080 | 257 | 2382 | 1062 |
| c9 | ab-cli:r8 | 3/3 | 104.9 | 19 | 7809 | 3598 | 11468 | 8102 |
| c9 | ab-cli:r7 | 3/3 | 4.7 | 1 | 930 | 351 | 1243 | 215 |
| c9 | browse-mcp | 3/3 | 5.7 | 1 | 1673 | 454 | 2126 | 784 |
| c10 | ab-cli:r8 | 0/3 | 10.6 | 1 | 1102 | 550 | 1810 | 1000 |
| c10 | ab-cli:r7 | 3/3 | 12.6 | 3 | 1530 | 756 | 2284 | 1421 |
| c10 | browse-mcp | 1/3 | 420.5 | 3 | 1856 | 518 | 2458 | 938 |
| c11 | ab-cli:r8 | 3/3 | 6.4 | 1 | 621 | 517 | 1069 | 65 |
| c11 | ab-cli:r7 | 3/3 | 9.0 | 4 | 965 | 646 | 1611 | 169 |
| c11 | browse-mcp | 3/3 | 7.0 | 2 | 1604 | 551 | 2309 | 521 |
| c12 | ab-cli:r8 | 3/3 | 5.0 | 1 | 761 | 259 | 1024 | 458 |
| c12 | ab-cli:r7 | 3/3 | 5.1 | 1 | 925 | 256 | 1152 | 458 |
| c12 | browse-mcp | 3/3 | 5.2 | 1 | 1817 | 266 | 2134 | 653 |
| c13 | ab-cli:r8 | 3/3 | 9.8 | 1 | 1088 | 265 | 1359 | 1303 |
| c13 | ab-cli:r7 | 3/3 | 7.8 | 1 | 1090 | 276 | 1365 | 1303 |
| c13 | browse-mcp | 3/3 | 7.7 | 1 | 4076 | 329 | 4405 | 6234 |
| c14 | ab-cli:r8 | 3/3 | 5.1 | 1 | 746 | 334 | 1093 | 197 |
| c14 | ab-cli:r7 | 3/3 | 5.4 | 1 | 780 | 369 | 1156 | 345 |
| c14 | browse-mcp | 3/3 | 5.5 | 1 | 1501 | 364 | 1865 | 457 |
| c15 | ab-cli:r8 | 2/3 | 14.9 | 5 | 2561 | 1057 | 3618 | 2320 |
| c15 | ab-cli:r7 | 2/3 | 29.0 | 6 | 2705 | 1240 | 4086 | 2002 |
| c15 | browse-mcp | 3/3 | 22.5 | 3 | 3230 | 761 | 3929 | 2923 |
| c17 | ab-cli:r8 | 2/3 | 24.4 | 8 | 5739 | 1650 | 7389 | 9131 |
| c17 | ab-cli:r7 | 1/3 | 5.5 | 0 | 915 | 625 | 1573 | 0 |
| c17 | browse-mcp | 2/3 | 12.4 | 4 | 3906 | 905 | 4811 | 4194 |
| c18 | ab-cli:r8 | 0/3 | 96.5 | 12 | 2890 | 2066 | 4895 | 2300 |
| c18 | ab-cli:r7 | 3/3 | 42.1 | 9 | 1913 | 1194 | 3168 | 984 |
| c18 | browse-mcp | 0/3 | 420.5 | 6 | 2692 | 748 | 3440 | 2212 |
| c19 | ab-cli:r8 | 1/3 | 11.8 | 1 | 2245 | 512 | 2757 | 3212 |
| c19 | ab-cli:r7 | 3/3 | 5.8 | 1 | 660 | 384 | 1071 | 223 |
| c19 | browse-mcp | 3/3 | 5.4 | 1 | 1709 | 421 | 2089 | 872 |
| c20 | ab-cli:r8 | 3/3 | 4.1 | 1 | 1210 | 237 | 1468 | 1440 |
| c20 | ab-cli:r7 | 3/3 | 4.2 | 1 | 1211 | 235 | 1446 | 1440 |
| c20 | browse-mcp | 3/3 | 4.3 | 1 | 4042 | 253 | 4271 | 5031 |

### Failures / violations

- c3 ab-cli:r8 #1: FAILED; answer="unable to determine — openlibrary.org was unreachable from the browser" truth="30"  
- c3 browse-mcp #1: FAILED; answer="Unable to determine. Open Library refused all connections." truth="(truth unavailable)" note=checker could not compute truth: Error: Unable to connect. Is the computer able to access the url? Error: Unable to connect. Is the computer able to access the url? 
- c3 browse-mcp #2: FAILED; answer="unable to determine (Open Library was unreachable from the browser)" truth="(truth unavailable)" note=checker could not compute truth: Error: Unable to connect. Is the computer able to access the url? Error: Unable to connect. Is the computer able to access the url? 
- c3 ab-cli:r7 #2: FAILED; answer="unable to determine" truth="(truth unavailable)" note=checker could not compute truth: Error: Unable to connect. Is the computer able to access the url? Error: Unable to connect. Is the computer able to access the url? 
- c3 ab-cli:r8 #2: FAILED; answer="unable to determine — openlibrary.org refused connections from the browser" truth="(truth unavailable)" note=checker could not compute truth: Error: Unable to connect. Is the computer able to access the url? Error: Unable to connect. Is the computer able to access the url? 
- c3 ab-cli:r8 #3: FAILED; answer="unable to determine" truth="(truth unavailable)" note=checker could not compute truth: Error: Unable to connect. Is the computer able to access the url? Error: Unable to connect. Is the computer able to access the url? 
- c3 ab-cli:r7 #3: FAILED; answer="unable to determine" truth="(truth unavailable)" note=checker could not compute truth: Error: Unable to connect. Is the computer able to access the url? Error: Unable to connect. Is the computer able to access the url? violations=["shell: program curl: agent-browser run - <<'JS' page.goto(\"https://openlibrary.org/\"); return page.evaluate(() => documen"]
- c3 browse-mcp #3: FAILED; answer="Unable to determine. openlibrary.org refused every connection from the browser." truth="(truth unavailable)" note=checker could not compute truth: Error: Unable to connect. Is the computer able to access the url? Error: Unable to connect. Is the computer able to access the url? 
- c4 ab-cli:r8 #1: FAILED; answer="7.0 | 189 km ENE of Nagqu, China" truth="M7.7 10 km WSW of Pitaloza Arriba, Panama"  
- c4 ab-cli:r8 #2: FAILED; answer="7.0 | 189 km ENE of Nagqu, China" truth="M7.7 10 km WSW of Pitaloza Arriba, Panama"  
- c4 ab-cli:r7 #2: FAILED; answer="7 | 189 km ENE of Nagqu, China" truth="M7.7 10 km WSW of Pitaloza Arriba, Panama"  
- c4 ab-cli:r8 #3: FAILED; answer="7.0 | 189 km ENE of Nagqu, China" truth="M7.7 10 km WSW of Pitaloza Arriba, Panama"  
- c4 browse-mcp #3: FAILED; answer="7.0 | 189 km ENE of Nagqu, China" truth="M7.7 10 km WSW of Pitaloza Arriba, Panama"  
- c6 browse-mcp #1: FAILED; answer="8 | Judgment Day" truth="6 | Judgment Day"  
- c6 browse-mcp #2: FAILED; answer="8 | Judgment Day" truth="6 | Judgment Day"  
- c6 browse-mcp #3: FAILED; answer="8 | Judgment Day" truth="6 | Judgment Day"  
- c6 ab-cli:r7 #3: FAILED; answer="8 | Judgment Day" truth="6 | Judgment Day"  
- c10 browse-mcp #1: FAILED; answer="A CAPTCHA is blocking; handing off." truth="" note=timeout 
- c10 ab-cli:r8 #1: FAILED; answer="unable to determine (blocked by CAPTCHA)" truth="21"  
- c10 ab-cli:r8 #2: FAILED; answer="unable to determine (blocked by CAPTCHA)" truth="21"  
- c10 ab-cli:r8 #3: FAILED; answer="unable to determine (blocked by CAPTCHA)" truth="21"  
- c10 browse-mcp #3: FAILED; answer="A CAPTCHA blocks this; I need to hand off." truth="" note=timeout 
- c11 ab-cli:r7 #1: passed; answer="7117.42" truth="7117.42"  violations=["shell: program python3: python3 -c \"print(2000/10.5260*37.459)\""]
- c11 ab-cli:r7 #2: passed; answer="7117.42" truth="7117.42"  violations=["shell: program python3: python3 -c \"print(2000/10.5260*37.459)\""]
- c15 ab-cli:r8 #1: FAILED; answer="75" truth="26"  
- c15 ab-cli:r7 #2: FAILED; answer="75" truth="26"  
- c17 ab-cli:r8 #1: FAILED; answer="27, 1" truth="27, 1" note=evidence missing: nobelprize 
- c17 ab-cli:r7 #1: FAILED; answer="27, 1" truth="27, 1" note=evidence missing: nobelprize 
- c17 browse-mcp #1: FAILED; answer="27, 1" truth="27, 1" note=evidence missing: nobelprize 
- c17 ab-cli:r7 #2: FAILED; answer="27, 1" truth="27, 1" note=evidence missing: nobelprize 
- c18 browse-mcp #1: FAILED; answer="Unable to determine. Goodreads blocked access with a 403 error." truth="Romance 752967"  
- c18 ab-cli:r8 #1: FAILED; answer="Unable to determine — browser failed to load Goodreads and then would not relaun" truth="Romance 752967"  
- c18 ab-cli:r8 #2: FAILED; answer="Unable to determine. Goodreads served blank pages, so I couldn't read the vote c" truth="Romance 752967"  
- c18 browse-mcp #2: FAILED; answer="Goodreads is refusing every request with a 403, so I'll ask you to look." truth="" note=timeout 
- c18 ab-cli:r8 #3: FAILED; answer="Unable to determine — Goodreads pages would not load in the browser" truth="Romance 752967"  
- c18 browse-mcp #3: FAILED; answer="Goodreads is refusing the visit entirely (403 on every page). I'll ask the user " truth="" note=timeout 
- c19 ab-cli:r8 #2: FAILED; answer="01:33 | 11.95" truth="09:33 11.949ft"  
- c19 ab-cli:r8 #3: FAILED; answer="01:33 | 11.95" truth="09:33 11.949ft"  

