import json, os, random, sys, tempfile, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
import final

def mkdir(base, name, rows, tasks, variants, n):
    d = os.path.join(base, 'results', name); os.makedirs(d)
    json.dump({'tasks': tasks, 'variants': variants, 'n': n}, open(d + '/meta.json', 'w'))
    open(d + '/runs.jsonl', 'w').write('\n'.join(json.dumps(r) for r in rows) + '\n')
    return 'results/' + name

def row(task, v, rep, ok=True, **kw):
    r = dict(task=task, variant=v, rep=rep, success=ok, clean=ok, wall_s=1.0, steps=2, cost_usd=0.01, cost_weighted=100, answer='a', truth='a', violations=[])
    r.update(kw); return r

class T(unittest.TestCase):
    def test_five_hour_limit_is_quota_not_failure(self):
        self.assertEqual(final.status_of(row('e1', 'a', 1, False, failure_note="You've hit your 5-hour limit · resets 9am")), 'quota_abort')
        self.assertEqual(final.status_of(row('e1', 'a', 1, False, failure_note='wrong')), 'fail')
        self.assertEqual(final.status_of(row('e1', 'a', 1, False, status='quota_abort')), 'quota_abort')
        self.assertEqual(final.status_of(row('e1', 'a', 1, True, failure_note='mentions rate limit')), 'ok')

    def test_quota_rows_excluded_and_reported_missing(self):
        with tempfile.TemporaryDirectory() as b:
            d = mkdir(b, 'x', [row('e1', 'a', 1), row('e1', 'a', 2, False, failure_note="5-hour limit")], ['e1'], ['a'], 2)
            rows, rep = final.collect({'dirs': [{'dir': d}]}, b)
            self.assertEqual(len(rows), 1); self.assertEqual(rep[0]['quota_abort'], 1); self.assertEqual(rep[0]['missing'], [('e1', 'a', 2)])

    def test_rerun_replaces_only_what_manifest_says(self):
        with tempfile.TemporaryDirectory() as b:
            old = mkdir(b, 'old', [row('e1', 'a', 1), row('f7', 'a', 1, False)], ['e1', 'f7'], ['a'], 1)
            new = mkdir(b, 'new', [row('f7', 'a', 1)], ['f7'], ['a'], 1)
            m = {'dirs': [{'dir': old}, {'dir': new, 'replaces': [{'dir': old, 'tasks': ['f7'], 'reason': 'quota deaths'}]}]}
            rows, rep = final.collect(m, b)
            self.assertEqual(sorted((r['task'], r['_dir']) for r in rows), [('e1', old), ('f7', new)])
            self.assertTrue(all(not d['missing'] for d in rep))
            with self.assertRaises(final.ManifestError):  # undeclared duplicate cell is an error, not a silent last-wins
                final.collect({'dirs': [{'dir': old}, {'dir': new}]}, b)

    def test_exclusion_needs_reason_and_include_limits_tasks(self):
        with tempfile.TemporaryDirectory() as b:
            d = mkdir(b, 'x', [row('e1', 'a', 1), row('h7', 'a', 1)], ['e1', 'h7'], ['a'], 1)
            p = os.path.join(b, 'm.json'); json.dump({'dirs': [{'dir': d, 'exclude_tasks': {'h7': ''}}]}, open(p, 'w'))
            with self.assertRaises(final.ManifestError): final.load_manifest(p)
            rows, rep = final.collect({'dirs': [{'dir': d, 'include_tasks': ['e1']}]}, b)
            self.assertEqual([r['task'] for r in rows], ['e1']); self.assertEqual(rep[0]['expected'], 1)

    def test_overlay_turns_missing_evidence_into_non_compliant(self):
        with tempfile.TemporaryDirectory() as b:
            d = mkdir(b, 'x', [row('e3', 'a', 1)], ['e3'], ['a'], 1)
            json.dump({d + '|e3|a|1': ['form submitted']}, open(os.path.join(b, 'ov.json'), 'w'))
            rows, _ = final.collect({'dirs': [{'dir': d}], 'overlays': ['ov.json']}, b)
            self.assertFalse(rows[0]['clean']); self.assertFalse(rows[0]['success'])

    def test_hierarchical_interval_is_wider_than_fixed_when_tasks_differ(self):
        rows = []
        for i, scale in enumerate([0.2, 0.5, 1.0, 2.0, 4.0, 8.0]):
            for rep in range(1, 6):
                rows.append(row('t%d' % i, 'a', rep, cost_usd=0.01 * scale * (1 + 0.01 * rep)))
                rows.append(row('t%d' % i, 'b', rep, cost_usd=0.01 * (1 + 0.01 * rep)))
        rng = random.Random(1)
        pf, lf, hf, n = final.bootstrap_ratio(rows, 'a', 'b', 'cost_usd', lambda t: True, 'fixed', 500, rng)
        ph, lh, hh, _ = final.bootstrap_ratio(rows, 'a', 'b', 'cost_usd', lambda t: True, 'hier', 500, rng)
        self.assertEqual(n, 6); self.assertAlmostEqual(pf, ph)
        self.assertGreater(hh - lh, (hf - lf) * 5)

    def test_peak_context_is_the_largest_prompt_of_any_turn_from_the_transcript(self):
        with tempfile.TemporaryDirectory() as b:
            d = mkdir(b, 'x', [row('e1', 'a:r7', 1), row('e1', 'a:r7', 2), row('e1', 'a:r7', 3, peak_ctx=777)], ['e1'], ['a:r7'], 3)
            os.makedirs(os.path.join(b, d, 'transcripts'))
            def turn(i, c, w): return json.dumps({'type': 'assistant', 'message': {'usage': {'input_tokens': i, 'cache_read_input_tokens': c, 'cache_creation_input_tokens': w}}})
            open(os.path.join(b, d, 'transcripts', 'e1-a_r7-1.jsonl'), 'w').write('\n'.join([turn(5, 1000, 200), turn(3, 4000, 100), json.dumps({'type': 'user'}), 'not json', turn(1, 10, 0)]) + '\n')
            rows, _ = final.collect({'dirs': [{'dir': d}]}, b)
            by = {r['rep']: r['peak_ctx'] for r in rows}
            self.assertEqual(by[1], 4103)    # max over turns, not a sum
            self.assertIsNone(by[2])         # no transcript: unknown, never 0
            self.assertEqual(by[3], 777)     # a recorded value wins
            ours = [dict(r, variant='a:r7') for r in rows]
            txt = final.build_report(ours + [dict(r, variant='b', peak_ctx=8206) for r in rows], [], {'ours': ['a:r7'], 'reference': 'b'}, iters=20)
            self.assertIn('peak context', txt)

    def test_report_labels_primary_and_proxy(self):
        with tempfile.TemporaryDirectory() as b:
            rows = [row('e1', v, k) for v in ('a', 'b') for k in (1, 2)]
            d = mkdir(b, 'x', rows, ['e1'], ['a', 'b'], 2)
            m = {'dirs': [{'dir': d}], 'reference': 'b', 'ours': ['a']}
            rs, rep = final.collect(m, b)
            txt = final.build_report(rs, rep, m, iters=50)
            self.assertIn('cost USD (primary)', txt); self.assertIn('(PROXY)', txt); self.assertIn('4 of 4 expected cells', txt); self.assertIn('HIERARCHICAL', txt)



class PartialCost(unittest.TestCase):
    def _transcript(self, base, rows):
        d = os.path.join(base, 'results', 'cut'); os.makedirs(os.path.join(d, 'transcripts'))
        json.dump({'tasks': ['b1'], 'variants': ['browse-mcp'], 'n': 1, 'runner': 'claude'}, open(d + '/meta.json', 'w'))
        open(d + '/runs.jsonl', 'w').write('\n'.join(json.dumps(r) for r in rows) + '\n')
        ev = [{'type': 'assistant', 'message': {'id': 'm1', 'usage': {'input_tokens': 3, 'cache_creation_input_tokens': 1000, 'cache_read_input_tokens': 0, 'output_tokens': 20}, 'content': [{'type': 'text', 'text': 'x' * 100}]}},
              {'type': 'assistant', 'message': {'id': 'm1', 'usage': {'input_tokens': 3, 'cache_creation_input_tokens': 1000, 'cache_read_input_tokens': 0, 'output_tokens': 20}, 'content': [{'type': 'tool_use', 'id': 't1', 'name': 'mcp__browse__execute', 'input': {'code': 'y' * 400}}]}},
              {'type': 'assistant', 'message': {'id': 'm2', 'usage': {'input_tokens': 2, 'cache_creation_input_tokens': 500, 'cache_read_input_tokens': 1000, 'output_tokens': 10}, 'content': [{'type': 'tool_use', 'id': 't2', 'name': 'mcp__browse__execute', 'input': {'code': 'z'}}]}}]
        open(os.path.join(d, 'transcripts', 'b1-browse-mcp-1.jsonl'), 'w').write('\n'.join(json.dumps(e) for e in ev) + '\n')
        return 'results/cut'

    def test_timeout_row_without_cost_is_priced_from_its_transcript_and_labelled(self):
        with tempfile.TemporaryDirectory() as b:
            d = self._transcript(b, [row('b1', 'browse-mcp', 1, False, cost_usd=None, cost_weighted=None, timed_out=True, status='timeout')])
            rows, rep = final.collect({'dirs': [{'dir': d}]}, b)
            r = rows[0]
            self.assertEqual(r['cost_src'], 'estimate'); self.assertTrue(r['cost_partial']); self.assertGreater(r['cost_usd'], 0)
            self.assertEqual(r['_cost_src'], 'estimate')
            u = final.partial_usage(os.path.join(b, d, 'transcripts', 'b1-browse-mcp-1.jsonl'))
            self.assertEqual((u['turns'], u['raw_input'], u['cache_creation'], u['cache_read']), (2, 5, 1500, 1000))
            self.assertAlmostEqual(r['cost_usd'], final.estimate_cost(u), places=6)

    def test_reported_cost_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as b:
            d = self._transcript(b, [row('b1', 'browse-mcp', 1, True, cost_usd=0.5)])
            rows, _ = final.collect({'dirs': [{'dir': d}]}, b)
            self.assertEqual(rows[0]['cost_usd'], 0.5); self.assertEqual(rows[0]['_cost_src'], 'reported')

    def test_python_and_typescript_price_the_same_usage_the_same_way(self):
        # rates fixture from a real run: usage 6 / 2776 / 28112 / 584 was reported as $0.0197672
        self.assertAlmostEqual(final.estimate_cost({'raw_input': 6, 'cache_creation': 2776, 'cache_read': 28112, 'output_tokens': 584}), 0.0197672, places=7)


class Blind2Report(unittest.TestCase):
    def _rows(self):
        rows = []
        # 4 tasks; ab-cli:r8 is faster and cheaper than browse-mcp everywhere except c3, where r8 times out once
        for t, (wa, wb) in {'c1': (10, 20), 'c2': (12, 24), 'c3': (30, 40), 'c4': (8, 16)}.items():
            for rep in (1, 2, 3):
                rows.append(row(t, 'ab-cli:r8', rep, wall_s=float(wa), cost_usd=wa / 1000, peak_ctx=1000, suite='blind2', _timeout_s=100))
                rows.append(row(t, 'browse-mcp', rep, wall_s=float(wb), cost_usd=wb / 500, peak_ctx=2000, suite='blind2', _timeout_s=100))
                rows.append(row(t, 'ab-cli:r7', rep, wall_s=float(wa) * 1.5, cost_usd=wa / 600, peak_ctx=1500, suite='blind2', _timeout_s=100))
        for r in rows:
            r['_cost_src'] = 'reported'
        slow = [r for r in rows if r['task'] == 'c3' and r['variant'] == 'ab-cli:r8' and r['rep'] == 2][0]
        slow.update(timed_out=True, success=False, clean=False, wall_s=100.0, cost_src='estimate', _cost_src='estimate', cost_partial=True, violations=['x'], api_access=[{'kind': 'script-api-call', 'url': '/api/x'}])
        return rows

    def test_censored_time_leave_one_out_and_timeouts(self):
        R = self._rows(); final.add_censored_time(R)
        slow = [r for r in R if r.get('timed_out')][0]
        self.assertEqual(slow['wall_rmst'], 100.0); self.assertIsNone(slow['wall_done'])
        ok = [r for r in R if r['task'] == 'c1'][0]; self.assertEqual(ok['wall_rmst'], ok['wall_s'])
        full, loo = final.loo_range(R, 'ab-cli:r8', 'browse-mcp', 'wall_s', final.is_blind2)
        self.assertEqual(len(loo), 4); self.assertEqual(loo[0][1] <= full <= loo[-1][1], True)
        self.assertEqual(loo[0][0], 'c3')   # c3 is the task where r8's advantage is smallest (ratio .75): dropping it gives the lowest leave-one-out ratio
        full_r, _ = final.loo_range(R, 'ab-cli:r8', 'browse-mcp', 'wall_rmst', final.is_blind2, agg=final.st.mean)
        self.assertGreater(full_r, full)    # the timeout (counted as 100 s) pulls r8's restricted mean up relative to its median

    def test_report_sections_and_labels(self):
        R = self._rows()
        txt = final.build_blind2_report(R, [], {'primary': ['ab-cli:r8', 'browse-mcp'], 'secondary': ['ab-cli:r8', 'ab-cli:r7']}, iters=60)
        for must in ('## Primary: ab-cli:r8 / browse-mcp', '## Secondary: ab-cli:r8 / ab-cli:r7', 'timeout rate', 'Restricted mean wall up to the timeout', 'leave-one-task-out',
                     '## Cost coverage', 'ESTIMATED', 'Sensitivity, cost from reported rows only', 'Semantic API use', 'script API call', 'Steps are descriptive only', 'peak context'):
            self.assertIn(must, txt)
        self.assertIn('| ab-cli:r8 | 12 | 11/12 | 11/12 | 1/12 (8%)', txt)      # compliant 7/8, one timeout
        self.assertIn('| ab-cli:r8 | 12 | 11 | 1 | 0 |', txt)                  # cost coverage: 7 reported, 1 estimated, 0 none
        self.assertNotIn('MISSING in', txt)

    def test_blind2_group_is_ignored_when_absent_and_selected_by_manifest_report(self):
        with tempfile.TemporaryDirectory() as b:
            rows = [row('c1', 'a', 1), row('c1', 'b', 1), row('e1', 'a', 1), row('e1', 'b', 1)]
            d = mkdir(b, 'x', rows, ['c1', 'e1'], ['a', 'b'], 1)
            rs, rep = final.collect({'dirs': [{'dir': d}]}, b)
            self.assertEqual(rs[0]['_timeout_s'], None)       # not recorded -> report assumes the default and says so
            txt = final.build_blind2_report(rs, rep, {'primary': ['a', 'b'], 'secondary': ['a', 'b']}, iters=20)
            self.assertIn('NOT recorded', txt); self.assertIn('Rows of other tasks in the manifest are ignored here: e1', txt)
            legacy = final.build_report(rs, rep, {'ours': ['a'], 'reference': 'b'}, iters=20)
            self.assertIn('blind2 (c1-c20)', legacy)


class ManifestTemplate(unittest.TestCase):
    def test_blind2_template_loads_and_names_the_comparisons(self):
        m = final.load_manifest(os.path.join(os.path.dirname(__file__), '..', 'manifest-blind2.template.json'))
        self.assertEqual(m['report'], 'blind2'); self.assertEqual(m['primary'], ['ab-cli:r8', 'browse-mcp']); self.assertEqual(m['secondary'], ['ab-cli:r8', 'ab-cli:r7'])


class ExtendedMeasures(unittest.TestCase):
    def test_truth_unavailable_for_most_runs_excludes_the_task_for_all_variants_and_says_why(self):
        with tempfile.TemporaryDirectory() as b:
            bad = dict(success=False, clean=False, truth='(truth unavailable)', failure_note='checker could not compute truth: Unable to connect')
            rows = [row('c3', v, k, False, **bad) for v in ('a', 'b') for k in (1, 2)] + [row('c3', 'a', 3), row('c3', 'b', 3)]
            rows += [row('c1', v, k) for v in ('a', 'b') for k in (1, 2, 3)]
            d = mkdir(b, 'x', rows, ['c1', 'c3'], ['a', 'b'], 3)
            rs, rep = final.collect({'dirs': [{'dir': d}]}, b)
            self.assertEqual({r['task'] for r in rs}, {'c1'})
            self.assertIn('auto: truth could not be computed in 4 of 6 runs', rep[0]['excluded']['c3']); self.assertEqual(rep[0]['expected'], 6)
            rs2, rep2 = final.collect({'dirs': [{'dir': d}], 'auto_exclude_truth': False}, b)      # old behaviour on request, with a warning
            self.assertIn('c3', {r['task'] for r in rs2}); self.assertTrue(rep2[0]['truth_warnings'])
            rs3, rep3 = final.collect({'dirs': [{'dir': d}], 'truth_unavailable_threshold': 0.7}, b)  # 4/6 is not above 0.7: kept, warned
            self.assertIn('c3', {r['task'] for r in rs3}); self.assertIn('not above', rep3[0]['truth_warnings'][0])

    def test_exactly_half_is_not_most(self):
        with tempfile.TemporaryDirectory() as b:
            bad = dict(success=False, clean=False, truth='(truth unavailable)')
            d = mkdir(b, 'x', [row('b9', 'a', 1, False, **bad), row('b9', 'a', 2), row('b9', 'b', 1, False, **bad), row('b9', 'b', 2)], ['b9'], ['a', 'b'], 2)
            rs, rep = final.collect({'dirs': [{'dir': d}]}, b)
            self.assertEqual(len(rs), 4); self.assertEqual(rep[0]['excluded'], {})

    def test_runs_file_replaces_rows_but_transcripts_stay_with_the_result_dir(self):
        with tempfile.TemporaryDirectory() as b:
            d = mkdir(b, 'x', [row('c1', 'a', 1)], ['c1'], ['a'], 1)
            open(os.path.join(b, 'posthoc.jsonl'), 'w').write(json.dumps(row('c1', 'a', 1, False, handoff=True, status='handoff', wall_s=9.0, wall_raw_s=420.0)) + '\n')
            rs, _ = final.collect({'dirs': [{'dir': d, 'runs_file': 'posthoc.jsonl'}]}, b)
            self.assertTrue(rs[0]['_handoff']); self.assertEqual(rs[0]['_status'], 'handoff'); self.assertEqual(rs[0]['wall_s'], 9.0)

    def test_dynamic_context_is_peak_minus_the_first_turn_and_is_computed_where_peak_is_missing(self):
        with tempfile.TemporaryDirectory() as b:
            d = mkdir(b, 'x', [row('b1', 'a', 1), row('b1', 'a', 2, peak_ctx=900, first_ctx=400)], ['b1'], ['a'], 2)
            os.makedirs(os.path.join(b, d, 'transcripts'))
            turn = lambda i, c, w: json.dumps({'type': 'assistant', 'message': {'usage': {'input_tokens': i, 'cache_read_input_tokens': c, 'cache_creation_input_tokens': w}}})
            open(os.path.join(b, d, 'transcripts', 'b1-a-1.jsonl'), 'w').write('\n'.join([turn(5, 1000, 200), turn(3, 4000, 100), turn(1, 10, 0)]) + '\n')
            rs, _ = final.collect({'dirs': [{'dir': d}]}, b)
            by = {r['rep']: r for r in rs}
            self.assertEqual((by[1]['first_ctx'], by[1]['peak_ctx'], by[1]['dyn_ctx']), (1205, 4103, 2898))
            self.assertEqual(by[2]['dyn_ctx'], 500)                                  # recorded values are used as they are

    def test_cost_per_compliant_success_counts_the_failures_money(self):
        V = [row('t', 'a', 1, True, cost_usd=0.10), row('t', 'a', 2, False, cost_usd=0.30), row('t', 'a', 3, True, cost_usd=None)]
        c, k, nc = final.cost_per_compliant(V)
        self.assertAlmostEqual(c, 0.40); self.assertEqual(k, 1); self.assertEqual(nc, 1)
        R = [row('t%d' % i, v, k, ok, cost_usd=cost) for i in range(4) for v, cost in (('a', 0.02), ('b', 0.04)) for k, ok in ((1, True), (2, v == 'a'))]
        pt, lo, hi, n = final.bootstrap_cps_ratio(R, 'a', 'b', lambda t: True, 'hier', 100, random.Random(3))
        self.assertAlmostEqual(pt, (0.04 / 8) / (0.08 / 4)); self.assertEqual(n, 4)   # a: 8 runs 0.16 over 8 successes; b: 4 successes of 8 at 0.32
        self.assertAlmostEqual(pt, (0.16 / 8) / (0.32 / 4))

    def test_two_thirds_sensitivity_keeps_only_tasks_both_tools_can_do(self):
        R = [row('c1', v, k, True) for v in ('a', 'b') for k in (1, 2, 3)]                       # both 3/3
        R += [row('c2', 'a', k, k < 3) for k in (1, 2, 3)] + [row('c2', 'b', k, k < 2) for k in (1, 2, 3)]   # a 2/3, b 1/3
        R += [row('c3', 'a', k, k < 3) for k in (1, 2, 3)] + [row('c3', 'b', k, True) for k in (1, 2, 3)]    # a 2/3, b 3/3
        self.assertEqual(final.reach_two_thirds(R, 'a', 'b'), ['c1', 'c3'])

    def test_reports_carry_handoff_completion_cps_dynamic_context_and_workflow(self):
        R = []
        for t in ('c1', 'c2', 'c4'):
            for k in (1, 2, 3):
                R.append(row(t, 'a', k, True, cost_usd=0.01, wall_s=5.0, peak_ctx=2000, first_ctx=1500, dyn_ctx=500, workflow_ok=True, suite='blind2', _timeout_s=100))
                R.append(row(t, 'b', k, True, cost_usd=0.02, wall_s=6.0, peak_ctx=4000, first_ctx=3000, dyn_ctx=1000, workflow_ok=(k != 3), suite='blind2', _timeout_s=100))
        for k in (1, 2, 3):
            R.append(row('c9', 'a', k, True, cost_usd=0.01, wall_s=5.0, peak_ctx=2000, first_ctx=1500, dyn_ctx=500, suite='blind2', _timeout_s=100))
            R.append(row('c9', 'b', k, False, cost_usd=0.01, wall_s=9.0, wall_raw_s=420.0, peak_ctx=4000, first_ctx=3000, dyn_ctx=1000, handoff=True, status='handoff', suite='blind2', _timeout_s=100))
        for r in R:
            r['_cost_src'] = 'reported'; r['_handoff'] = bool(r.get('handoff')); r['_status'] = final.status_of(r)
            r['_strict'] = bool(r.get('clean')) and r.get('workflow_ok') is not False
        txt = final.build_blind2_report(R, [], {'primary': ['a', 'b'], 'secondary': ['b', 'a']}, iters=40)
        for must in ('## Handoff, timeouts and completion', '| b | 12 | 3 (25.0%) |', 'completion rate', 'median active latency', '420.0', '## Cost per compliant success', '## Context: peak and dynamic peak',
                     'dynamic peak context ratio', '## Sensitivity: only tasks where both reach >= 2/3 compliant success: a / b', '3 tasks: c1, c2, c4', '## Workflow compliance', 'withdrawn'):
            self.assertIn(must, txt)



def write_transcript(base, d, task, variant, rep, turns, duration_ms=None):
    """turns: list of (message id, input, cache_creation, cache_read). An id may repeat (stream events of one API call)."""
    os.makedirs(os.path.join(base, d, 'transcripts'), exist_ok=True)
    ev = [{'type': 'assistant', 'message': {'id': i, 'usage': {'input_tokens': a, 'cache_creation_input_tokens': c, 'cache_read_input_tokens': r, 'output_tokens': 5}}} for i, a, c, r in turns]
    if duration_ms is not None:
        ev.append({'type': 'result', 'duration_ms': duration_ms})
    open(os.path.join(base, d, 'transcripts', '%s-%s-%s.jsonl' % (task, variant.replace(':', '_'), rep)), 'w').write('\n'.join(json.dumps(e) for e in ev) + '\n')


class R9Report(unittest.TestCase):
    # one run: 4 API calls (m1 appears in two stream events). First call: 10 input, 1000 written, 4000 read. Later calls read the 5010-token prefix plus growth.
    TURNS = [('m1', 10, 1000, 4000), ('m1', 10, 1000, 4000), ('m2', 4, 300, 5010), ('m3', 4, 200, 5310), ('m4', 4, 100, 5510)]
    FIRST_TURN = (10 * 2 + 1000 * 4 + 4000 * 0.1) / 1e6                  # what the first call really cost
    STATIC = FIRST_TURN + 5010 * 0.1 * 3 / 1e6                           # + re-read of the prefix on the 3 later calls (turns by distinct message id)

    def _collect(self, b, cost=0.05, num_turns=99, turns=None):
        d = mkdir(b, 'x', [row('d1', 'ab-cli:r9', 1, cost_usd=cost, num_turns=num_turns)], ['d1'], ['ab-cli:r9'], 1)
        write_transcript(b, d, 'd1', 'ab-cli:r9', 1, turns or self.TURNS, duration_ms=7000)
        return final.collect({'dirs': [{'dir': d}]}, b)

    def test_static_cost_is_the_measured_first_turn_plus_cache_reads_of_that_prefix(self):
        with tempfile.TemporaryDirectory() as b:
            rows, _ = self._collect(b)
            r = rows[0]
            self.assertAlmostEqual(r['first_turn_cost'], self.FIRST_TURN, places=9)
            self.assertAlmostEqual(r['static_cost'], self.STATIC, places=9)          # num_turns=99 on the row is ignored: turns are distinct message ids
            self.assertAlmostEqual(r['dyn_cost'], 0.05 - self.STATIC, places=9)
            self.assertEqual(r['wall_cc'], 7.0)

    def test_a_first_turn_that_is_mostly_cache_read_is_not_priced_as_a_cache_write(self):
        # the old model priced the whole first_ctx at the write rate: 5010 * 4 / 1e6 = 0.02004 for the first call alone, 4x too much when 80% of it is read
        with tempfile.TemporaryDirectory() as b:
            rows, _ = self._collect(b)
            self.assertLess(rows[0]['static_cost'], 5010 * 4 / 1e6)
            self.assertLess(rows[0]['first_turn_cost'], 0.5 * 5010 * 4 / 1e6)

    def test_static_above_total_cost_is_an_error_not_a_clamp(self):
        with tempfile.TemporaryDirectory() as b:
            with self.assertRaises(AssertionError):
                self._collect(b, cost=0.001)

    def test_no_static_split_without_a_transcript_or_a_cost(self):
        with tempfile.TemporaryDirectory() as b:
            d = mkdir(b, 'x', [row('d1', 'a', 1), row('d1', 'a', 2, cost_usd=None)], ['d1'], ['a'], 2)
            write_transcript(b, d, 'd1', 'a', 2, self.TURNS)
            rs, _ = final.collect({'dirs': [{'dir': d}]}, b)
            self.assertTrue(all(r.get('static_cost') is None for r in rs))

    def test_manifest_accepts_primary_or_ours(self):
        self.assertEqual(final.manifest_pair({'primary': ['x', 'y']}), (['x'], 'y'))
        self.assertEqual(final.manifest_pair({'ours': ['a'], 'reference': 'b'}), (['a'], 'b'))
        self.assertEqual(final.manifest_pair({}), ([], 'browse-mcp'))

    def _two_tool_rows(self, b):
        rows = []
        for t in ('d1', 'd2', 'd3', 'd4'):
            for k in (1, 2):
                rows.append(row(t, 'ab-cli:r9', k, ok=(t != 'd4'), cost_usd=0.010, wall_s=5.0, peak_ctx=2000, num_turns=4))
                rows.append(row(t, 'browse-mcp', k, ok=(t != 'd4'), cost_usd=0.020, wall_s=5.0, peak_ctx=4000, num_turns=4))
        d = mkdir(b, 'x', rows, ['d1', 'd2', 'd3', 'd4'], ['ab-cli:r9', 'browse-mcp'], 2)
        for t in ('d1', 'd2', 'd3', 'd4'):
            for k in (1, 2):
                write_transcript(b, d, t, 'ab-cli:r9', k, [('a1', 2, 500, 500), ('a2', 2, 100, 1000)], duration_ms=5000)
                write_transcript(b, d, t, 'browse-mcp', k, [('b1', 2, 500, 2500), ('b2', 2, 100, 3000)], duration_ms=6000)
        return d

    def test_r9_report_fills_pairwise_and_sensitivity_sections_from_a_primary_manifest(self):
        with tempfile.TemporaryDirectory() as b:
            d = self._two_tool_rows(b)
            m = {'dirs': [{'dir': d}], 'primary': ['ab-cli:r9', 'browse-mcp']}
            rs, rep = final.collect(m, b)
            o, ref = final.manifest_pair(m)
            g = '\n'.join(final.r9_gates(rs, o[0], ref, iters=60))
            for must in ('cost (cost_usd) ratio', '| PASS |', 'peak context ratio', 'CLAIM MADE', 'wall (charged), descriptive', 'whatever the outcome'):
                self.assertIn(must, g)
            txt = final.build_report(rs, rep, dict(m, ours=o, reference=ref), iters=40, gates=final.r9_gates(rs, o[0], ref, iters=40))
            self.assertTrue(txt.startswith('# Final report'))                              # heading order: the H1 comes before the gate H2
            self.assertLess(txt.index('# Final report'), txt.index('## r9 gates'))
            for must in ('### ab-cli:r9 vs browse-mcp', '## Static / dynamic split of cost and context', 'dynamic cost ratio', 'dynamic peak context ratio', '## Sensitivity: only tasks where both reach >= 2/3',
                         'cost per compliant success ratio', 'blind3 (d1-d40)'):
                self.assertIn(must, txt)
            self.assertLess(txt.index('| d2 |'), txt.index('| d10 |')) if '| d10 |' in txt else None
            extra = '\n'.join(final.r9_loo(rs, o[0], ref, lambda t: True) + final.r9_sensitivities(rs, o[0], ref, iters=40, f=lambda t: True))
            for must in ('## Leave-one-task-out ranges', 'compliant success difference (pts)', 'excluding tasks failed by every tool (d4)', 'excluding d16', 'excluding d21', 'repetition 1 only', 'repetition 2 only',
                         'duration_ms', 'priced alike', 'whole first turn read from cache', 'cold cache', '1 tasks' if False else '>= 2/3'):
                self.assertIn(must, extra)

    def test_cost_variants_order_as_the_prices_say(self):
        with tempfile.TemporaryDirectory() as b:
            d = self._two_tool_rows(b)
            rs, _ = final.collect({'dirs': [{'dir': d}]}, b)
            txt = '\n'.join(final.r9_sensitivities(rs, 'ab-cli:r9', 'browse-mcp', iters=30, f=lambda t: True))
            vals = {}
            for line in txt.splitlines():
                for key in ('whole first turn read', 'cold cache'):
                    if line.startswith('| ' + key):
                        vals[key] = float(line.split('|')[3].split()[0])
            self.assertTrue(0 < vals['whole first turn read'] < 1 and 0 < vals['cold cache'] < 1)

    def test_numeric_task_order_and_failure_reasons(self):
        r = row('d2', 'a', 1, False, handoff=True, handoff_message='please solve the captcha')
        self.assertIn('handoff to a human (please solve the captcha)', final.failure_reason(r))
        self.assertEqual(final.failure_reason(row('d2', 'a', 1, False, timed_out=True)), 'timeout')
        self.assertIn('does not match', final.failure_reason(row('d2', 'a', 1, False)))
        self.assertEqual(sorted(['d10', 'd2', 'd1'], key=final.task_key), ['d1', 'd2', 'd10'])

if __name__ == '__main__': unittest.main()
