# Benchmark summary 2026-11-13T10-51-21-blind3-final

- model/config: see meta.json (claude claude-sonnet-5-5); agent-browser {"main":"agent-browser 0.41.2","r9":"agent-browser 0.41.2"}; browse 0.0.14; warm=true
- N=2 per task per variant; interleaved; elapsed 56.3 min
- success = checker passed; clean = passed AND no rule violation (shell use outside the tool, direct URL)

## Suite: blind3

### Per-variant (medians over all runs; success over all runs)

| variant | runs | success | compliant (success+clean) | cost USD (primary) | wall s | steps | input | input excl cache | output | total excl cache reads | cost-weighted tokens (proxy) | median call ms | tool-out bytes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ab-cli:r9 | 80 | 70/80 | 70/80 | 0.0158 | 9.0 | 2 | 16515 | 2124 | 476 | 2591 | 4190 | 1761 | 1857 |
| browse-mcp | 80 | 70/80 | 70/80 | 0.0193 | 8.7 | 1 | 24308 | 2958 | 410 | 3324 | 6251 | 1908 | 2792 |

### Per-task ratio geomean vs browse-mcp (<1 = better than browse-mcp; medians per task)

| variant | compliant success | cost USD | steps | wall s | input excl cache | cost-weighted (proxy) | used batch/chain/run (runs) |
|---|---|---|---|---|---|---|---|
| ab-cli:r9 | compliant 70/80 vs 70/80 | 0.75 | 1.05 | 0.90 | 0.67 | 0.65 | batch 0, chain 0, run 80 |

### Per task (median of reps; ok = successes/runs)

| task | variant | ok | wall s | steps | input excl cache | output | total excl cache | tool bytes |
|---|---|---|---|---|---|---|---|---|
| d1 | ab-cli:r9 | 2/2 | 6.6 | 1 | 1990 | 356 | 2346 | 363 |
| d1 | browse-mcp | 2/2 | 6.8 | 1 | 7117 | 386 | 7503 | 1219 |
| d2 | ab-cli:r9 | 2/2 | 11.3 | 4 | 2291 | 920 | 3210 | 1615 |
| d2 | browse-mcp | 2/2 | 9.2 | 3 | 2594 | 648 | 3242 | 1757 |
| d3 | ab-cli:r9 | 2/2 | 11.6 | 1 | 1421 | 514 | 1934 | 914 |
| d3 | browse-mcp | 2/2 | 9.9 | 1 | 3066 | 405 | 3471 | 3269 |
| d4 | ab-cli:r9 | 0/2 | 62.0 | 16 | 13098 | 3515 | 16613 | 18531 |
| d4 | browse-mcp | 0/2 | 139.8 | 13 | 8865 | 2834 | 11699 | 10219 |
| d5 | ab-cli:r9 | 0/2 | 8.0 | 4 | 1455 | 615 | 2069 | 795 |
| d5 | browse-mcp | 0/2 | 5.8 | 2 | 1975 | 361 | 2336 | 1238 |
| d6 | ab-cli:r9 | 2/2 | 64.8 | 6 | 5625 | 1258 | 6883 | 8898 |
| d6 | browse-mcp | 2/2 | 44.1 | 4 | 5505 | 563 | 6068 | 8754 |
| d7 | ab-cli:r9 | 2/2 | 22.7 | 1 | 1434 | 399 | 1833 | 705 |
| d7 | browse-mcp | 2/2 | 19.2 | 1 | 1863 | 304 | 2167 | 651 |
| d8 | ab-cli:r9 | 1/2 | 13.0 | 4 | 4163 | 1043 | 5205 | 5293 |
| d8 | browse-mcp | 2/2 | 14.6 | 6 | 7244 | 1275 | 8519 | 8868 |
| d9 | ab-cli:r9 | 2/2 | 10.6 | 2 | 1407 | 593 | 2000 | 719 |
| d9 | browse-mcp | 2/2 | 8.7 | 3 | 2108 | 561 | 2669 | 896 |
| d10 | ab-cli:r9 | 2/2 | 7.5 | 2 | 2102 | 379 | 2481 | 2570 |
| d10 | browse-mcp | 2/2 | 24.9 | 2 | 2814 | 518 | 3332 | 2414 |
| d11 | ab-cli:r9 | 2/2 | 7.0 | 2 | 2614 | 667 | 3280 | 3143 |
| d11 | browse-mcp | 2/2 | 7.5 | 2 | 3074 | 774 | 3847 | 2820 |
| d12 | ab-cli:r9 | 1/2 | 69.3 | 8 | 9287 | 1984 | 11271 | 11322 |
| d12 | browse-mcp | 2/2 | 74.2 | 4 | 8550 | 1078 | 9628 | 13599 |
| d13 | ab-cli:r9 | 2/2 | 7.9 | 1 | 1804 | 210 | 2014 | 2771 |
| d13 | browse-mcp | 2/2 | 7.9 | 1 | 3261 | 217 | 3478 | 4429 |
| d14 | ab-cli:r9 | 2/2 | 16.2 | 2 | 1212 | 502 | 1714 | 401 |
| d14 | browse-mcp | 2/2 | 12.9 | 1 | 1841 | 347 | 2188 | 702 |
| d15 | ab-cli:r9 | 2/2 | 5.2 | 1 | 895 | 200 | 1094 | 159 |
| d15 | browse-mcp | 2/2 | 4.6 | 1 | 7351 | 194 | 7544 | 10590 |
| d16 | ab-cli:r9 | 0/2 | 85.7 | 12 | 9881 | 3518 | 13399 | 11926 |
| d16 | browse-mcp | 0/2 | 98.7 | 13 | 12096 | 2974 | 15070 | 17104 |
| d17 | ab-cli:r9 | 0/2 | 6.3 | 2 | 1063 | 458 | 1521 | 393 |
| d17 | browse-mcp | 0/2 | 4.8 | 1 | 1848 | 274 | 2121 | 1090 |
| d18 | ab-cli:r9 | 2/2 | 44.3 | 13 | 9513 | 2538 | 12051 | 10958 |
| d18 | browse-mcp | 2/2 | 34.6 | 4 | 7162 | 938 | 8100 | 9047 |
| d19 | ab-cli:r9 | 2/2 | 5.0 | 1 | 4638 | 270 | 4908 | 5886 |
| d19 | browse-mcp | 2/2 | 5.2 | 1 | 5349 | 283 | 5632 | 6132 |
| d20 | ab-cli:r9 | 2/2 | 4.3 | 1 | 1510 | 173 | 1683 | 1381 |
| d20 | browse-mcp | 2/2 | 3.8 | 1 | 1662 | 171 | 1832 | 580 |
| d21 | ab-cli:r9 | 2/2 | 7.4 | 3 | 2343 | 594 | 2937 | 1972 |
| d21 | browse-mcp | 0/2 | 15.0 | 3 | 2242 | 357 | 2599 | 1480 |
| d22 | ab-cli:r9 | 2/2 | 9.8 | 1 | 3478 | 390 | 3868 | 4264 |
| d22 | browse-mcp | 2/2 | 11.4 | 1 | 5383 | 490 | 5873 | 6218 |
| d23 | ab-cli:r9 | 2/2 | 10.6 | 3 | 1919 | 748 | 2667 | 1334 |
| d23 | browse-mcp | 2/2 | 12.8 | 3 | 5364 | 865 | 6229 | 7524 |
| d24 | ab-cli:r9 | 2/2 | 11.4 | 3 | 2042 | 926 | 2968 | 1300 |
| d24 | browse-mcp | 2/2 | 26.3 | 2 | 2663 | 576 | 3239 | 2239 |
| d25 | ab-cli:r9 | 2/2 | 5.5 | 1 | 944 | 321 | 1264 | 142 |
| d25 | browse-mcp | 2/2 | 5.0 | 1 | 1723 | 293 | 2016 | 558 |
| d26 | ab-cli:r9 | 2/2 | 19.1 | 7 | 4551 | 1299 | 5850 | 4994 |
| d26 | browse-mcp | 2/2 | 12.8 | 5 | 4834 | 827 | 5660 | 5238 |
| d27 | ab-cli:r9 | 2/2 | 9.6 | 3 | 1915 | 600 | 2515 | 1672 |
| d27 | browse-mcp | 2/2 | 7.3 | 3 | 2673 | 536 | 3209 | 2102 |
| d28 | ab-cli:r9 | 2/2 | 5.8 | 1 | 1720 | 355 | 2075 | 1538 |
| d28 | browse-mcp | 2/2 | 5.0 | 1 | 2245 | 240 | 2484 | 1720 |
| d29 | ab-cli:r9 | 2/2 | 5.7 | 1 | 1924 | 221 | 2145 | 3002 |
| d29 | browse-mcp | 2/2 | 5.1 | 1 | 2550 | 221 | 2771 | 2891 |
| d30 | ab-cli:r9 | 2/2 | 11.5 | 2 | 1319 | 377 | 1696 | 807 |
| d30 | browse-mcp | 2/2 | 13.6 | 2 | 1819 | 379 | 2198 | 588 |
| d31 | ab-cli:r9 | 2/2 | 11.8 | 2 | 3008 | 463 | 3471 | 4198 |
| d31 | browse-mcp | 2/2 | 73.3 | 8 | 9283 | 1485 | 10768 | 14896 |
| d32 | ab-cli:r9 | 2/2 | 7.3 | 2 | 2582 | 442 | 3024 | 3725 |
| d32 | browse-mcp | 2/2 | 7.3 | 3 | 2338 | 627 | 2965 | 1032 |
| d33 | ab-cli:r9 | 2/2 | 7.2 | 2 | 2013 | 554 | 2566 | 2019 |
| d33 | browse-mcp | 2/2 | 8.3 | 2 | 3050 | 742 | 3792 | 2518 |
| d34 | ab-cli:r9 | 2/2 | 5.3 | 1 | 951 | 312 | 1262 | 202 |
| d34 | browse-mcp | 2/2 | 4.7 | 1 | 1674 | 252 | 1926 | 425 |
| d35 | ab-cli:r9 | 2/2 | 10.1 | 1 | 1008 | 333 | 1340 | 242 |
| d35 | browse-mcp | 2/2 | 8.8 | 1 | 2739 | 337 | 3076 | 2792 |
| d36 | ab-cli:r9 | 2/2 | 7.8 | 3 | 1875 | 612 | 2486 | 1436 |
| d36 | browse-mcp | 2/2 | 44.4 | 5 | 3951 | 1109 | 5060 | 3517 |
| d37 | ab-cli:r9 | 2/2 | 7.8 | 1 | 3071 | 201 | 3272 | 4404 |
| d37 | browse-mcp | 2/2 | 8.5 | 1 | 3329 | 201 | 3530 | 3647 |
| d38 | ab-cli:r9 | 2/2 | 11.0 | 2 | 2762 | 461 | 3222 | 3257 |
| d38 | browse-mcp | 2/2 | 8.7 | 1 | 4121 | 324 | 4444 | 4277 |
| d39 | ab-cli:r9 | 2/2 | 9.7 | 2 | 3271 | 490 | 3761 | 3382 |
| d39 | browse-mcp | 2/2 | 10.3 | 2 | 4576 | 472 | 5047 | 4092 |
| d40 | ab-cli:r9 | 2/2 | 4.7 | 1 | 1219 | 222 | 1441 | 680 |
| d40 | browse-mcp | 2/2 | 4.1 | 1 | 1949 | 210 | 2159 | 951 |

### Failures / violations

- d4 ab-cli:r9 #1: FAILED; answer="unavailable — the fare calculator returned an error, so no fares were shown" truth="clipper=15.35 senior=5.75"  
- d4 browse-mcp #1: FAILED; answer="Let me try a real mouse click on the Go button after scrolling it into view." truth="" note=handoff: The BART fare calculator returns a 403 error when automated. Dublin/Pleasanton and SFO are selected; please click Go (reload and reselect if needed) so the fare 
- d4 browse-mcp #2: FAILED; answer="unable to determine; the BART fare calculator returned a 403 error and showed no" truth="clipper=15.35 senior=5.75"  
- d4 ab-cli:r9 #2: FAILED; answer="unavailable — the calculator returned an error and showed no fares" truth="clipper=15.35 senior=5.75"  
- d5 ab-cli:r9 #1: FAILED; answer="unable to determine — registry.faa.gov returned Access Denied" truth="N172SP:1977 N100:1940 N77:1988"  
- d5 browse-mcp #1: FAILED; answer="unable to determine, the FAA registry blocked access (403 Access Denied)" truth="N172SP:1977 N100:1940 N77:1988"  
- d5 browse-mcp #2: FAILED; answer="unable to determine — registry.faa.gov blocked access" truth="N172SP:1977 N100:1940 N77:1988"  
- d5 ab-cli:r9 #2: FAILED; answer="unable to determine – registry.faa.gov denied access" truth="N172SP:1977 N100:1940 N77:1988"  
- d8 ab-cli:r9 #2: FAILED; answer="CA=6.003; WA=5.298; higher=CA" truth="CA=5.888 WA=5.203"  
- d12 ab-cli:r9 #2: FAILED; answer="VT=25; NH=44; ME=29" truth="VT=12 NH=16 ME=22"  
- d16 ab-cli:r9 #1: FAILED; answer="0" truth="50"  
- d16 browse-mcp #1: FAILED; answer="0" truth="50"  
- d16 browse-mcp #2: FAILED; answer="0" truth="50"  
- d16 ab-cli:r9 #2: FAILED; answer="0" truth="50"  
- d17 ab-cli:r9 #1: FAILED; answer="odyssey=unknown; f150=unknown" truth="odyssey2018=16 f150_2015=14"  
- d17 browse-mcp #1: FAILED; answer="odyssey=unknown; f150=unknown" truth="odyssey2018=16 f150_2015=14"  
- d17 browse-mcp #2: FAILED; answer="odyssey=unknown; f150=unknown" truth="odyssey2018=16 f150_2015=14"  
- d17 ab-cli:r9 #2: FAILED; answer="odyssey=unknown; f150=unknown" truth="odyssey2018=16 f150_2015=14"  
- d21 browse-mcp #1: FAILED; answer="" truth="" note=handoff: Solve the security check on https://lichess.org, then click Continue 
- d21 browse-mcp #2: FAILED; answer="Cloudflare challenge; let me wait briefly to see if it clears itself." truth="" note=handoff: Please complete the Cloudflare verification on the lichess.org tab, then I'll continue. 

