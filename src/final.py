"""Final report from an explicit manifest (no path globs).

Usage: python3 src/final.py manifest-final.json [--iters 2000] [--seed 7] [--report blind2]
(manifest key "report": "blind2" selects the blind set 2 report: group c1..c20, primary/secondary comparisons from the manifest)

Primary metrics: real cost_usd, and COMPLIANT success (success AND clean). cost_weighted is a
token-weighted PROXY and is reported as secondary. Rows with status=quota_abort (provider limit, not a
task failure) are never counted; a completeness check reports expected vs present task x variant x rep cells.
"""
import json, math, os, random, re, statistics as st, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_TIMEOUT_S = 420  # run.ts default --timeout
BENCH = os.path.dirname(HERE)

def load_quota_re():
    q = json.load(open(os.path.join(HERE, 'quota-patterns.json')))
    return re.compile('|'.join('(?:%s)' % p for p in q['patterns']), re.I if 'i' in q.get('flags', '') else 0)
QUOTA_RE = load_quota_re()

def status_of(r):
    """status recorded by run.ts; derived with the same patterns for rows that predate it."""
    if r.get('status'):
        return r['status']
    if r.get('success'):
        return 'ok'
    text = ' '.join(str(r.get(k) or '') for k in ('failure_note', 'error'))
    if QUOTA_RE.search(text):
        return 'quota_abort'
    return 'timeout' if r.get('timed_out') else 'fail'

def cell(r):
    return (r['task'], r['variant'], r['rep'])

def truth_unavailable(r):
    """The checker could not compute the truth for this run (its source was unreachable): the run cannot be judged either way."""
    note = ' '.join(str(r.get(k) or '') for k in ('failure_note', 'note'))
    return 'truth unavailable' in str(r.get('truth') or '') or 'could not compute truth' in note

def peak_context(path):
    """Peak context of a Claude run, from its stream-json transcript: the largest prompt (input + cache read + cache
    creation tokens) any assistant turn was sent with. None when the file is absent or has no usage (Codex transcripts)."""
    if not os.path.exists(path):
        return None
    peak = 0
    for line in open(path, errors='replace'):
        if not line.startswith('{'):
            continue
        try:
            e = json.loads(line)
        except ValueError:
            continue
        if e.get('type') != 'assistant':
            continue
        u = (e.get('message') or {}).get('usage') or {}
        peak = max(peak, (u.get('input_tokens') or 0) + (u.get('cache_read_input_tokens') or 0) + (u.get('cache_creation_input_tokens') or 0))
    return peak or None

def context_profile(path, upto=None):
    """(first, peak) prompt size of a Claude run: input + cache read + cache creation of the first assistant turn with usage, and of the largest turn.
    The first turn (system prompt, tool definitions, task) is a fixed cost of the tool; peak - first is the DYNAMIC context the run accumulated.
    None when the transcript is absent or has no usage (Codex)."""
    if not os.path.exists(path):
        return None
    first = None; peak = 0
    for n, line in enumerate(open(path, errors='replace')):
        if upto is not None and n > upto:
            break
        if not line.startswith('{'):
            continue
        try:
            e = json.loads(line)
        except ValueError:
            continue
        if e.get('type') != 'assistant':
            continue
        u = (e.get('message') or {}).get('usage')
        if not u:
            continue
        c = (u.get('input_tokens') or 0) + (u.get('cache_read_input_tokens') or 0) + (u.get('cache_creation_input_tokens') or 0)
        if first is None:
            first = c
        peak = max(peak, c)
    return (first, peak) if first is not None else None

def first_turn_usage(path):
    """First assistant API call of a Claude transcript and the number of distinct API calls (message ids).
    -> {raw_input, cache_creation, cache_read, first_ctx, turns} or None (no transcript or no usage). Per message id the largest count seen is used (input-side counts are exact in every event)."""
    if not os.path.exists(path):
        return None
    order, by_id, anon = [], {}, 0
    for line in open(path, errors='replace'):
        if not line.startswith('{'):
            continue
        try:
            e = json.loads(line)
        except ValueError:
            continue
        if e.get('type') != 'assistant':
            continue
        msg = e.get('message') or {}
        u = msg.get('usage')
        if not u:
            continue
        mid = msg.get('id')
        if mid is None:
            mid = 'anon%d' % anon; anon += 1
        if mid not in by_id:
            order.append(mid); by_id[mid] = {'raw_input': 0, 'cache_creation': 0, 'cache_read': 0}
        cur = by_id[mid]
        for k, src in (('raw_input', 'input_tokens'), ('cache_creation', 'cache_creation_input_tokens'), ('cache_read', 'cache_read_input_tokens')):
            cur[k] = max(cur[k], u.get(src) or 0)
    if not order:
        return None
    f = dict(by_id[order[0]])
    f['first_ctx'] = f['raw_input'] + f['cache_creation'] + f['cache_read']
    f['turns'] = len(order)
    return f

def result_duration_s(path):
    """duration_ms of the stream-json result event (Claude Code's own wall clock for the run), in seconds; None if absent."""
    if not os.path.exists(path):
        return None
    d = None
    for line in open(path, errors='replace'):
        if line.startswith('{') and '"result"' in line:
            try:
                e = json.loads(line)
            except ValueError:
                continue
            if e.get('type') == 'result' and e.get('duration_ms') is not None:
                d = e['duration_ms'] / 1000.0
    return d

PRICE = json.load(open(os.path.join(HERE, 'price-fit.json')))

def partial_usage(path):
    """Python twin of src/usage.ts partialUsage(): usage of a Claude run from its assistant events (a floor when the run was cut). None if no usage."""
    if not os.path.exists(path):
        return None
    by_id, blocks, chars, anon = {}, set(), 0, 0
    for line in open(path, errors='replace'):
        if not line.startswith('{'):
            continue
        try:
            e = json.loads(line)
        except ValueError:
            continue
        if e.get('type') != 'assistant':
            continue
        msg = e.get('message') or {}
        u = msg.get('usage')
        if not u:
            continue
        mid = msg.get('id')
        if mid is None:
            mid = 'anon%d' % anon; anon += 1
        cur = by_id.setdefault(mid, {'raw_input': 0, 'cache_creation': 0, 'cache_read': 0, 'output_tokens': 0})
        for k, src in (('raw_input', 'input_tokens'), ('cache_creation', 'cache_creation_input_tokens'), ('cache_read', 'cache_read_input_tokens'), ('output_tokens', 'output_tokens')):
            cur[k] = max(cur[k], u.get(src) or 0)
        for c in msg.get('content') or []:
            key = '%s|%s' % (mid, c.get('id') or (str(c.get('type')) + str(len(str(c.get('text') or '')))))
            if key in blocks:
                continue
            blocks.add(key)
            if c.get('type') == 'text':
                chars += len(str(c.get('text') or ''))
            elif c.get('type') == 'tool_use':
                chars += len(json.dumps(c.get('input') or {}, separators=(',', ':'), ensure_ascii=False)) + len(str(c.get('name') or ''))
    if not by_id:
        return None
    t = {k: sum(c[k] for c in by_id.values()) for k in ('raw_input', 'cache_creation', 'cache_read', 'output_tokens')}
    t['turns'] = len(by_id)
    cal = PRICE['output_calibration']
    t['output_tokens'] = max(t['output_tokens'], int(round(cal['chars_per_token_inv'] * chars + cal['per_turn'] * t['turns'])))
    return t

def estimate_cost(u):
    r = PRICE['rates']
    return sum(u[k] * r[k] for k in ('raw_input', 'cache_creation', 'cache_read', 'output_tokens')) / 1e6

def cost_coverage(rows, variants):
    """Per variant: rows with a reported cost, with an ESTIMATED cost (run cut before its result event), with none. Never dropped silently."""
    out = []
    for v in variants:
        R = [r for r in rows if r['variant'] == v]
        out.append((v, len(R), sum(r.get('_cost_src') == 'reported' for r in R), sum(r.get('_cost_src') == 'estimate' for r in R), sum(r.get('_cost_src') not in ('reported', 'estimate') for r in R)))
    return out

def cost_source(r):
    """reported | estimate | none, for a row (rows recorded before cost_src existed: reported if they have cost_usd)."""
    if r.get('cost_src'):
        return r['cost_src']
    return 'reported' if r.get('cost_usd') is not None else 'none'

class ManifestError(Exception):
    pass

def load_manifest(path):
    m = json.load(open(path))
    if not m.get('dirs'):
        raise ManifestError('manifest has no dirs')
    for d in m['dirs']:
        if 'dir' not in d:
            raise ManifestError('dir entry without "dir"')
        for k in ('exclude_tasks',):
            for t, reason in (d.get(k) or {}).items():
                if not reason:
                    raise ManifestError('%s: exclusion of %s needs a reason' % (d['dir'], t))
        for rp in d.get('replaces') or []:
            if not rp.get('reason') or not rp.get('dir') or not rp.get('tasks'):
                raise ManifestError('%s: replaces needs dir, tasks and reason' % d['dir'])
    return m

def collect(manifest, base=BENCH):
    """-> (rows, report). Rows carry _dir. Raises on an undeclared duplicate cell."""
    dirs = manifest['dirs']
    replaced = {}  # (dir, task) -> by which dir
    for d in dirs:
        for rp in d.get('replaces') or []:
            for t in rp['tasks']:
                replaced[(rp['dir'], t)] = d['dir']
    overlay = {}
    for o in manifest.get('overlays') or []:
        overlay.update(json.load(open(os.path.join(base, o))))
    rows, per_dir, seen = [], [], {}
    for d in dirs:
        rdir = os.path.join(base, d['dir'])
        meta = json.load(open(os.path.join(rdir, 'meta.json')))
        # runs_file: rows to use instead of <dir>/runs.jsonl (a POST HOC file written by src/handoff-posthoc.ts or src/posthoc.ts, path relative to the bench dir);
        # transcripts always come from the result dir itself
        raw = [json.loads(l) for l in open(os.path.join(base, d['runs_file']) if d.get('runs_file') else os.path.join(rdir, 'runs.jsonl')) if l.strip()]
        inc, exc = d.get('include_tasks'), dict(d.get('exclude_tasks') or {})
        # a task whose truth could not be computed for most of its runs is excluded for ALL variants (manifest: auto_exclude_truth=false turns it off,
        # truth_unavailable_threshold sets "most", default 0.5 = strictly more than half); below the threshold it is only a warning
        auto = manifest.get('auto_exclude_truth', True); thr = manifest.get('truth_unavailable_threshold', 0.5); warn = []
        by_task = {}
        for r in raw:
            by_task.setdefault(r['task'], []).append(truth_unavailable(r))
        for t, flags in sorted(by_task.items()):
            k = sum(flags)
            if not k or t in exc or (inc is not None and t not in inc):
                continue
            if auto and k / len(flags) > thr:
                exc[t] = 'auto: truth could not be computed in %d of %d runs (checker source unreachable); excluded for all variants' % (k, len(flags))
            else:
                warn.append('%s: truth could not be computed in %d of %d runs (%s the exclusion threshold); those rows count as failures in the official scoring' % (t, k, len(flags), 'not above' if auto else 'exclusion off, ignoring'))
        def keep(t):
            return (inc is None or t in inc) and t not in exc and (d['dir'], t) not in replaced
        tasks = [t for t in meta['tasks'] if keep(t)]
        expected = {(t, v, k) for t in tasks for v in meta['variants'] for k in range(1, meta['n'] + 1)}
        kept, quota = [], 0
        for r in raw:
            if not keep(r['task']):
                continue
            r = dict(r); r['_dir'] = d['dir']; r['_status'] = status_of(r)
            r['_timeout_s'] = r.get('timeout_s') or meta.get('timeout_s')  # None = not recorded (older runs): the report then assumes DEFAULT_TIMEOUT_S and says so
            tpath = os.path.join(rdir, 'transcripts', '%s-%s-%s.jsonl' % (r['task'], r['variant'].replace(':', '_'), r['rep']))
            if r.get('peak_ctx') is None:  # runs recorded after the act experiment carry it; older ones (all of blind 1) are measured from the transcript
                r['peak_ctx'] = peak_context(tpath)
            if r.get('first_ctx') is None:
                prof = context_profile(tpath)
                if prof:
                    r['first_ctx'] = prof[0]
            r['dyn_ctx'] = (r['peak_ctx'] - r['first_ctx']) if r.get('peak_ctx') is not None and r.get('first_ctx') is not None else None
            r['_handoff'] = bool(r.get('handoff')) or r['_status'] == 'handoff'
            r['wall_cc'] = result_duration_s(tpath)  # Claude Code's own duration_ms of the run (None when the transcript has no result event)
            # static / dynamic split of cost (a MODEL built on measured numbers). static = what the first assistant turn really cost (its own input, cache-write and cache-read
            # tokens at the fitted rates) plus a re-read of that first-turn prefix at the cache-read rate on every later API turn; dynamic = cost_usd minus static.
            # API turns are counted by distinct message id (one API call can span several stream events). Needs a transcript with usage and a reported cost_usd.
            ft = first_turn_usage(tpath)
            if ft and r.get('cost_usd') is not None:
                rt = PRICE['rates']
                r['first_turn_cost'] = (ft['raw_input'] * rt['raw_input'] + ft['cache_creation'] * rt['cache_creation'] + ft['cache_read'] * rt['cache_read']) / 1e6
                r['static_cost'] = r['first_turn_cost'] + ft['first_ctx'] * rt['cache_read'] * (ft['turns'] - 1) / 1e6
                assert r['static_cost'] <= r['cost_usd'] + 1e-9, 'static cost %.6f above total cost_usd %.6f in %s (model broken or cost_usd wrong)' % (r['static_cost'], r['cost_usd'], tpath)
                r['dyn_cost'] = r['cost_usd'] - r['static_cost']
                r['_ft'] = ft
            if r.get('cost_usd') is None and meta.get('runner') == 'claude':  # cut before a result event: price the usage seen so far, labelled as an estimate
                pu = partial_usage(os.path.join(rdir, 'transcripts', '%s-%s-%s.jsonl' % (r['task'], r['variant'].replace(':', '_'), r['rep'])))
                if pu:
                    r['cost_usd'] = round(estimate_cost(pu), 6); r['cost_src'] = 'estimate'; r['cost_partial'] = True; r['cost_backfilled'] = True
                    r['cost_weighted'] = r.get('cost_weighted') or round(pu['raw_input'] + pu['cache_creation'] + 0.1 * pu['cache_read'] + pu['output_tokens'])
            r['_cost_src'] = cost_source(r)
            ov = overlay.get('%s|%s|%s|%s' % (d['dir'], r['task'], r['variant'], r['rep']))
            if ov is not None and ov:  # evidence missing under the current rule: not a compliant success
                r['evidence_missing'] = ov; r['success'] = False; r['clean'] = False
            if r['_status'] == 'quota_abort':
                quota += 1
                continue
            if cell(r) in seen:
                raise ManifestError('duplicate cell %s in %s and %s: declare it with replaces/exclude_tasks' % (cell(r), seen[cell(r)], d['dir']))
            seen[cell(r)] = d['dir']
            kept.append(r)
        present = {cell(r) for r in kept}
        per_dir.append({'dir': d['dir'], 'expected': len(expected), 'present': len(present & expected), 'quota_abort': quota,
                        'missing': sorted(expected - present), 'unexpected': sorted(present - expected),
                        'truth_warnings': warn, 'excluded': {t: reason for t, reason in exc.items()}, 'replaced': {t: by for (dd, t), by in replaced.items() if dd == d['dir']}})
        rows += kept
    return rows, per_dir

# ---------------- statistics ----------------
def geo_of_task_medians(data, tasks, agg=st.median):
    lr = []
    for t in tasks:
        xa, xb = data[t]
        ma, mb = agg(xa), agg(xb)
        if ma > 0 and mb > 0:
            lr.append(math.log(ma / mb))
    return math.exp(sum(lr) / len(lr)) if lr else float('nan')

def pair_data(R, a, b, key, f):
    tasks = sorted({r['task'] for r in R if f(r['task'])})
    data = {t: ([x[key] for x in R if x['task'] == t and x['variant'] == a and x.get(key) is not None],
                [x[key] for x in R if x['task'] == t and x['variant'] == b and x.get(key) is not None]) for t in tasks}
    return {t: v for t, v in data.items() if v[0] and v[1]}

def pct(bs, iters):
    bs = sorted(x for x in bs if not math.isnan(x))
    if not bs:
        return float('nan'), float('nan')
    return bs[int(.025 * (len(bs) - 1))], bs[int(.975 * (len(bs) - 1))]

def bootstrap_ratio(R, a, b, key, f, mode, iters, rng, agg=st.median):
    """Geomean over tasks of median(a)/median(b). mode 'fixed': the suite is fixed, runs resampled within tasks.
    mode 'hier': tasks are resampled with replacement first, then runs within each drawn task."""
    data = pair_data(R, a, b, key, f)
    tasks = sorted(data)
    point = geo_of_task_medians(data, tasks, agg)
    bs = []
    for _ in range(iters):
        if mode == 'hier':
            drawn = [rng.choice(tasks) for _ in tasks]
        else:
            drawn = tasks
        s = {}
        for i, t in enumerate(drawn):
            xa, xb = data[t]
            s[(i, t)] = ([rng.choice(xa) for _ in xa], [rng.choice(xb) for _ in xb])
        lr = []
        for (xa, xb) in s.values():
            ma, mb = agg(xa), agg(xb)
            if ma > 0 and mb > 0:
                lr.append(math.log(ma / mb))
        bs.append(math.exp(sum(lr) / len(lr)) if lr else float('nan'))
    lo, hi = pct(bs, iters)
    return point, lo, hi, len(tasks)

def bootstrap_rate_diff(R, a, b, f, mode, iters, rng, field='clean'):
    """Difference in pooled success rate a - b (percentage points as a fraction)."""
    tasks = sorted({r['task'] for r in R if f(r['task'])})
    ga = {t: [1 if x.get(field) else 0 for x in R if x['task'] == t and x['variant'] == a] for t in tasks}
    gb = {t: [1 if x.get(field) else 0 for x in R if x['task'] == t and x['variant'] == b] for t in tasks}
    tasks = [t for t in tasks if ga[t] and gb[t]]
    if not tasks:
        return float('nan'), float('nan'), float('nan'), 0
    def rate(drawn, resample):
        sa = sb = na = nb = 0
        for t in drawn:
            xa = [rng.choice(ga[t]) for _ in ga[t]] if resample else ga[t]
            xb = [rng.choice(gb[t]) for _ in gb[t]] if resample else gb[t]
            sa += sum(xa); na += len(xa); sb += sum(xb); nb += len(xb)
        return sa / na - sb / nb
    point = rate(tasks, False)
    bs = [rate([rng.choice(tasks) for _ in tasks] if mode == 'hier' else tasks, True) for _ in range(iters)]
    lo, hi = pct(bs, iters)
    return point, lo, hi, len(tasks)

GROUPS = {'everyday (e)': lambda t: t.startswith('e'), 'held-out (h)': lambda t: t.startswith('h'),
          'fixtures (f)': lambda t: t.startswith('f'), 'blind (b1-b20)': lambda t: re.fullmatch(r'b\d+', t) is not None, 'blind2 (c1-c20)': lambda t: re.fullmatch(r'c\d+', t) is not None, 'blind3 (d1-d40)': lambda t: re.fullmatch(r'd\d+', t) is not None, 'blind4 (g1-g40)': lambda t: re.fullmatch(r'g\d+', t) is not None, 'ALL': lambda t: True}
METRICS = [('cost_usd', 'cost USD (primary)'), ('peak_ctx', 'peak context tokens'), ('steps', 'steps'), ('wall_s', 'wall s'), ('cost_weighted', 'cost-weighted tokens (PROXY)')]

def manifest_pair(manifest):
    """(ours list, reference) of a manifest. Accepts both spellings: 'ours' + 'reference', or 'primary': [ours, reference] (the key the blind2/r9 manifests use)."""
    prim = manifest.get('primary') or []
    ours = manifest.get('ours') or (prim[:1] if prim else [])
    ref = manifest.get('reference') or (prim[1] if len(prim) > 1 else 'browse-mcp')
    return ours, ref

def failure_reason(r):
    """Why a run is not a compliant success, in words."""
    if r.get('_handoff') or r.get('handoff'):
        return 'handoff to a human (%s)' % str(r.get('handoff_message') or r.get('failure_note') or '')[:90].replace('\n', ' ')
    if r.get('timed_out'):
        return 'timeout'
    if r.get('success') and not r.get('clean'):
        return 'answer ok but not clean (violations or missing evidence)'
    if r.get('evidence_missing'):
        return 'evidence missing'
    return 'answer does not match the reference' + ((' (' + str(r['failure_note'])[:90] + ')') if r.get('failure_note') else '')

def build_report(rows, per_dir, manifest, iters=2000, seed=7, gates=None, title='Final report'):
    rng = random.Random(seed)
    GR = {g: fn for g, fn in GROUPS.items() if any(fn(r['task']) for r in rows)}  # a group with no task in this manifest is not printed
    if len(GR) == 2 and 'ALL' in GR:  # ALL would repeat the only group
        del GR['ALL']
    ours, ref = manifest_pair(manifest); main = manifest.get('main')
    variants = sorted({r['variant'] for r in rows})
    out = []; P = out.append
    P('# %s' % title); P('')
    if gates:
        out += gates
    P('Primary: real cost_usd, peak context (largest prompt of any turn, from the transcript; Claude runs) and compliant success (success AND clean). cost_weighted is a token-weighted proxy and secondary. '
      'Provider-limit rows (status=quota_abort) are excluded and counted below. Bootstrap seed %s, %s resamples.' % (seed, iters)); P('')
    P('## Completeness (expected vs present task x variant x rep cells)'); P('')
    P('| result dir | expected | present | missing | quota_abort rows dropped | excluded tasks (reason) | replaced tasks (by) |'); P('|---|---|---|---|---|---|---|')
    for d in per_dir:
        P('| %s | %d | %d | %d | %d | %s | %s |' % (d['dir'], d['expected'], d['present'], len(d['missing']), d['quota_abort'],
            '; '.join('%s: %s' % kv for kv in d['excluded'].items()) or '-', '; '.join('%s -> %s' % kv for kv in d['replaced'].items()) or '-'))
    tot_e = sum(d['expected'] for d in per_dir); tot_p = sum(d['present'] for d in per_dir)
    P(''); P('Total: %d of %d expected cells present.' % (tot_p, tot_e))
    for d in per_dir:
        if d['missing']:
            P('- MISSING in %s: %s' % (d['dir'], ', '.join('%s/%s#%s' % c for c in d['missing'])))
        if d['unexpected']:
            P('- UNEXPECTED in %s: %s' % (d['dir'], ', '.join('%s/%s#%s' % c for c in d['unexpected'])))
        for w in d.get('truth_warnings') or []:
            P('- WARNING in %s: %s' % (d['dir'], w))
    P('')
    P('## Cost coverage (cost_usd source per row)'); P('')
    P('| variant | rows | reported | ESTIMATE (cut before result event, priced from partial usage, a floor) | none |'); P('|---|---|---|---|---|')
    for v, n, rep, est, none in cost_coverage(rows, variants):
        P('| %s | %d | %d | %d | %d |' % (v, n, rep, est, none))
    P('Estimated costs are included in every cost_usd statistic below and are labelled here; rows with none (e.g. Codex, which reports no USD) have no cost_usd and are absent from cost statistics, not counted as zero.'); P('')
    P('## Success per group: compliant (success AND clean) / raw success'); P('')
    P('| group | ' + ' | '.join(variants) + ' |'); P('|---|' + '---|' * len(variants))
    for g, f in GR.items():
        cells = []
        for v in variants:
            R = [r for r in rows if r['variant'] == v and f(r['task'])]
            cells.append('%d/%d (raw %d)' % (sum(bool(r.get('clean')) for r in R), len(R), sum(bool(r['success']) for r in R)))
        P('| %s | %s |' % (g, ' | '.join(cells)))
    P('')
    P('## Medians per group'); P('')
    P('| group | variant | cost USD | peak context | wall s | steps | cost-weighted (proxy) |'); P('|---|---|---|---|---|---|---|')
    for g, f in GR.items():
        for v in variants:
            R = [r for r in rows if r['variant'] == v and f(r['task'])]
            if R:
                usd = [r['cost_usd'] for r in R if r.get('cost_usd') is not None]
                pk = [r['peak_ctx'] for r in R if r.get('peak_ctx') is not None]
                P('| %s | %s | %s | %s | %.1f | %.0f | %.0f |' % (g, v, ('%.4f' % st.median(usd)) if usd else '-', ('%.0f' % st.median(pk)) if pk else '-', st.median([r['wall_s'] for r in R]),
                  st.median([r['steps'] for r in R]), st.median([r['cost_weighted'] for r in R if r.get('cost_weighted') is not None] or [float('nan')])))
    P('')
    def table(title, a, b, mode):
        P('### %s: %s / %s (below 1 = %s better), %s' % (title, a, b, a, 'FIXED suite, runs resampled within tasks' if mode == 'fixed' else 'HIERARCHICAL, tasks resampled then runs within tasks'))
        P(''); P('| group (tasks) | ' + ' | '.join(n for _, n in METRICS) + ' | compliant success a-b (pts) |'); P('|---|' + '---|' * (len(METRICS) + 1))
        res = {}
        for g, f in GR.items():
            cells = []; n = 0
            for k, _ in METRICS:
                pt, lo, hi, n = bootstrap_ratio(rows, a, b, k, f, mode, iters, rng); cells.append('%.2f [%.2f, %.2f]' % (pt, lo, hi)); res[(g, k)] = (pt, lo, hi)
            dp, dlo, dhi, _ = bootstrap_rate_diff(rows, a, b, f, mode, iters, rng)
            cells.append('%+.1f [%+.1f, %+.1f]' % (dp * 100, dlo * 100, dhi * 100))
            P('| %s (%d) | %s |' % (g, n, ' | '.join(cells)))
        P(''); return res
    P('## Pairwise comparisons (per-task median ratio, geomean over tasks, 95% bootstrap CI)'); P('')
    pairs = [(o, ref) for o in ours if o in variants and ref in variants] + ([(o, main) for o in ours if o in variants and main in variants] if main else [])
    for a, b in pairs:
        for mode in ('fixed', 'hier'):
            table('%s vs %s' % (a, b), a, b, mode)
    P('## Per-task medians (cost USD / steps / wall s) and compliant success'); P('')
    tasks = sorted({r['task'] for r in rows}, key=task_key); P('| task | ' + ' | '.join(variants) + ' |'); P('|---|' + '---|' * len(variants))
    for t in tasks:
        cells = []
        for v in variants:
            R = [r for r in rows if r['task'] == t and r['variant'] == v]
            usd = [r['cost_usd'] for r in R if r.get('cost_usd') is not None]
            cells.append(('%s / %.0f / %.1f (%d/%d)' % (('%.3f' % st.median(usd)) if usd else '-', st.median([r['steps'] for r in R]), st.median([r['wall_s'] for r in R]), sum(bool(r.get('clean')) for r in R), len(R))) if R else '-')
        P('| %s | %s |' % (t, ' | '.join(cells)))
    P(''); P('## Non-compliant runs'); P('')
    for r in sorted(rows, key=lambda r: (task_key(r['task']), r['variant'], r['rep'])):
        if not r.get('clean'):
            P("- %s %s #%s: %s. answer=%r truth=%r %s%s" % (r['task'], r['variant'], r['rep'], failure_reason(r), str(r.get('answer'))[:70], str(r.get('truth'))[:50],
              ('violations=%s ' % r['violations'] if r.get('violations') else ''), ('evidence_missing=%s' % r['evidence_missing'] if r.get('evidence_missing') else '')))
    P(''); out += extended_sections(rows, variants, pairs, iters, rng)
    return '\n'.join(out)


# ---------------- extended measures (handoff, cost per compliant success, dynamic context, >=2/3 sensitivity, workflow) ----------------
def bootstrap_cps_ratio(R, a, b, f, mode, iters, rng, field='clean'):
    """Cost per compliant success, a / b: (sum cost_usd / number of compliant runs) of a over the same of b, pooled over tasks.
    Only runs with a cost count (in numerator and denominator). Hierarchical: tasks resampled, then runs within each drawn task. nan when a side has no compliant run."""
    tasks = sorted({r['task'] for r in R if f(r['task'])})
    da = {t: [(x['cost_usd'], 1 if x.get(field) else 0) for x in R if x['task'] == t and x['variant'] == a and x.get('cost_usd') is not None] for t in tasks}
    db = {t: [(x['cost_usd'], 1 if x.get(field) else 0) for x in R if x['task'] == t and x['variant'] == b and x.get('cost_usd') is not None] for t in tasks}
    tasks = [t for t in tasks if da[t] and db[t]]
    if not tasks:
        return float('nan'), float('nan'), float('nan'), 0
    def ratio(drawn, resample):
        ca = ka = cb = kb = 0
        for t in drawn:
            xa = [rng.choice(da[t]) for _ in da[t]] if resample else da[t]
            xb = [rng.choice(db[t]) for _ in db[t]] if resample else db[t]
            ca += sum(c for c, _ in xa); ka += sum(k for _, k in xa); cb += sum(c for c, _ in xb); kb += sum(k for _, k in xb)
        return (ca / ka) / (cb / kb) if ka and kb and cb > 0 else float('nan')
    point = ratio(tasks, False)
    bs = [ratio([rng.choice(tasks) for _ in tasks] if mode == 'hier' else tasks, True) for _ in range(iters)]
    lo, hi = pct(bs, iters)
    return point, lo, hi, len(tasks)

def cost_per_compliant(V, field='clean'):
    """(total cost_usd over runs with a cost, compliant runs among them, runs without a cost). Cost per compliant success = first / second."""
    W = [r for r in V if r.get('cost_usd') is not None]
    return sum(r['cost_usd'] for r in W), sum(bool(r.get(field)) for r in W), len(V) - len(W)

def reach_two_thirds(R, a, b):
    """Tasks where BOTH variants have a compliant success in at least 2/3 of their runs (2 of 3 at N=3)."""
    out = []
    for t in sorted({r['task'] for r in R}, key=task_key):
        A = [r for r in R if r['task'] == t and r['variant'] == a]; B = [r for r in R if r['task'] == t and r['variant'] == b]
        if A and B and 3 * sum(bool(r.get('clean')) for r in A) >= 2 * len(A) and 3 * sum(bool(r.get('clean')) for r in B) >= 2 * len(B):
            out.append(t)
    return out

def extended_sections(R, variants, pairs, iters, rng, label=''):
    """Appended to every report: handoff / completion next to active latency, cost per compliant success, dynamic context, the >=2/3 sensitivity, workflow."""
    out = []; P = out.append
    pairs = [(a, b) for a, b in pairs if a in variants and b in variants]
    ratio_row = lambda k, a, b, f: bootstrap_ratio(R, a, b, k, f, 'hier', iters, rng)
    allf = lambda t: True
    P('## Handoff, timeouts and completion'); P('')
    P('A human handoff (guard/handoff-policy.md) ends the run; when a result predates the rule it is applied post hoc to the stored transcripts and the row says so (handoff=true). '
      'Charged wall = time until the handoff call started. completion rate = runs that ended by themselves (status ok or fail) over all runs; timeouts are unresolved active execution only. '
      'Active latency = wall of runs that ended by themselves.'); P('')
    P('| variant | runs | handoff (rate) | timeout (rate) | completion rate | median charged wall s (all runs) | median active latency s (completed runs) | median raw wall s (before the handoff charge) |'); P('|---|---|---|---|---|---|---|---|')
    for v in variants:
        V = [r for r in R if r['variant'] == v]
        if not V:
            continue
        h = sum(bool(r.get('_handoff') or r.get('handoff')) for r in V); to = sum(bool(r.get('timed_out')) for r in V); done = [r for r in V if (r.get('_status') or status_of(r)) in ('ok', 'fail') and not r.get('_handoff') and not r.get('timed_out')]
        P('| %s | %d | %d (%.1f%%) | %d (%.1f%%) | %.1f%% | %.1f | %s | %.1f |' % (v, len(V), h, 100.0 * h / len(V), to, 100.0 * to / len(V), 100.0 * len(done) / len(V), st.median([float(r['wall_s']) for r in V]),
            ('%.1f' % st.median([float(r['wall_s']) for r in done])) if done else '-', st.median([float(r.get('wall_raw_s') or r['wall_s']) for r in V])))
    hrows = [r for r in R if r.get('_handoff') or r.get('handoff')]
    if hrows:
        P(''); P('Handoff runs (charged wall s / raw wall s): ' + '; '.join('%s %s #%s %.1f/%.1f' % (r['task'], r['variant'], r['rep'], float(r['wall_s']), float(r.get('wall_raw_s') or r['wall_s'])) for r in sorted(hrows, key=lambda r: (task_key(r['task']), r['variant'], r['rep']))))
    P('')
    P('## Cost per compliant success'); P('')
    P('Total cost_usd of the runs that have one, divided by their compliant successes (success AND clean). Failed and handed-off runs still cost money and are in the numerator.'); P('')
    P('| variant | total cost USD | compliant successes | cost per compliant success | runs without a cost (excluded here) |'); P('|---|---|---|---|---|')
    for v in variants:
        V = [r for r in R if r['variant'] == v]
        if V:
            c, k, nc = cost_per_compliant(V); P('| %s | %.4f | %d | %s | %d |' % (v, c, k, ('%.4f' % (c / k)) if k else 'n/a', nc))
    P('')
    for a, b in pairs:
        pt, lo, hi, n = bootstrap_cps_ratio(R, a, b, allf, 'hier', iters, rng)
        P('- %s / %s: cost per compliant success ratio %s over %d tasks (pooled, hierarchical bootstrap; below 1 = %s cheaper per compliant success)' % (a, b, fmt_ci(pt, lo, hi) if n else 'n/a', n, a))
    P('')
    P('## Static / dynamic split of cost and context'); P('')
    P('The static part is the first-turn prompt (tool definitions, system prompt, task): it comes from the size of each tool\'s interface, not from how well the tool is used, and it is re-read on every turn. '
      'The dynamic part is what the run itself added. Static cost is a MODEL built on measured numbers, not a measurement: the own input of the first assistant turn (input, cache-write and cache-read tokens) priced at the fitted rates, plus that first-turn prefix re-read at the cache-read rate on each later API turn (turns counted by distinct message id); dynamic cost = cost_usd minus static. Publish both whatever the outcome.'); P('')
    P('| variant | median static context | median dynamic context | median static cost USD (model) | median dynamic cost USD (model) |'); P('|---|---|---|---|---|')
    for v in variants:
        V = [r for r in R if r['variant'] == v and r.get('static_cost') is not None and r.get('dyn_ctx') is not None]
        if V:
            P('| %s | %.0f | %.0f | %.5f | %.5f |' % (v, st.median([r['first_ctx'] for r in V]), st.median([r['dyn_ctx'] for r in V]), st.median([r['static_cost'] for r in V]), st.median([r['dyn_cost'] for r in V])))
    P('')
    for a, b in pairs:
        for k, nm in (('static_cost', 'static cost'), ('dyn_cost', 'dynamic cost'), ('first_ctx', 'static context (first turn)')):
            pt, lo, hi, n = ratio_row(k, a, b, allf)
            P('- %s / %s: %s ratio %s over %d tasks' % (a, b, nm, fmt_ci(pt, lo, hi) if n else 'n/a', n))
    P('')
    P('## Context: peak and dynamic peak'); P('')
    P('Dynamic peak = peak prompt size minus the run\'s first-turn prompt size (the tool definitions, system prompt and task are a fixed cost that differs per tool; dynamic is what the run itself accumulated). '
      'Peak is taken from the stored peak_ctx or, where it is missing (all of blind 1), computed from the transcript. Claude runs only.'); P('')
    P('| variant | runs with usage | median first-turn | median peak | median dynamic peak |'); P('|---|---|---|---|---|')
    for v in variants:
        V = [r for r in R if r['variant'] == v and r.get('dyn_ctx') is not None]
        if V:
            P('| %s | %d | %.0f | %.0f | %.0f |' % (v, len(V), st.median([r['first_ctx'] for r in V]), st.median([r['peak_ctx'] for r in V]), st.median([r['dyn_ctx'] for r in V])))
    P('')
    for a, b in pairs:
        for k, nm in (('peak_ctx', 'peak context'), ('dyn_ctx', 'dynamic peak context')):
            pt, lo, hi, n = ratio_row(k, a, b, allf)
            P('- %s / %s: %s ratio %s over %d tasks' % (a, b, nm, fmt_ci(pt, lo, hi) if n else 'n/a', n))
    P('')
    for a, b in pairs:
        keep = reach_two_thirds(R, a, b)
        P('## Sensitivity: only tasks where both reach >= 2/3 compliant success: %s / %s' % (a, b)); P('')
        P('%d tasks: %s. Same estimators as above restricted to these tasks (the comparison no longer rewards or punishes a tool for tasks the other cannot do).' % (len(keep), ', '.join(keep) or 'none')); P('')
        if keep:
            fk = lambda t, ks=set(keep): t in ks
            dp, dlo, dhi, nt = bootstrap_rate_diff(R, a, b, fk, 'hier', iters, rng)
            P('| metric | ratio %s / %s [95%% CI] | tasks |' % (a, b)); P('|---|---|---|')
            for k, nm in (('wall_s', 'wall s (charged)'), ('cost_usd', 'cost USD'), ('peak_ctx', 'peak context'), ('dyn_ctx', 'dynamic peak context'), ('steps', 'steps (descriptive)')):
                pt, lo, hi, n = ratio_row(k, a, b, fk); P('| %s | %s | %d |' % (nm, fmt_ci(pt, lo, hi) if n else 'n/a', n))
            pt, lo, hi, n = bootstrap_cps_ratio(R, a, b, fk, 'hier', iters, rng); P('| cost per compliant success | %s | %d |' % (fmt_ci(pt, lo, hi) if n else 'n/a', n))
            P(''); P('Compliant success difference on these tasks: %+.1f pts [%+.1f, %+.1f].' % (dp * 100, dlo * 100, dhi * 100)); P('')
    if any(r.get('workflow_ok') is not None for r in R):
        P('## Workflow compliance (scored apart from answer correctness)'); P('')
        P('Only tasks with a workflow rubric (guard/endpoint-policy.md). Descriptive only: the rubric check for form interaction (INTERACT in blind3/tasks.ts) matches almost any tool input, so it cannot fail a run that interacted with nothing. '
          'A "strict compliant success" built on it was withdrawn (guard/prereg-r9.md, POST HOC deviation 6) and is not reported.'); P('')
        P('| variant | runs with a rubric | workflow ok | compliant success (all runs) |'); P('|---|---|---|---|')
        for v in variants:
            V = [r for r in R if r['variant'] == v]; W = [r for r in V if r.get('workflow_ok') is not None]
            if V:
                P('| %s | %d | %d | %d/%d |' % (v, len(W), sum(bool(r['workflow_ok']) for r in W), sum(bool(r.get('clean')) for r in V), len(V)))
        P('')
        Rw = [r for r in R if r.get('workflow_ok') is not None]
        for a, b in pairs:
            dp, dlo, dhi, nt = bootstrap_rate_diff(Rw, a, b, allf, 'hier', iters, rng, field='workflow_ok')
            P('- %s - %s workflow compliance difference %+.1f pts [%+.1f, %+.1f] over %d tasks' % (a, b, dp * 100, dlo * 100, dhi * 100, nt))
        P('')
    return out

# ---------------- blind2 report (tasks c1..c20) ----------------
def is_blind2(t):
    return re.fullmatch(r'c\d+', t) is not None

def task_key(t):
    m = re.fullmatch(r'([a-z]+)(\d+)', t)
    return (m.group(1), int(m.group(2))) if m else (t, 0)

def timeout_of(r):
    return r.get('_timeout_s') or DEFAULT_TIMEOUT_S

def add_censored_time(rows):
    """wall_rmst = wall clipped at the run's timeout; a timed-out run is CENSORED at the timeout (it contributes exactly tau).
    wall_done = wall of runs that finished (None for timeouts), a conditional view that is biased in favour of whoever times out more."""
    for r in rows:
        tau = float(timeout_of(r))
        r['wall_rmst'] = tau if r.get('timed_out') else min(float(r['wall_s']), tau)
        r['wall_done'] = None if r.get('timed_out') else float(r['wall_s'])

def loo_range(R, a, b, key, f, agg=st.median):
    """Leave-one-task-out: the geomean ratio recomputed without each task. -> (all-tasks point, [(task, value)] sorted by value)."""
    data = pair_data(R, a, b, key, f)
    tasks = sorted(data, key=task_key)
    full = geo_of_task_medians(data, tasks, agg)
    out = [(t, geo_of_task_medians(data, [u for u in tasks if u != t], agg)) for t in tasks if len(tasks) > 1]
    return full, sorted(out, key=lambda kv: kv[1])

def fmt_ci(pt, lo, hi, nd=2):
    return ('%%.%df [%%.%df, %%.%df]' % (nd, nd, nd)) % (pt, lo, hi)

def build_blind2_report(rows, per_dir, manifest, iters=2000, seed=7):
    rng = random.Random(seed)
    primary = manifest.get('primary') or ['ab-cli:r8', 'browse-mcp']
    secondary = manifest.get('secondary') or ['ab-cli:r8', 'ab-cli:r7']
    R = [r for r in rows if is_blind2(r['task'])]
    add_censored_time(R)
    f = is_blind2
    variants = sorted({r['variant'] for r in R})
    tasks = sorted({r['task'] for r in R}, key=task_key)
    out = []; P = out.append
    P('# Blind set 2 (c1..c20, group blind2)'); P('')
    P('Primary comparison: %s vs %s. Secondary: %s vs %s. Every ratio is a/b, below 1 = %s is better (lower wall, cost, context). '
      'Per-task median ratio, geometric mean over tasks, 95%% HIERARCHICAL bootstrap (tasks resampled, then runs within tasks), %d resamples, seed %d. '
      'Steps are descriptive only. No threshold verdicts here: the thresholds belong to the preregistration, which this report does not replace.'
      % (primary[0], primary[1], secondary[0], secondary[1], 'the first', iters, seed)); P('')
    P('## Completeness'); P('')
    P('| result dir | expected | present | missing | quota_abort rows dropped | excluded tasks (reason) |'); P('|---|---|---|---|---|---|')
    for d in per_dir:
        P('| %s | %d | %d | %d | %d | %s |' % (d['dir'], d['expected'], d['present'], len(d['missing']), d['quota_abort'], '; '.join('%s: %s' % kv for kv in d['excluded'].items()) or '-'))
    for d in per_dir:
        if d['missing']:
            P('- MISSING in %s: %s' % (d['dir'], ', '.join('%s/%s#%s' % c for c in d['missing'])))
        for w in d.get('truth_warnings') or []:
            P('- WARNING in %s: %s' % (d['dir'], w))
    P('')
    absent = [v for v in set(primary + secondary) if v not in variants]
    if absent:
        P('**WARNING: variants without rows in the blind2 tasks: %s.** Comparisons involving them are empty.' % ', '.join(absent)); P('')
    nonb2 = sorted({r['task'] for r in rows if not is_blind2(r['task'])})
    if nonb2:
        P('Rows of other tasks in the manifest are ignored here: %s.' % ', '.join(nonb2)); P('')

    # --- headline per variant
    P('## Per variant'); P('')
    P('| variant | runs | compliant success | raw success | timeouts (rate) | median wall s | median cost USD | median peak context | median steps (descriptive) |'); P('|---|---|---|---|---|---|---|---|---|')
    for v in variants:
        V = [r for r in R if r['variant'] == v]
        usd = [r['cost_usd'] for r in V if r.get('cost_usd') is not None]; pk = [r['peak_ctx'] for r in V if r.get('peak_ctx') is not None]
        to = sum(bool(r.get('timed_out')) for r in V)
        P('| %s | %d | %d/%d | %d/%d | %d/%d (%.0f%%) | %.1f | %s | %s | %.0f |' % (v, len(V), sum(bool(r.get('clean')) for r in V), len(V), sum(bool(r['success']) for r in V), len(V), to, len(V), 100.0 * to / len(V) if V else 0,
            st.median([r['wall_s'] for r in V]), ('%.4f' % st.median(usd)) if usd else '-', ('%.0f' % st.median(pk)) if pk else '-', st.median([r['steps'] for r in V])))
    P('')
    taus = sorted({timeout_of(r) for r in R}); assumed = any(not (r.get('_timeout_s')) for r in R)
    P('Timeout per run: %s s%s.' % (', '.join('%g' % t for t in taus), ' (NOT recorded in some result dirs: the run.ts default %d s is assumed)' % DEFAULT_TIMEOUT_S if assumed else ' (recorded in meta.json)')); P('')

    # --- cost coverage, nothing dropped silently
    P('## Cost coverage'); P('')
    P('| variant | runs | cost reported | cost ESTIMATED (run cut before its result event; floor, priced from partial usage) | no cost at all |'); P('|---|---|---|---|---|')
    for v, n, rep, est, none in cost_coverage(R, variants):
        P('| %s | %d | %d | %d | %d |' % (v, n, rep, est, none))
    nocost = [r for r in R if r.get('_cost_src') not in ('reported', 'estimate')]
    P('')
    P('cost_usd statistics below include the estimates. Rows with no cost at all are absent from the cost columns only (never counted as zero): %s.' % (', '.join('%s %s #%s' % (r['task'], r['variant'], r['rep']) for r in nocost) or 'none'))
    P('Sensitivity, cost from reported rows only (ESTIMATED rows removed):'); P('')
    Rrep = [r for r in R if r.get('_cost_src') == 'reported']
    for (a, b) in (primary, secondary):
        pt, lo, hi, n = bootstrap_ratio(Rrep, a, b, 'cost_usd', f, 'hier', iters, rng)
        pt2, lo2, hi2, n2 = bootstrap_ratio(R, a, b, 'cost_usd', f, 'hier', iters, rng)
        P('- %s / %s: reported only %s (%d tasks); with estimates %s (%d tasks)' % (a, b, fmt_ci(pt, lo, hi), n, fmt_ci(pt2, lo2, hi2), n2))
    P('')

    # --- comparisons
    METR = [('wall_s', 'wall s (median)'), ('cost_usd', 'cost USD'), ('peak_ctx', 'peak context (Claude runs)'), ('steps', 'steps (descriptive)')]
    def comparison(title, a, b):
        P('## %s: %s / %s' % (title, a, b)); P('')
        A = [r for r in R if r['variant'] == a]; Bv = [r for r in R if r['variant'] == b]
        if not A or not Bv:
            P('No rows for one side.'); P(''); return
        dp, dlo, dhi, nt = bootstrap_rate_diff(R, a, b, f, 'hier', iters, rng)
        P('Compliant success: %s %d/%d vs %s %d/%d; difference %+.1f pts [%+.1f, %+.1f] (pooled rate, hierarchical bootstrap, %d tasks).' % (a, sum(bool(r.get('clean')) for r in A), len(A), b, sum(bool(r.get('clean')) for r in Bv), len(Bv), dp * 100, dlo * 100, dhi * 100, nt))
        P(''); P('| metric | ratio a/b [95% CI] | tasks | leave-one-task-out range (min .. max) | tasks driving min / max |'); P('|---|---|---|---|---|')
        for k, name in METR:
            pt, lo, hi, n = bootstrap_ratio(R, a, b, k, f, 'hier', iters, rng)
            if k in ('wall_s', 'cost_usd'):
                full, loo = loo_range(R, a, b, k, f)
                rng_txt = '%.2f .. %.2f' % (loo[0][1], loo[-1][1]) if loo else '-'; drv = '%s / %s' % (loo[0][0], loo[-1][0]) if loo else '-'
            else:
                rng_txt = drv = '-'
            P('| %s | %s | %d | %s | %s |' % (name, fmt_ci(pt, lo, hi) if n else 'n/a', n, rng_txt, drv))
        P('')
        P('Timeouts and censored time:'); P('')
        P('| | %s | %s |' % (a, b)); P('|---|---|---|')
        ta = sum(bool(r.get('timed_out')) for r in A); tb = sum(bool(r.get('timed_out')) for r in Bv)
        P('| timeout rate | %d/%d (%.1f%%) | %d/%d (%.1f%%) |' % (ta, len(A), 100.0 * ta / len(A), tb, len(Bv), 100.0 * tb / len(Bv)))
        pt, lo, hi, n = bootstrap_ratio(R, a, b, 'wall_rmst', f, 'hier', iters, rng, agg=st.mean)
        full, loo = loo_range(R, a, b, 'wall_rmst', f, agg=st.mean)
        P(''); P('Restricted mean wall up to the timeout (timeouts censored, each contributes tau; per-task mean, geomean over tasks): ratio %s over %d tasks%s.' % (fmt_ci(pt, lo, hi) if n else 'n/a', n, ('; leave-one-task-out %.2f .. %.2f' % (loo[0][1], loo[-1][1])) if loo else ''))
        pt, lo, hi, n = bootstrap_ratio(R, a, b, 'wall_done', f, 'hier', iters, rng)
        P('Median wall among runs that FINISHED only (conditional; flatters whoever times out more, shown for completeness): ratio %s over %d tasks.' % (fmt_ci(pt, lo, hi) if n else 'n/a', n)); P('')
        P('Per task (median wall s / median cost USD / compliant successes):'); P('')
        P('| task | %s | %s | wall ratio | cost ratio |' % (a, b)); P('|---|---|---|---|---|')
        def cellv(V):
            if not V: return '-'
            usd = [r['cost_usd'] for r in V if r.get('cost_usd') is not None]
            return '%.1f / %s / %d/%d%s' % (st.median([r['wall_s'] for r in V]), ('%.3f' % st.median(usd)) if usd else '-', sum(bool(r.get('clean')) for r in V), len(V), ' T%d' % sum(bool(r.get('timed_out')) for r in V) if any(r.get('timed_out') for r in V) else '')
        def ratio(k, t):
            xa = [r[k] for r in A if r['task'] == t and r.get(k) is not None]; xb = [r[k] for r in Bv if r['task'] == t and r.get(k) is not None]
            return ('%.2f' % (st.median(xa) / st.median(xb))) if xa and xb and st.median(xb) > 0 else '-'
        for t in tasks:
            P('| %s | %s | %s | %s | %s |' % (t, cellv([r for r in A if r['task'] == t]), cellv([r for r in Bv if r['task'] == t]), ratio('wall_s', t), ratio('cost_usd', t)))
        P('')
    comparison('Primary', *primary)
    comparison('Secondary', *secondary)

    # --- rule compliance, kept apart
    P('## Compliance, kept apart'); P('')
    P('Task-rule violations (they remove a run from compliant success): shell programs outside the tool, direct-URL rules over typed and over recorded navigations.'); P('')
    P('| variant | runs with a task-rule violation | runs with evidence missing | navigation recorder failed |'); P('|---|---|---|---|')
    for v in variants:
        V = [r for r in R if r['variant'] == v]
        P('| %s | %d | %d | %d |' % (v, sum(bool(r.get('violations')) for r in V), sum(bool(r.get('evidence_missing')) for r in V), sum(1 for r in V if r.get('nav_recorder') and not r['nav_recorder'].get('ok'))))
    P('')
    P('Semantic API use via the browser (navigated API URLs or API calls inside page scripts; same detector and inputs for every tool; descriptive, it does NOT change success or compliance):'); P('')
    P('| variant | runs with API-like use | of which navigated API URL | of which script API call | runs with an unjudged fetch() (non-literal or non-API URL) |'); P('|---|---|---|---|---|')
    for v in variants:
        V = [r for r in R if r['variant'] == v]
        def has(kind, r): return any(x.get('kind') == kind for x in (r.get('api_access') or []))
        P('| %s | %d | %d | %d | %d |' % (v, sum(any(x.get('kind') in ('navigated-api-url', 'script-api-call') for x in (r.get('api_access') or [])) for r in V), sum(has('navigated-api-url', r) for r in V), sum(has('script-api-call', r) for r in V), sum(has('script-fetch', r) for r in V)))
    P('')
    P('## Non-compliant runs'); P('')
    for r in sorted(R, key=lambda r: (task_key(r['task']), r['variant'], r['rep'])):
        if not r.get('clean'):
            why = 'TIMEOUT' if r.get('timed_out') else ('FAIL' if not r['success'] else 'unclean')
            P('- %s %s #%s [%s]: answer=%r truth=%r %s%s%s' % (r['task'], r['variant'], r['rep'], why, str(r.get('answer'))[:60], str(r.get('truth'))[:40],
              ('violations=%s ' % r['violations'] if r.get('violations') else ''), ('evidence_missing=%s ' % r['evidence_missing'] if r.get('evidence_missing') else ''), ('note=%s' % str(r.get('failure_note'))[:80] if r.get('failure_note') else '')))
    P(''); out += extended_sections(R, variants, [tuple(primary), tuple(secondary)], iters, rng)
    return '\n'.join(out)

def r9_gates(rows, a, b, iters=2000, seed=7, f=lambda t: re.fullmatch(r'd\d+', t) is not None, title=None):
    """Gate table of guard/prereg-r9.md over the blind3 tasks, a = ab-cli (r9), b = browse-mcp. Geometric mean of per-task medians, hierarchical bootstrap 95% CI."""
    rng = random.Random(seed); R = [r for r in rows if f(r['task'])]
    out = []; P = out.append
    P(title or ('## r9 gates (guard/prereg-r9.md): %s / %s, blind3 tasks' % (a, b))); P('')
    P('| gate | estimate [95% CI] | threshold | verdict |'); P('|---|---|---|---|')
    for k, nm, lim in (('cost_usd', 'cost (cost_usd)', 0.85), ('peak_ctx', 'peak context', 0.90)):
        pt, lo, hi, n = bootstrap_ratio(R, a, b, k, f, 'hier', iters, rng)
        ok = n and pt <= lim and hi < 1
        P('| %s ratio | %s (%d tasks) | point <= %.2f and upper bound < 1 | %s |' % (nm, fmt_ci(pt, lo, hi) if n else 'n/a', n, lim, 'PASS' if ok else 'FAIL'))
    dp, dlo, dhi, nt = bootstrap_rate_diff(R, a, b, f, 'hier', iters, rng)
    P('| compliant success difference (pts) | %+.1f [%+.1f, %+.1f] (%d tasks) | claim "at least equal" only if lower bound >= -5 | %s |' % (dp * 100, dlo * 100, dhi * 100, nt, 'CLAIM MADE' if nt and dlo * 100 >= -5 else 'CLAIM NOT MADE'))
    pt, lo, hi, n = bootstrap_ratio(R, a, b, 'wall_s', f, 'hier', iters, rng)
    P('| wall (charged), descriptive | %s (%d tasks) | claim "not slower" only if upper bound < 1.10 | %s |' % (fmt_ci(pt, lo, hi) if n else 'n/a', n, 'CLAIM MADE' if n and hi < 1.10 else 'CLAIM NOT MADE'))
    P(''); P('All other measures and sensitivities in this report are published whatever the outcome; the gates above do not select which are shown.'); P('')
    return out


def pooled_rate_diff(R, a, b, tasks, field='clean'):
    """Pooled success rate a - b over the given tasks (point estimate only)."""
    sa = na = sb = nb = 0
    for r in R:
        if r['task'] in tasks and r['variant'] == a:
            sa += bool(r.get(field)); na += 1
        elif r['task'] in tasks and r['variant'] == b:
            sb += bool(r.get(field)); nb += 1
    return sa / na - sb / nb if na and nb else float('nan')

def r9_loo(R, a, b, f, title=None):
    """Leave-one-task-out ranges of the gate statistics: each ratio (or the success difference) recomputed without each task in turn."""
    out = []; P = out.append
    ntask = len({r['task'] for r in R if f(r['task'])})
    P(title or '## Leave-one-task-out ranges (r9 / browse-mcp, blind3)'); P('')
    P('Each statistic recomputed %d times, dropping one task each time' % ntask + ' (point estimates, no resampling). The all-tasks value is the gate point estimate.'); P('')
    P('| statistic | all tasks | leave-one-out min | task dropped for min | leave-one-out max | task dropped for max |'); P('|---|---|---|---|---|---|')
    for k, nm in (('cost_usd', 'cost ratio'), ('peak_ctx', 'peak context ratio'), ('dyn_ctx', 'dynamic peak context ratio'), ('static_cost', 'static cost ratio (model)'), ('dyn_cost', 'dynamic cost ratio (model)'), ('wall_s', 'wall ratio (charged)'), ('wall_cc', 'wall ratio (duration_ms)')):
        full, loo = loo_range(R, a, b, k, f)
        if loo:
            P('| %s | %.3f | %.3f | %s | %.3f | %s |' % (nm, full, loo[0][1], loo[0][0], loo[-1][1], loo[-1][0]))
    tasks = sorted({r['task'] for r in R if f(r['task'])}, key=task_key)
    full = pooled_rate_diff(R, a, b, set(tasks)) * 100
    loo = sorted(((pooled_rate_diff(R, a, b, set(tasks) - {t}) * 100, t) for t in tasks))
    P('| compliant success difference (pts) | %+.1f | %+.1f | %s | %+.1f | %s |' % (full, loo[0][0], loo[0][1], loo[-1][0], loo[-1][1]))
    P('')
    return out

def r9_sensitivities(R, a, b, iters=2000, seed=7, f=lambda t: re.fullmatch(r'd\d+', t) is not None, title=None, posthoc=True):
    """Pre-registered and extra sensitivities of the r9 report. Every row is a hierarchical bootstrap with its own fresh rng (seed), so rows do not depend on each other's order."""
    R = [r for r in R if f(r['task'])]
    out = []; P = out.append
    allt = sorted({r['task'] for r in R}, key=task_key)
    def cp(t):
        return sum(bool(r.get('clean')) for r in R if r['task'] == t)
    failed_by_all = [t for t in allt if cp(t) == 0]
    both23 = reach_two_thirds(R, a, b)
    def row_for(label, RR, keep=lambda t: True, wall_key='wall_s', note=''):
        rng = random.Random(seed)  # same draw order as r9_gates (cost, peak, success, wall), so the first row reproduces the gate table exactly
        c1 = bootstrap_ratio(RR, a, b, 'cost_usd', keep, 'hier', iters, rng); c2 = bootstrap_ratio(RR, a, b, 'peak_ctx', keep, 'hier', iters, rng)
        dp, dlo, dhi, nt = bootstrap_rate_diff(RR, a, b, keep, 'hier', iters, rng); c3 = bootstrap_ratio(RR, a, b, wall_key, keep, 'hier', iters, rng)
        cells = [fmt_ci(c[0], c[1], c[2]) if c[3] else 'n/a' for c in (c1, c2, c3)]
        P('| %s | %d | %s | %+.1f [%+.1f, %+.1f] |' % (label, nt, ' | '.join(cells), dp * 100, dlo * 100, dhi * 100))
    P(title or '## Sensitivities (r9 / browse-mcp, blind3)'); P('')
    P('Hierarchical bootstrap 95%% CI, seed %d, %d resamples per row; ratios below 1 favour %s, success is %s minus %s in points. The first row is the gate analysis.' % ((seed, iters) + ((('r9', 'r9', 'browse') if posthoc else ('the first tool', 'the first tool', 'the second'))))); P('')
    P('| sensitivity | tasks | cost | peak context | wall | compliant success diff (pts) |'); P('|---|---|---|---|---|---|')
    row_for('all %d tasks (gate analysis)' % len(allt), R)
    row_for('tasks where both reach >= 2/3 compliant success (at N=2: both succeed 2 of 2): %d tasks' % len(both23), R, lambda t, ks=set(both23): t in ks)
    row_for('excluding tasks failed by every tool (%s)' % ', '.join(failed_by_all), R, lambda t, ks=set(failed_by_all): t not in ks)
    if posthoc:  # r9-specific post hoc exclusions (guard/prereg-r9.md); other suites carry none
        row_for('excluding d16 (reference answer wrong for the site UI, ungradable)', R, lambda t: t != 'd16')
        row_for('excluding d21 (browse blocked by Cloudflare, r9 passed)', R, lambda t: t != 'd21')
    for rp in sorted({r['rep'] for r in R}) if (posthoc or len({r['rep'] for r in R}) > 1) else []:
        row_for('repetition %s only' % rp, [r for r in R if r['rep'] == rp])
    ncc = sum(r.get('wall_cc') is None for r in R)
    row_for('wall from Claude Code duration_ms (%d runs without a result event are absent from the wall column)' % ncc, R, wall_key='wall_cc')
    P('')
    P('Cost, with the first turn priced differently for both tools (all other turns as reported). first-turn cost as measured = input x 2 + cache write x 4 + cache read x 0.1 (per million); each variant replaces only that term:'); P('')
    F = [r for r in R if r.get('_ft')]
    mc = st.median(r['_ft']['cache_creation'] for r in F) if F else 0
    def alt(fn):
        return [dict(r, cost_alt=r['cost_usd'] - r['first_turn_cost'] + fn(r) / 1e6) if r.get('_ft') else dict(r, cost_alt=None) for r in R]
    rt = PRICE['rates']
    P('| cost variant | tasks | cost ratio [95% CI] |'); P('|---|---|---|')
    variants = [
        ('as reported (gate analysis)', None),
        ('both first-turn cache writes priced alike: every run is charged the same write count (the median over all runs, %d tokens) at the write rate, the rest of its first turn at the read rate' % mc, lambda r: mc * rt['cache_creation'] + max(r['first_ctx'] - mc, 0) * rt['cache_read']),
        ('whole first turn read from cache (first_ctx x read rate)', lambda r: r['first_ctx'] * rt['cache_read']),
        ('cold cache: whole first turn written (first_ctx x write rate)', lambda r: r['first_ctx'] * rt['cache_creation']),
    ]
    for label, fn in variants:
        rng = random.Random(seed)
        RR = R if fn is None else alt(fn)
        pt, lo, hi, n = bootstrap_ratio(RR, a, b, 'cost_usd' if fn is None else 'cost_alt', lambda t: True, 'hier', iters, rng)
        P('| %s | %d | %s |' % (label, n, fmt_ci(pt, lo, hi) if n else 'n/a'))
    P('')
    return out

def r10_report(rows, per_dir, manifest, iters=2000, seed=7):
    """Report of guard/prereg-r10.md over blind4 (g1..g40): primary a = ours vs v043 (the gates), secondary a vs browse-mcp (same table, descriptive). Static/dynamic split, leave-one-out
    ranges and the cache sensitivities are always printed, for both pairs, whatever the outcome. manifest 'primary': [ours, upstream], optional 'secondary': browse-mcp."""
    g = lambda t: re.fullmatch(r'g\d+', t) is not None
    o, up = manifest_pair(manifest); a = (o or ['ab-cli:r10'])[0]; sec = manifest.get('secondary') or 'browse-mcp'
    rows = [r for r in rows if g(r['task'])]
    gates = r9_gates(rows, a, up, iters, seed, g, title='## r10 gates, PRIMARY (guard/prereg-r10.md): %s / %s, blind4 tasks' % (a, up)) + \
        r9_gates(rows, a, sec, iters, seed, g, title='## r10 gates, SECONDARY (descriptive): %s / %s, blind4 tasks' % (a, sec))
    extra = []
    for ref, tag in ((up, 'PRIMARY'), (sec, 'SECONDARY')):
        extra += r9_loo(rows, a, ref, g, title='## Leave-one-task-out ranges (%s / %s, blind4, %s)' % (a, ref, tag))
        extra += r9_sensitivities(rows, a, ref, iters, seed, g, title='## Sensitivities and cache variants (%s / %s, blind4, %s)' % (a, ref, tag), posthoc=False)
    body = build_report(rows, per_dir, dict(manifest, ours=[a], reference=up, main=sec), iters, seed, gates=gates, title='r10 report: %s / %s (secondary %s)' % (a, up, sec))
    return body + '\n' + '\n'.join(extra)

def main(argv):
    if not argv:
        print(__doc__); return 2
    iters, seed = 2000, 7
    if '--iters' in argv: iters = int(argv[argv.index('--iters') + 1])
    if '--seed' in argv: seed = int(argv[argv.index('--seed') + 1])
    manifest = load_manifest(argv[0])
    rows, per_dir = collect(manifest)
    kind = argv[argv.index('--report') + 1] if '--report' in argv else manifest.get('report', 'final')
    if kind == 'blind2':
        print(build_blind2_report(rows, per_dir, manifest, iters, seed))
    elif kind == 'r9':
        o, ref = manifest_pair(manifest); ours = (o or ['ab-cli:r9'])[0]
        extra = r9_loo(rows, ours, ref, lambda t: re.fullmatch(r'd\d+', t) is not None) + r9_sensitivities(rows, ours, ref, iters, seed)
        body = build_report(rows, per_dir, dict(manifest, ours=[ours], reference=ref), iters, seed, gates=r9_gates(rows, ours, ref, iters, seed), title='r9 report: %s / %s' % (ours, ref))
        print(body + '\n' + '\n'.join(extra))
    elif kind == 'r10':
        print(r10_report(rows, per_dir, manifest, iters, seed))
    else:
        print(build_report(rows, per_dir, manifest, iters, seed))
    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
