"""POST HOC / SENSITIVITY report: r7 vs browse on both blind sets under the handoff rule and the endpoint policy. NOT the official result.

Usage: python3 src/posthoc_report.py [--iters 2000] [--seed 7] > guard/posthoc-rescore-r7-vs-browse.md
Needs results/posthoc/{blind1,blind2}.rows.jsonl (bun src/posthoc.ts) and {blind1,blind2}.handoff-only.jsonl (bun src/handoff-posthoc.ts).
Scenarios, same rows and same estimators (final.py), hierarchical bootstrap (tasks resampled, then runs):
  official      rows as recorded in runs.jsonl, no exclusion
  +handoff      handoff rule only (charged wall/cost up to the first handoff request)
  +policy       handoff rule + endpoint policy + workflow rubric + automatic exclusion of tasks whose truth could not be computed
"""
import os, random, re, sys, statistics as st
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import final

A, B = 'ab-cli:r7', 'browse-mcp'
D1, D2 = 'results/2026-11-08T10-52-34-blind-sonnet', 'results/2026-11-08T18-30-37-blind2-sonnet'
PH = 'results/posthoc/'

def load(runs1, runs2, auto, drop=()):
    m = {'auto_exclude_truth': auto, 'dirs': [
        dict({'dir': D1}, **({'runs_file': PH + runs1} if runs1 else {})),
        dict({'dir': D2}, **({'runs_file': PH + runs2} if runs2 else {}))]}
    for d in m['dirs']:
        d['exclude_tasks'] = {t: 'judgment sensitivity' for t in drop if (t[0] == 'b') == (d['dir'] == D1)}
        if not d['exclude_tasks']:
            del d['exclude_tasks']
    rows, per = final.collect(m)
    return [r for r in rows if r['variant'] in (A, B)], per

SCEN = [('official', load(None, None, False)), ('+handoff (defensible sensitivity)', load('blind1.handoff-only.jsonl', 'blind2.handoff-only.jsonl', False)),
        ('+policy (NOT evidence)', load('blind1.rows.jsonl', 'blind2.rows.jsonl', True))]
GROUPS = [('blind 1 (b1-b20)', lambda t: t[0] == 'b'), ('blind 2 (c1-c20)', lambda t: t[0] == 'c'), ('POOLED', lambda t: True)]

def ci(pt, lo, hi, nd=2):
    return 'n/a' if pt != pt else final.fmt_ci(pt, lo, hi, nd)

def main(argv):
    iters = int(argv[argv.index('--iters') + 1]) if '--iters' in argv else 2000
    seed = int(argv[argv.index('--seed') + 1]) if '--seed' in argv else 7
    out = []; P = out.append
    P('# POST HOC / SENSITIVITY: r7 vs browse under the handoff rule (defensible) and the endpoint policy (NOT evidence)'); P('')
    P('> **How to read the columns.** `official` = the rows as recorded. `+handoff (defensible sensitivity)`: the handoff rule only; it concerns what the run itself did (it asked a human who never answers) and is a defensible sensitivity to the official wall and cost. '
      '`+policy (NOT evidence)`: also applies the endpoint policy, the workflow rubric, the automatic exclusions and a re-evaluation of evidence. Those rules were WRITTEN AFTER THE RESULTS WERE SEEN, the agents were never told them, and the column is **NOT evidence** about the tools: it only shows how much the official numbers depend on unstated rules. '
      'The r9 preregistration (guard/prereg-r9.md) states its rules to the agent beforehand instead.'); P('')
    P('**This is NOT the official result.** The official numbers are guard/resultado-ciego-r7.md (blind 1) and results/2026-11-08T18-30-37-blind2-sonnet/report-blind2.md (blind 2); nothing here replaces them, no runs file was modified, and these rows were never produced by a run. '
      'Same runs, re-scored: (1) a run ends at its first human-handoff request, charged wall and cost only up to it (guard/handoff-policy.md); (2) one endpoint policy applied to every task, with a separate workflow rubric (guard/endpoint-policy.md); '
      '(3) tasks whose truth could not be computed for most runs are excluded for all variants. Ratios are %s / %s (below 1 = r7 better); per-task median, geometric mean over tasks, 95%% hierarchical bootstrap, %d resamples, seed %d. Claude sonnet-5-5, N=3.' % (A, B, iters, seed)); P('')
    P('## Exclusions and warnings per scenario'); P('')
    for name, (rows, per) in SCEN:
        for d in per:
            ex = '; '.join('%s: %s' % kv for kv in d['excluded'].items()) or '-'
            P('- %s, %s: expected %d, present %d, excluded: %s' % (name, d['dir'].split('/')[-1], d['expected'], d['present'], ex))
            for w in d['truth_warnings']:
                P('  - WARNING: ' + w)
    P('')
    for g, f in GROUPS:
        rng = random.Random(seed)
        P('## %s' % g); P('')
        cols = []
        for name, (rows, per) in SCEN:
            R = [r for r in rows if f(r['task'])]
            tasks = sorted({r['task'] for r in R}); ra = [r for r in R if r['variant'] == A]; rb = [r for r in R if r['variant'] == B]
            c = {}
            c['tasks'] = str(len(tasks))
            c['compliant success'] = '%d/%d vs %d/%d' % (sum(bool(r.get('clean')) for r in ra), len(ra), sum(bool(r.get('clean')) for r in rb), len(rb))
            dp, lo, hi, _ = final.bootstrap_rate_diff(R, A, B, f, 'hier', iters, rng); c['compliant success diff (pts)'] = '%+.1f [%+.1f, %+.1f]' % (dp * 100, lo * 100, hi * 100)
            wa = [r for r in ra if r.get('workflow_ok') is not None]; wb = [r for r in rb if r.get('workflow_ok') is not None]
            if wa and wb:
                c['workflow compliance'] = '%d/%d vs %d/%d' % (sum(bool(r['workflow_ok']) for r in wa), len(wa), sum(bool(r['workflow_ok']) for r in wb), len(wb))
                dp, lo, hi, _ = final.bootstrap_rate_diff([r for r in R if r.get('workflow_ok') is not None], A, B, f, 'hier', iters, rng, field='workflow_ok'); c['workflow compliance diff (pts)'] = '%+.1f [%+.1f, %+.1f]' % (dp * 100, lo * 100, hi * 100)
                dp, lo, hi, _ = final.bootstrap_rate_diff(R, A, B, f, 'hier', iters, rng, field='_strict'); c['strict compliant success diff (pts)'] = '%+.1f [%+.1f, %+.1f]' % (dp * 100, lo * 100, hi * 100)
            else:
                c['workflow compliance'] = 'n/a (no rubric rows)'
            c['handoff rate'] = '%d/%d vs %d/%d' % (sum(bool(r.get('_handoff')) for r in ra), len(ra), sum(bool(r.get('_handoff')) for r in rb), len(rb))
            c['timeout rate'] = '%d/%d vs %d/%d' % (sum(bool(r.get('timed_out')) for r in ra), len(ra), sum(bool(r.get('timed_out')) for r in rb), len(rb))
            for k, nm in (('wall_s', 'wall (charged)'), ('cost_usd', 'cost_usd'), ('peak_ctx', 'peak context'), ('dyn_ctx', 'dynamic context'), ('steps', 'steps')):
                pt, lo, hi, n = final.bootstrap_ratio(R, A, B, k, f, 'hier', iters, rng); c[nm] = ci(pt, lo, hi) if n else 'n/a'
            pt, lo, hi, n = final.bootstrap_cps_ratio(R, A, B, f, 'hier', iters, rng); c['cost per compliant success'] = ci(pt, lo, hi) if n else 'n/a'
            for v, lab in ((A, 'r7'), (B, 'browse')):
                cc, kk, _ = final.cost_per_compliant([r for r in R if r['variant'] == v]); c['cost per compliant success, ' + lab + ' (USD)'] = ('%.4f' % (cc / kk)) if kk else 'n/a'
            cols.append(c)
        keys = []
        for c in cols:
            keys += [k for k in c if k not in keys]
        P('| metric | ' + ' | '.join(n for n, _ in SCEN) + ' |'); P('|---|' + '---|' * len(SCEN))
        for k in keys:
            P('| %s | %s |' % (k, ' | '.join(c.get(k, '-') for c in cols)))
        P('')
        o, p = cols[0], cols[-1]
        P('Change official -> +policy (NOT evidence): ' + '; '.join('%s %s -> %s' % (k, o[k].split(' [')[0], p[k].split(' [')[0]) for k in ('compliant success', 'wall (charged)', 'cost_usd', 'cost per compliant success', 'peak context', 'dynamic context', 'steps') if k in o and k in p) + '.'); P('')
    P('## Reading notes'); P('')
    P('- compliant success = answer right AND evidence AND no rule violation (clean); in `+policy` the violations include the uniform endpoint policy, so runs that read the API of the site no longer count. workflow compliance is scored apart (only tasks with a rubric) and does not change compliant success.')
    P('- Costs of runs cut at a handoff are ESTIMATES priced from the turns up to the handoff call (cost_src=estimate); rows with a reported cost elsewhere are unchanged.')
    P('- Blind 1 transcripts have no recorded navigations (no navigated_urls) and no api_access: the policy there is evaluated over typed navigations and page-code requests only, so it is looser than for blind 2.')
    P('- The `+policy` column also re-evaluates evidence with the current rules (recorded navigations when present), which flips b3 r7 reps 2 and 3 (formula pages opened in a loop) back to success; that correction is a measurement fix, but the column as a whole is still NOT evidence.')
    P('- Peak context was missing for all of blind 1 and is computed from the transcripts; dynamic context = peak minus the first-turn prompt.')
    print('\n'.join(out))
    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
