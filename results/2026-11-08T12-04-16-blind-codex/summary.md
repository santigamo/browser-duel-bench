# Benchmark summary 2026-11-08T12-04-16-blind-codex

- model/config: see meta.json (codex gpt-6.1-sol); agent-browser {"main":"agent-browser 0.41.2","r7":"agent-browser 0.41.2"}; browse 0.0.14; warm=true
- N=1 per task per variant; interleaved; elapsed 24.3 min
- success = checker passed; clean = passed AND no rule violation (shell use outside the tool, direct URL)

## Static context cost ("Say hi.")

| variant | input tokens | vs no-tool baseline |
|---|---|---|
| none | 9609 | +0 |
| ab-cli:r7 | 10131 | +522 |
| browse-mcp | 9677 | +68 |

MCP servers advertise tools via tools/list (codex defers those schemas, so "Say hi" under-counts them). Advertised size:

- browse-mcp: 18 tools, 44652 B schemas + 1904 B instructions (~11639 tokens at 4 chars/token)

## Suite: blind

### Per-variant (medians over all runs; success over all runs)

| variant | runs | success | compliant (success+clean) | cost USD (primary) | wall s | steps | input | input excl cache | output | total excl cache reads | cost-weighted tokens (proxy) | median call ms | tool-out bytes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ab-cli:r7 | 20 | 0/20 | 0/20 | - | 18 | 4 | 59665 | 9569 | 351 | 9824 | 15720 | 306 | 12512 |
| browse-mcp | 20 | 0/20 | 0/20 | - | 25 | 5 | 167040 | 26099 | 360 | 26613 | 39675 | 186 | 10747 |

### Claim-format deltas (medians, all runs)

- browse vs ab-cli:r7: 38% slower, 173% more input tokens (excl cache), 180% more input tokens (incl cache), 25% more steps, 171% more tokens excl. cache reads

### Per-task ratio geomean vs browse-mcp (<1 = better than browse-mcp; medians per task)

| variant | compliant success | cost USD | steps | wall s | input excl cache | cost-weighted (proxy) | used batch/chain/run (runs) |
|---|---|---|---|---|---|---|---|
| ab-cli:r7 | compliant 0/20 vs 0/20 | - | 0.72 | 0.73 | 0.38 | 0.41 | batch 0, chain 0, run 0 |

### Per task (median of reps; ok = successes/runs)

| task | variant | ok | wall s | steps | input excl cache | output | total excl cache | tool bytes |
|---|---|---|---|---|---|---|---|---|
| b1 | ab-cli:r7 | 0/1 | 11.0 | 2 | 20130 | 168 | 20298 | 13912 |
| b1 | browse-mcp | 0/1 | 31.6 | 7 | 21195 | 435 | 21630 | 11260 |
| b2 | ab-cli:r7 | 0/1 | 7.6 | 1 | 9742 | 135 | 9877 | 2822 |
| b2 | browse-mcp | 0/1 | 12.3 | 2 | 30520 | 182 | 30702 | 5453 |
| b3 | ab-cli:r7 | 0/1 | 14.1 | 2 | 3168 | 322 | 3490 | 2167 |
| b3 | browse-mcp | 0/1 | 16.0 | 3 | 33358 | 232 | 33590 | 7612 |
| b4 | ab-cli:r7 | 0/1 | 18.5 | 4 | 9395 | 376 | 9771 | 16914 |
| b4 | browse-mcp | 0/1 | 24.2 | 5 | 22753 | 281 | 23034 | 15625 |
| b5 | ab-cli:r7 | 0/1 | 26.2 | 6 | 17634 | 399 | 18033 | 26109 |
| b5 | browse-mcp | 0/1 | 33.4 | 10 | 27154 | 555 | 27709 | 20739 |
| b6 | ab-cli:r7 | 0/1 | 13.1 | 2 | 7516 | 265 | 7781 | 13500 |
| b6 | browse-mcp | 0/1 | 29.2 | 5 | 34847 | 447 | 35294 | 39056 |
| b7 | ab-cli:r7 | 0/1 | 10.4 | 1 | 7473 | 204 | 7677 | 12119 |
| b7 | browse-mcp | 0/1 | 15.2 | 3 | 20180 | 303 | 20483 | 5363 |
| b8 | ab-cli:r7 | 0/1 | 32.0 | 5 | 7741 | 500 | 8241 | 12904 |
| b8 | browse-mcp | 0/1 | 37.9 | 8 | 21294 | 454 | 21748 | 10295 |
| b9 | ab-cli:r7 | 0/1 | 24.1 | 6 | 3518 | 475 | 3993 | 1055 |
| b9 | browse-mcp | 0/1 | 21.2 | 4 | 17498 | 324 | 17822 | 807 |
| b10 | ab-cli:r7 | 0/1 | 27.9 | 5 | 15721 | 708 | 16429 | 32761 |
| b10 | browse-mcp | 0/1 | 71.6 | 10 | 30584 | 833 | 31417 | 11199 |
| b11 | ab-cli:r7 | 0/1 | 187.0 | 26 | 41618 | 3356 | 44974 | 49101 |
| b11 | browse-mcp | 0/1 | 115.0 | 1 | 26523 | 556 | 27079 | 1001 |
| b12 | ab-cli:r7 | 0/1 | 42.6 | 6 | 9037 | 682 | 9719 | 21379 |
| b12 | browse-mcp | 0/1 | 35.6 | 10 | 44892 | 659 | 45551 | 85758 |
| b13 | ab-cli:r7 | 0/1 | 10.2 | 1 | 12422 | 107 | 12529 | 455 |
| b13 | browse-mcp | 0/1 | 15.8 | 2 | 14707 | 130 | 14837 | 5161 |
| b14 | ab-cli:r7 | 0/1 | 11.8 | 2 | 3018 | 217 | 3235 | 1983 |
| b14 | browse-mcp | 0/1 | 22.8 | 4 | 19427 | 282 | 19709 | 2890 |
| b15 | ab-cli:r7 | 0/1 | 17.4 | 2 | 18390 | 301 | 18691 | 1217 |
| b15 | browse-mcp | 0/1 | 25.1 | 6 | 25675 | 477 | 26152 | 13616 |
| b16 | ab-cli:r7 | 0/1 | 20.6 | 4 | 3524 | 377 | 3901 | 2551 |
| b16 | browse-mcp | 0/1 | 30.0 | 6 | 25001 | 396 | 25397 | 12955 |
| b17 | ab-cli:r7 | 0/1 | 8.8 | 1 | 13920 | 116 | 14036 | 6152 |
| b17 | browse-mcp | 0/1 | 20.1 | 3 | 14848 | 188 | 15036 | 3753 |
| b18 | ab-cli:r7 | 0/1 | 79.6 | 11 | 21693 | 1307 | 23000 | 29211 |
| b18 | browse-mcp | 0/1 | 14.3 | 2 | 26860 | 214 | 27074 | 174 |
| b19 | ab-cli:r7 | 0/1 | 33.6 | 7 | 8329 | 792 | 9121 | 12923 |
| b19 | browse-mcp | 0/1 | 129.1 | 17 | 78403 | 1184 | 79587 | 30696 |
| b20 | ab-cli:r7 | 0/1 | 17.1 | 4 | 11997 | 326 | 12323 | 10733 |
| b20 | browse-mcp | 0/1 | 24.5 | 6 | 27104 | 304 | 27408 | 14127 |

### Failures / violations

- b1 ab-cli:r7 #1: FAILED; answer="7" truth="7" note=evidence missing: pkg.go.dev 
- b1 browse-mcp #1: FAILED; answer="7" truth="7" note=evidence missing: pkg.go.dev 
- b2 browse-mcp #1: FAILED; answer="3.11 2027-10-31" truth="3.11 2027-10-31" note=evidence missing: eol site 
- b2 ab-cli:r7 #1: FAILED; answer="3.11 2027-10-31" truth="3.11 2027-10-31" note=evidence missing: eol site 
- b3 ab-cli:r7 #1: FAILED; answer="ffmpeg 8" truth="ffmpeg +8 (11 vs 3)" note=evidence missing: brew formula pages 
- b3 browse-mcp #1: FAILED; answer="ffmpeg 8" truth="ffmpeg +8 (11 vs 3)" note=evidence missing: brew formula pages 
- b4 browse-mcp #1: FAILED; answer="15.2.0 4.3" truth="15.2.0 4.3 (MiB)" note=evidence missing: arch packages 
- b4 ab-cli:r7 #1: FAILED; answer="15.2.0 4.3" truth="15.2.0 4.3 (MiB)" note=evidence missing: arch packages 
- b5 ab-cli:r7 #1: FAILED; answer="121" truth="124 (+-3)" note=evidence missing: algolia ui 
- b5 browse-mcp #1: FAILED; answer="121" truth="124 (+-3)" note=evidence missing: algolia ui 
- b6 browse-mcp #1: FAILED; answer="1.58.0 2026-08-03" truth="1.58.0 2026-08-03" note=evidence missing: repo releases 
- b6 ab-cli:r7 #1: FAILED; answer="1.58.0 2026-08-03" truth="1.58.0 2026-08-03" note=evidence missing: repo releases 
- b7 ab-cli:r7 #1: FAILED; answer="64" truth="64" note=evidence missing: repo issues 
- b7 browse-mcp #1: FAILED; answer="64" truth="64" note=evidence missing: repo issues 
- b8 browse-mcp #1: FAILED; answer="98" truth="98 (+-2)" note=evidence missing: usgs site 
- b8 ab-cli:r7 #1: FAILED; answer="98" truth="98 (+-2)" note=evidence missing: usgs site 
- b9 browse-mcp #1: FAILED; answer="unavailable" truth="(truth unavailable)" note=checker could not compute truth: Error: Unable to connect. Is the computer able to access the url? Error: Unable to connect. Is the computer able to access the url? 
- b9 ab-cli:r7 #1: FAILED; answer="unavailable" truth="(truth unavailable)" note=checker could not compute truth: Error: Unable to connect. Is the computer able to access the url? Error: Unable to connect. Is the computer able to access the url? 
- b10 browse-mcp #1: FAILED; answer="1.1191" truth="1.1191 (usd 1.073, chf 0.9588)" note=evidence missing: ecb site 
- b10 ab-cli:r7 #1: FAILED; answer="1.1191" truth="1.1191 (usd 1.073, chf 0.9588)" note=evidence missing: ecb site 
- b11 ab-cli:r7 #1: FAILED; answer="unavailable" truth="26"  
- b11 browse-mcp #1: FAILED; answer="unavailable" truth="26"  
- b12 browse-mcp #1: FAILED; answer="nanorand 0.8.0" truth="nanorand 0.8.0 (order fastrand>oorandom>nanorand>tinyrand)" note=evidence missing: crates.io 
- b12 ab-cli:r7 #1: FAILED; answer="nanorand 0.8.0" truth="nanorand 0.8.0 (order fastrand>oorandom>nanorand>tinyrand)" note=evidence missing: crates.io 
- b13 browse-mcp #1: FAILED; answer="6.6 2" truth="6.6 2 (6 rows)" note=evidence missing: kernel.org 
- b13 ab-cli:r7 #1: FAILED; answer="6.6 2" truth="6.6 2 (6 rows)" note=evidence missing: kernel.org 
- b14 browse-mcp #1: FAILED; answer="139" truth="139 (or 142 if time sent with seconds)" note=evidence missing: server echoed the submitted fields 
- b14 ab-cli:r7 #1: FAILED; answer="139" truth="139 (or 142 if time sent with seconds)" note=evidence missing: server echoed the submitted fields 
- b15 ab-cli:r7 #1: FAILED; answer="3339260" truth="3339260 (12 of 57 rows)" note=evidence missing: datatables 
- b15 browse-mcp #1: FAILED; answer="3339260" truth="3339260 (12 of 57 rows)" note=evidence missing: datatables 
- b16 ab-cli:r7 #1: FAILED; answer="97 1994-01-01" truth="97 1994-01-01 (of 3)" note=evidence missing: gutenberg; saw a release date 
- b16 browse-mcp #1: FAILED; answer="97 1994-01-01" truth="97 1994-01-01 (of 3)" note=evidence missing: gutenberg; saw a release date 
- b17 browse-mcp #1: FAILED; answer="2.2.4 2022-12-16" truth="2.2.4 2022-12-16" note=evidence missing: rubygems 
- b17 ab-cli:r7 #1: FAILED; answer="2.2.4 2022-12-16" truth="2.2.4 2022-12-16" note=evidence missing: rubygems 
- b18 browse-mcp #1: FAILED; answer="unavailable" truth="13.6 (URY 89.87, PRY 76.26; +-0.3)"  
- b18 ab-cli:r7 #1: FAILED; answer="13.6" truth="13.6 (URY 89.87, PRY 76.26; +-0.3)" note=evidence missing: worldbank 
- b19 ab-cli:r7 #1: FAILED; answer="sha512-t4GWSVZO1eC8BM339Xd7Uphw5s17a86tIZIj8qRxhnKub6WoyhnrxeCIMeAqBPgdZGlCcG2Pr" truth="sha512-t4GWSVZO1eC8BM339Xd7Uphw5s17a86tIZIj8qRxhnKub6Woyhnrx" note=evidence missing: cdnjs 
- b19 browse-mcp #1: FAILED; answer="sha512-t4GWSVZO1eC8BM339Xd7Uphw5s17a86tIZIj8qRxhnKub6WoyhnrxeCIMeAqBPgdZGlCcG2Pr" truth="sha512-t4GWSVZO1eC8BM339Xd7Uphw5s17a86tIZIj8qRxhnKub6Woyhnrx" note=evidence missing: cdnjs 
- b20 ab-cli:r7 #1: FAILED; answer="Jod v22.23.4" truth="Jod v22.23.4" note=evidence missing: nodejs.org 
- b20 browse-mcp #1: FAILED; answer="Jod v22.23.4" truth="Jod v22.23.4" note=evidence missing: nodejs.org 

