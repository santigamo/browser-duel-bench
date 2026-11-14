#!/bin/sh
# Build the publishable tree: `git archive HEAD` (tracked files only) plus scrubbed copies of the published results.
# usage: scripts/export-public.sh [output dir]        default: ../public-bench
# Run it on a clean commit: uncommitted changes are NOT exported. Needs git, tar, python3.
set -eu
HERE=$(cd "$(dirname "$0")/.." && pwd)
OUT=${1:-$HERE/../public-bench}
SCRUB="python3 -I $HERE/scripts/scrub_results.py"
R=results
FINAL=2026-11-13T10-51-21-blind3-final      # r9 vs browse-mcp, 40 tasks
FINAL10=2026-11-14T13-58-33-blind4-final    # r10: fork r10.1 vs upstream 0.43.0 and browse-mcp, 40 tasks (main published result)
R8=2026-11-08T18-30-37-blind2-sonnet        # r8 round, c1..c20 (failed its thresholds)
R7B=2026-11-08T12-04-16-blind-codex         # r7 round, second-model run (the r7 verdict itself is guard/resultado-ciego-r7.md)

[ -z "$(git -C "$HERE" status --porcelain -- . ':!results')" ] || { echo "working tree has uncommitted changes; commit first" >&2; exit 1; }
# keep an existing .git in the output directory (the public repo), replace everything else
mkdir -p "$OUT"; find "$OUT" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
git -C "$HERE" archive HEAD | tar -x -C "$OUT"
# the private bench ignores results/ (local runs); the public repo tracks the scrubbed results it ships
grep -v '^results/$' "$OUT/.gitignore" > "$OUT/.gitignore.tmp" && mv "$OUT/.gitignore.tmp" "$OUT/.gitignore"

# full scrubbed rows and transcripts of the published results (r10 and r9)
$SCRUB "$HERE/$R/$FINAL10" "$OUT/$R/$FINAL10"
[ -f "$HERE/$R/blind4-final.log" ] && $SCRUB "$HERE/$R/blind4-final.log" "$OUT/$R/blind4-final.log"
$SCRUB "$HERE/$R/$FINAL" "$OUT/$R/$FINAL"
[ -f "$HERE/$R/blind3-final.log" ] && $SCRUB "$HERE/$R/blind3-final.log" "$OUT/$R/blind3-final.log"
# summaries only for the r7 and r8 rounds (their full rows are not published)
for d in $R8 $R7B; do [ -d "$HERE/$R/$d" ] && $SCRUB "$HERE/$R/$d" "$OUT/$R/$d" --only-md; done

cat > "$OUT/$R/README.md" <<'TXT'
# About these result files

Published results: `2026-11-14T13-58-33-blind4-final` (r10: fork r10.1 vs upstream agent-browser 0.43.0 and browse, 40 tasks, 1 run each) and `2026-11-13T10-51-21-blind3-final` (r9 vs browse, 40 tasks, 2 runs each). Rows, transcripts and reports are scrubbed copies of the originals.

Changed: session, request, run and message ids (message and tool-call ids are replaced by a short sha256, so equal ids stay equal), the auth-expiry timestamp, rate-limit and utilization blocks, plan and organisation flags, socket paths, home-directory paths, challenge tokens and CDN/WAF reference numbers. Page text returned by tools is cut to 300 characters followed by its sha256 and original length. Counts, costs, wall times and the agent's own calls and answers are unchanged. Reports can be regenerated from the scrubbed files with `python3 src/final.py manifest-blind4.json --report r10` (r10) and `python3 src/final.py manifest-blind3.json --report r9` (r9).

`2026-11-08T18-30-37-blind2-sonnet` (r8 round) and `2026-11-08T12-04-16-blind-codex` (r7 round, second model) contain only their generated summaries. The r7 verdict is `guard/resultado-ciego-r7.md`, the r8 verdict `guard/resultado-ciego-r8.md`.
TXT

# never ship the local state directories
for n in .codex-home .browse-home .profiles .cache .xdg .secrets .home .browse-ext; do
  [ ! -e "$OUT/$n" ] || { echo "refusing: $n is in the export" >&2; exit 1; }
done
echo "exported to $OUT"
