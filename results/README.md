# About these result files

Published results: `2026-11-14T13-58-33-blind4-final` (r10: fork r10.1 vs upstream agent-browser 0.43.0 and browse, 40 tasks, 1 run each) and `2026-11-13T10-51-21-blind3-final` (r9 vs browse, 40 tasks, 2 runs each). Rows, transcripts and reports are scrubbed copies of the originals.

Changed: session, request, run and message ids (message and tool-call ids are replaced by a short sha256, so equal ids stay equal), the auth-expiry timestamp, rate-limit and utilization blocks, plan and organisation flags, socket paths, home-directory paths, challenge tokens and CDN/WAF reference numbers. Page text returned by tools is cut to 300 characters followed by its sha256 and original length. Counts, costs, wall times and the agent's own calls and answers are unchanged. Reports can be regenerated from the scrubbed files with `python3 src/final.py manifest-blind4.json --report r10` (r10) and `python3 src/final.py manifest-blind3.json --report r9` (r9).

`2026-11-08T18-30-37-blind2-sonnet` (r8 round) and `2026-11-08T12-04-16-blind-codex` (r7 round, second model) contain only their generated summaries. The r7 verdict is `guard/resultado-ciego-r7.md`, the r8 verdict `guard/resultado-ciego-r8.md`.
