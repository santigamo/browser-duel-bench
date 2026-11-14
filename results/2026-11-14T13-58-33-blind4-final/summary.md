# Benchmark summary 2026-11-14T13-58-33-blind4-final

- model/config: see meta.json (claude claude-sonnet-5-5); agent-browser {"main":"agent-browser 0.43.0-duel.1","r10":"agent-browser 0.43.0-duel.1","v043":"agent-browser 0.43.0"}; browse 0.0.14; warm=true
- N=1 per task per variant; interleaved; elapsed 44 min
- success = checker passed; clean = passed AND no rule violation (shell use outside the tool, direct URL)

## Suite: blind4

### Per-variant (medians over all runs; success over all runs)

| variant | runs | success | compliant (success+clean) | cost USD (primary) | wall s | steps | input | input excl cache | output | total excl cache reads | cost-weighted tokens (proxy) | median call ms | tool-out bytes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ab-cli:r10 | 40 | 37/40 | 36/40 | 0.0141 | 8.0 | 2 | 15879 | 2094 | 509 | 2709 | 3768 | 1704 | 1260 |
| ab-cli:v043 | 40 | 37/40 | 36/40 | 0.0276 | 11.9 | 4 | 35902 | 4200 | 701 | 5001 | 8105 | 182 | 7165 |
| browse-mcp | 40 | 37/40 | 36/40 | 0.0181 | 7.3 | 2 | 30801 | 2811 | 463 | 3329 | 5836 | 1064 | 1769 |

### Per-task ratio geomean vs browse-mcp (<1 = better than browse-mcp; medians per task)

| variant | compliant success | cost USD | steps | wall s | input excl cache | cost-weighted (proxy) | used batch/chain/run (runs) |
|---|---|---|---|---|---|---|---|
| ab-cli:r10 | compliant 36/40 vs 36/40 | 0.83 | 1.03 | 1.09 | 0.77 | 0.70 | batch 0, chain 1, run 40 |
| ab-cli:v043 | compliant 36/40 vs 36/40 | 1.47 | 2.27 | 1.53 | 1.50 | 1.38 | batch 0, chain 36, run 0 |

### Per task (median of reps; ok = successes/runs)

| task | variant | ok | wall s | steps | input excl cache | output | total excl cache | tool bytes |
|---|---|---|---|---|---|---|---|---|
| g1 | ab-cli:r10 | 1/1 | 36.7 | 3 | 4721 | 747 | 5468 | 3527 |
| g1 | ab-cli:v043 | 1/1 | 13.5 | 5 | 9531 | 918 | 10449 | 17833 |
| g1 | browse-mcp | 1/1 | 6.6 | 2 | 11718 | 512 | 12230 | 3385 |
| g2 | ab-cli:r10 | 1/1 | 51.7 | 11 | 9999 | 2138 | 12137 | 10847 |
| g2 | ab-cli:v043 | 1/1 | 15.6 | 3 | 6319 | 632 | 6951 | 11702 |
| g2 | browse-mcp | 1/1 | 10.6 | 2 | 5270 | 647 | 5917 | 5500 |
| g3 | ab-cli:r10 | 1/1 | 21.2 | 6 | 3699 | 1462 | 5161 | 2596 |
| g3 | ab-cli:v043 | 1/1 | 39.4 | 14 | 8854 | 2621 | 11475 | 12998 |
| g3 | browse-mcp | 1/1 | 9.3 | 4 | 4676 | 565 | 5241 | 5643 |
| g4 | ab-cli:r10 | 0/1 | 7.4 | 1 | 1497 | 513 | 2010 | 147 |
| g4 | ab-cli:v043 | 0/1 | 10.9 | 4 | 4382 | 578 | 4960 | 7500 |
| g4 | browse-mcp | 0/1 | 5.9 | 1 | 2310 | 227 | 2537 | 1102 |
| g5 | ab-cli:r10 | 1/1 | 12.2 | 3 | 3065 | 505 | 3570 | 2432 |
| g5 | ab-cli:v043 | 1/1 | 20.0 | 4 | 9249 | 881 | 10130 | 14142 |
| g5 | browse-mcp | 1/1 | 109.9 | 4 | 5565 | 1121 | 6686 | 5259 |
| g6 | ab-cli:r10 | 1/1 | 6.5 | 1 | 1813 | 313 | 2126 | 1073 |
| g6 | ab-cli:v043 | 1/1 | 8.5 | 2 | 5758 | 488 | 6246 | 6980 |
| g6 | browse-mcp | 1/1 | 7.6 | 2 | 2530 | 422 | 2952 | 1250 |
| g7 | ab-cli:r10 | 1/1 | 11.9 | 4 | 2717 | 1260 | 3977 | 930 |
| g7 | ab-cli:v043 | 1/1 | 13.6 | 3 | 4188 | 875 | 5063 | 6662 |
| g7 | browse-mcp | 1/1 | 9.1 | 3 | 2931 | 800 | 3731 | 1344 |
| g8 | ab-cli:r10 | 1/1 | 4.2 | 1 | 2523 | 231 | 2754 | 2863 |
| g8 | ab-cli:v043 | 1/1 | 10.3 | 4 | 4354 | 656 | 5010 | 7645 |
| g8 | browse-mcp | 1/1 | 5.6 | 2 | 3268 | 333 | 3601 | 3058 |
| g9 | ab-cli:r10 | 1/1 | 4.6 | 1 | 1472 | 192 | 1664 | 518 |
| g9 | ab-cli:v043 | 1/1 | 10.4 | 4 | 4211 | 470 | 4681 | 7538 |
| g9 | browse-mcp | 1/1 | 5.1 | 1 | 2018 | 228 | 2246 | 712 |
| g10 | ab-cli:r10 | 1/1 | 7.1 | 1 | 1322 | 459 | 1781 | 66 |
| g10 | ab-cli:v043 | 1/1 | 13.6 | 6 | 4185 | 926 | 5111 | 6533 |
| g10 | browse-mcp | 1/1 | 5.8 | 1 | 2015 | 282 | 2297 | 407 |
| g11 | ab-cli:r10 | 1/1 | 6.6 | 1 | 14560 | 362 | 14922 | 27612 |
| g11 | ab-cli:v043 | 1/1 | 7.1 | 2 | 3647 | 474 | 4121 | 6475 |
| g11 | browse-mcp | 1/1 | 5.1 | 1 | 2030 | 376 | 2406 | 528 |
| g12 | ab-cli:r10 | 1/1 | 6.5 | 1 | 2622 | 263 | 2885 | 3194 |
| g12 | ab-cli:v043 | 1/1 | 15.1 | 6 | 4842 | 755 | 5597 | 8664 |
| g12 | browse-mcp | 1/1 | 7.1 | 2 | 3910 | 354 | 4264 | 2427 |
| g13 | ab-cli:r10 | 1/1 | 5.5 | 1 | 3285 | 267 | 3552 | 3135 |
| g13 | ab-cli:v043 | 1/1 | 9.8 | 4 | 3902 | 640 | 4542 | 6421 |
| g13 | browse-mcp | 1/1 | 5.9 | 1 | 3301 | 470 | 3771 | 2734 |
| g14 | ab-cli:r10 | 1/1 | 8.0 | 1 | 1588 | 536 | 2124 | 249 |
| g14 | ab-cli:v043 | 1/1 | 20.9 | 4 | 5198 | 1071 | 6269 | 8208 |
| g14 | browse-mcp | 1/1 | 8.9 | 1 | 2446 | 567 | 3013 | 1060 |
| g15 | ab-cli:r10 | 1/1 | 5.9 | 1 | 1708 | 213 | 1921 | 714 |
| g15 | ab-cli:v043 | 1/1 | 9.5 | 3 | 4172 | 418 | 4590 | 7039 |
| g15 | browse-mcp | 1/1 | 7.3 | 2 | 2690 | 393 | 3083 | 1214 |
| g16 | ab-cli:r10 | 1/1 | 51.5 | 10 | 5457 | 2106 | 7563 | 4712 |
| g16 | ab-cli:v043 | 1/1 | 39.4 | 18 | 11386 | 2419 | 13805 | 17706 |
| g16 | browse-mcp | 1/1 | 34.7 | 7 | 9015 | 1525 | 10540 | 11080 |
| g17 | ab-cli:r10 | 1/1 | 4.9 | 1 | 2503 | 336 | 2839 | 2010 |
| g17 | ab-cli:v043 | 1/1 | 9.6 | 3 | 4083 | 569 | 4652 | 6710 |
| g17 | browse-mcp | 1/1 | 5.2 | 1 | 3221 | 353 | 3574 | 2331 |
| g18 | ab-cli:r10 | 1/1 | 6.9 | 2 | 3289 | 532 | 3821 | 4198 |
| g18 | ab-cli:v043 | 1/1 | 17.1 | 6 | 5221 | 1292 | 6513 | 7675 |
| g18 | browse-mcp | 1/1 | 7.3 | 2 | 4332 | 544 | 4876 | 5333 |
| g19 | ab-cli:r10 | 1/1 | 96.0 | 15 | 12575 | 4349 | 16924 | 14450 |
| g19 | ab-cli:v043 | 1/1 | 41.9 | 7 | 9316 | 1475 | 10791 | 15684 |
| g19 | browse-mcp | 1/1 | 68.7 | 4 | 6555 | 1172 | 7727 | 8822 |
| g20 | ab-cli:r10 | 1/1 | 5.4 | 1 | 1808 | 413 | 2221 | 689 |
| g20 | ab-cli:v043 | 1/1 | 7.6 | 2 | 3745 | 746 | 4491 | 6509 |
| g20 | browse-mcp | 1/1 | 5.8 | 1 | 2393 | 520 | 2913 | 1015 |
| g21 | ab-cli:r10 | 1/1 | 11.2 | 4 | 5798 | 900 | 6698 | 6316 |
| g21 | ab-cli:v043 | 1/1 | 13.8 | 4 | 6656 | 813 | 7469 | 10259 |
| g21 | browse-mcp | 1/1 | 11.5 | 3 | 5730 | 855 | 6585 | 5892 |
| g22 | ab-cli:r10 | 1/1 | 14.6 | 2 | 2173 | 781 | 2954 | 983 |
| g22 | ab-cli:v043 | 1/1 | 24.7 | 8 | 4949 | 1444 | 6393 | 7013 |
| g22 | browse-mcp | 1/1 | 14.7 | 3 | 4302 | 690 | 4992 | 3583 |
| g23 | ab-cli:r10 | 1/1 | 10.7 | 1 | 1736 | 193 | 1929 | 1280 |
| g23 | ab-cli:v043 | 1/1 | 9.7 | 2 | 3377 | 317 | 3694 | 6122 |
| g23 | browse-mcp | 1/1 | 11.1 | 1 | 2228 | 209 | 2437 | 1344 |
| g24 | ab-cli:r10 | 1/1 | 5.1 | 1 | 1381 | 334 | 1715 | 178 |
| g24 | ab-cli:v043 | 1/1 | 10.3 | 3 | 3763 | 608 | 4371 | 6439 |
| g24 | browse-mcp | 1/1 | 4.9 | 1 | 2058 | 338 | 2396 | 579 |
| g26 | ab-cli:r10 | 0/1 | 9.5 | 2 | 2014 | 649 | 2663 | 1793 |
| g26 | ab-cli:v043 | 0/1 | 28.4 | 6 | 4686 | 1126 | 5812 | 7807 |
| g26 | browse-mcp | 0/1 | 10.2 | 4 | 3877 | 841 | 4718 | 4147 |
| g27 | ab-cli:r10 | 1/1 | 11.0 | 2 | 2011 | 1005 | 3016 | 1239 |
| g27 | ab-cli:v043 | 1/1 | 7.5 | 2 | 3801 | 454 | 4255 | 7272 |
| g27 | browse-mcp | 1/1 | 7.4 | 1 | 2353 | 625 | 2978 | 1586 |
| g28 | ab-cli:r10 | 1/1 | 10.6 | 1 | 1359 | 382 | 1741 | 47 |
| g28 | ab-cli:v043 | 1/1 | 31.1 | 8 | 5646 | 1330 | 6976 | 8797 |
| g28 | browse-mcp | 1/1 | 11.2 | 1 | 8555 | 441 | 8996 | 12103 |
| g29 | ab-cli:r10 | 1/1 | 6.1 | 1 | 2229 | 219 | 2448 | 2515 |
| g29 | ab-cli:v043 | 1/1 | 11.5 | 4 | 3959 | 426 | 4385 | 7381 |
| g29 | browse-mcp | 1/1 | 4.3 | 1 | 2485 | 164 | 2649 | 1951 |
| g30 | ab-cli:r10 | 1/1 | 7.9 | 2 | 2670 | 583 | 3253 | 2455 |
| g30 | ab-cli:v043 | 1/1 | 20.7 | 9 | 6714 | 1866 | 8580 | 9255 |
| g30 | browse-mcp | 1/1 | 9.1 | 3 | 3328 | 762 | 4090 | 2598 |
| g31 | ab-cli:r10 | 1/1 | 4.3 | 1 | 1238 | 247 | 1485 | 113 |
| g31 | ab-cli:v043 | 1/1 | 10.0 | 3 | 3599 | 591 | 4190 | 6273 |
| g31 | browse-mcp | 1/1 | 4.5 | 1 | 1933 | 248 | 2181 | 560 |
| g32 | ab-cli:r10 | 1/1 | 5.2 | 1 | 1780 | 377 | 2157 | 976 |
| g32 | ab-cli:v043 | 1/1 | 7.6 | 2 | 3592 | 419 | 4011 | 6450 |
| g32 | browse-mcp | 1/1 | 7.3 | 2 | 2271 | 640 | 2911 | 575 |
| g33 | ab-cli:r10 | 1/1 | 25.4 | 4 | 4342 | 1083 | 5425 | 6393 |
| g33 | ab-cli:v043 | 1/1 | 16.0 | 6 | 5764 | 891 | 6655 | 10373 |
| g33 | browse-mcp | 1/1 | 11.4 | 3 | 3776 | 583 | 4359 | 4145 |
| g34 | ab-cli:r10 | 1/1 | 8.0 | 1 | 1522 | 532 | 2054 | 397 |
| g34 | ab-cli:v043 | 1/1 | 10.8 | 3 | 3908 | 522 | 4430 | 6798 |
| g34 | browse-mcp | 1/1 | 6.7 | 1 | 2077 | 393 | 2470 | 624 |
| g35 | ab-cli:r10 | 1/1 | 13.9 | 3 | 3002 | 765 | 3767 | 2239 |
| g35 | ab-cli:v043 | 1/1 | 26.6 | 8 | 10175 | 1500 | 11675 | 14755 |
| g35 | browse-mcp | 1/1 | 51.8 | 7 | 5592 | 1445 | 7037 | 5443 |
| g36 | ab-cli:r10 | 0/1 | 6.3 | 2 | 1830 | 462 | 2292 | 737 |
| g36 | ab-cli:v043 | 0/1 | 7.0 | 2 | 3675 | 462 | 4137 | 6493 |
| g36 | browse-mcp | 0/1 | 4.8 | 1 | 3427 | 212 | 3639 | 3288 |
| g37 | ab-cli:r10 | 1/1 | 5.8 | 2 | 1369 | 321 | 1690 | 220 |
| g37 | ab-cli:v043 | 1/1 | 7.3 | 3 | 3365 | 361 | 3726 | 6094 |
| g37 | browse-mcp | 1/1 | 6.5 | 2 | 2298 | 427 | 2725 | 912 |
| g38 | ab-cli:r10 | 1/1 | 7.4 | 1 | 1467 | 549 | 2016 | 92 |
| g38 | ab-cli:v043 | 1/1 | 12.2 | 4 | 4084 | 779 | 4863 | 7058 |
| g38 | browse-mcp | 1/1 | 5.5 | 1 | 2077 | 427 | 2504 | 492 |
| g39 | ab-cli:r10 | 1/1 | 8.3 | 2 | 1728 | 495 | 2223 | 568 |
| g39 | ab-cli:v043 | 1/1 | 7.8 | 2 | 3420 | 419 | 3839 | 6222 |
| g39 | browse-mcp | 1/1 | 8.5 | 2 | 2634 | 416 | 3050 | 1548 |
| g40 | ab-cli:r10 | 1/1 | 9.1 | 3 | 2722 | 763 | 3485 | 1977 |
| g40 | ab-cli:v043 | 1/1 | 12.3 | 4 | 4186 | 806 | 4992 | 6879 |
| g40 | browse-mcp | 1/1 | 6.5 | 2 | 2463 | 533 | 2996 | 983 |
| g25 | ab-cli:r10 | 1/1 | 9.7 | 3 | 1670 | 656 | 2326 | 124 |
| g25 | ab-cli:v043 | 1/1 | 11.7 | 4 | 3760 | 607 | 4367 | 6324 |
| g25 | browse-mcp | 1/1 | 6.0 | 2 | 1951 | 455 | 2406 | 171 |

### Failures / violations

- g4 ab-cli:r10 #1: FAILED; answer="51" truth="{\"6.1010\":12,\"6.1020\":15,\"6.1210\":12,\"6.1910\":18}=57"  
- g4 browse-mcp #1: FAILED; answer="51" truth="{\"6.1010\":12,\"6.1020\":15,\"6.1210\":12,\"6.1910\":18}=57"  
- g4 ab-cli:v043 #1: FAILED; answer="51" truth="{\"6.1010\":12,\"6.1020\":15,\"6.1210\":12,\"6.1910\":18}=57"  
- g20 ab-cli:r10 #1: passed; answer="13; 12; 12; 37" truth="13; 12; 12; 37"  violations=["direct-url: navigated to a URL matching /\\.json\\b|\\/api\\/|crandb|packages\\.rds|PACKAGES/i"]
- g20 browse-mcp #1: passed; answer="13; 12; 12; 37" truth="13; 12; 12; 37"  violations=["direct-url: navigated to a URL matching /\\.json\\b|\\/api\\/|crandb|packages\\.rds|PACKAGES/i"]
- g20 ab-cli:v043 #1: passed; answer="13; 12; 12; 37" truth="13; 12; 12; 37"  violations=["direct-url (recorded navigation): https://cran.r-project.org/web/packages/dplyr/index.html"]
- g26 browse-mcp #1: FAILED; answer="unable to determine – ndbc.noaa.gov returned 403 (CloudFront block) for all stat" truth="51001; 4842"  
- g26 ab-cli:r10 #1: FAILED; answer="unable to determine – ndbc.noaa.gov returned 403 Request blocked for all station" truth="51001; 4842"  
- g26 ab-cli:v043 #1: FAILED; answer="unable to determine – ndbc.noaa.gov returned 403 (CloudFront blocked) for all pa" truth="51001; 4842"  
- g36 ab-cli:r10 #1: FAILED; answer="Montréal; 72.6" truth="Chicago; 72.2 (of 9 big cities)"  
- g36 ab-cli:v043 #1: FAILED; answer="Montréal; 72.6" truth="Chicago; 72.2 (of 9 big cities)"  
- g36 browse-mcp #1: FAILED; answer="New York; 69.3" truth="Chicago; 72.2 (of 9 big cities)"  

