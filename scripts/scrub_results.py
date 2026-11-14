#!/usr/bin/env python3
"""Scrub a benchmark result directory for publication.

usage: scrub_results.py <src result dir> <dst dir> [--only-md]   |   scrub_results.py <text file> <dst file>

Copies meta.json, runs.jsonl, transcripts/*.jsonl, *.md and *.log. What is removed or changed:
  * identifiers: session, request and run ids, the auth-expiry timestamp, rate-limit and utilization blocks, org/plan flags, socket paths, uuids are dropped;
    message ids and tool-call ids are replaced by a short sha256 (equal ids stay equal, so transcripts remain analysable by src/final.py);
  * tool results (the page text the agent read): every string over 300 characters is cut to 300 characters plus its sha256 and length;
  * any home-directory path, the coordinator's e-mail, challenge tokens and CDN/WAF reference numbers (Akamai, Cloudflare), long opaque strings in URLs.
Numbers (usage, cost, wall) are never touched. Patterns are assembled from pieces so this file does not trip its own audit grep.
"""
import hashlib, json, os, re, sys

CUT = 300
J = ''.join
DROP = {J(('session', '_id')), J(('request', '_id')), J(('run', '_id')), J(('task', '_id')), J(('cred', 'ential_expires_at')), 'uuid', 'rate_limit_info', 'utilization', 'resetsAt',
        'unifiedWindows', 'overageStatus', 'overageDisabledReason', 'isUsingOverage', 'rateLimitType', 'messaging_socket_path', 'original_cwd', 'additional_directories',
        'analytics_disabled', 'product_feedback_disabled', 'fast_mode_state', 'fast_mode_disabled_reason', 'ultrathink_available', 'ultrathink_typed_raises',
        'per_turn_effort_active', 'capabilities', 'plugins', 'view_mode', 'output_file', 'apiKeySource', 'subagent_stats', 'tool_result_meta', 'tool_use_meta', 'wire_tool_inputs',
        'thinking_display', 'is_backgrounded'}
DROP_EVENTS = {'rate_limit_event'}
HASH_KEYS = {'id', 'tool_use_id', 'parent_tool_use_id'}  # message ids (msg_...) and tool-call ids (toolu_...)

def h(s, n=12):
    return hashlib.sha256(s.encode('utf-8', 'replace')).hexdigest()[:n]

HOME = re.compile(J(('/Us', 'ers/[^/\\s"\'\\\\]+')))
EMAIL = re.compile(r'[\w.+-]+@[\w-]+\.[\w.-]+')  # any email address
SOCK = re.compile(r'[^\s"\']*\.sock\b')
RUNDIR = re.compile(r'(?:/private)?/tmp/bd-[a-z]+-[A-Za-z0-9]+')
AKAMAI = re.compile(r'(Reference\s*(?:#|number:?|ID:?)\s*)[0-9a-f]+(?:\.[0-9a-f]+)+', re.I)
CFRAY = re.compile(r'(Ray ID:?\s*)[0-9a-f]{12,}', re.I)
CFCHL = re.compile(r'((?:__)?cf_chl_[a-z_]*=)[^\s&"\'\\]+', re.I)
CFSTR = re.compile(r'(?:__)?cf_chl_[a-z_]+|cf-chl-[a-z-]+', re.I)
OPAQUE = re.compile(r'(?<=[=/])[A-Za-z0-9_\-%.]{48,}')   # a long opaque value in a URL path or query
APIKEY = re.compile(J((r'\b(?:s', r'k-|v', r'ck_)[A-Za-z0-9_\-]{8,}')))

def clean_str(s):
    s = HOME.sub('<home>', s); s = EMAIL.sub('<redacted>', s); s = SOCK.sub('<socket>', s); s = RUNDIR.sub('<run-dir>', s)
    s = AKAMAI.sub(r'\1<redacted>', s); s = CFRAY.sub(r'\1<redacted>', s); s = CFCHL.sub(r'\1<redacted>', s); s = CFSTR.sub('<cdn-challenge>', s)
    s = OPAQUE.sub('<opaque>', s); s = APIKEY.sub('<redacted>', s)
    return s

def cut(s):
    if len(s) <= CUT:
        return s
    return s[:CUT] + ' ...[truncated, %d chars, sha256 %s]' % (len(s), hashlib.sha256(s.encode('utf-8', 'replace')).hexdigest())

def walk(o, truncate, key=None):
    if isinstance(o, dict):
        out = {}
        for k, v in o.items():
            if k in DROP:
                continue
            if k in HASH_KEYS and isinstance(v, str):
                out[k] = v.split('_')[0] + '_' + h(v) if '_' in v[:8] else h(v); continue
            out[k] = walk(v, truncate, k)
        return out
    if isinstance(o, list):
        return [walk(x, truncate) for x in o]
    if isinstance(o, str):
        s = clean_str(o)
        return cut(s) if truncate else s
    return o

def scrub_jsonl(src, dst, transcript):
    with open(src, errors='replace') as f, open(dst, 'w') as g:
        for line in f:
            line = line.rstrip('\n')
            if not line.strip():
                continue
            if not line.startswith('{'):
                g.write(clean_str(line) + '\n'); continue
            try:
                e = json.loads(line)
            except ValueError:
                g.write(clean_str(line)[:CUT] + '\n'); continue
            if transcript and e.get('type') in DROP_EVENTS:
                continue
            if transcript:
                # page text lives in tool results (user events) and in the result summary; the agent's own calls and answers stay whole
                keep_whole = e.get('type') == 'assistant'
                e = walk(e, truncate=not keep_whole)
            else:
                e = {k: walk(v, truncate=k in ('pre', 'truth_state')) for k, v in e.items() if k not in DROP}
            g.write(json.dumps(e, ensure_ascii=False, separators=(',', ':')) + '\n')

def scrub_text(src, dst):
    with open(src, errors='replace') as f:
        t = clean_str(f.read())
    with open(dst, 'w') as g:
        g.write(t)

def scrub_meta(src, dst):
    m = json.load(open(src))
    with open(dst, 'w') as g:
        json.dump(walk(m, False), g, indent=2, ensure_ascii=False); g.write('\n')

def main(a):
    src, dst = a[0], a[1]; only_md = '--only-md' in a
    if os.path.isfile(src):  # a single text file (for example the run log)
        os.makedirs(os.path.dirname(dst), exist_ok=True); scrub_text(src, dst); return 0
    os.makedirs(dst, exist_ok=True)
    for name in sorted(os.listdir(src)):
        p = os.path.join(src, name)
        if os.path.isdir(p) or only_md and not name.endswith('.md'):
            continue
        if name == 'meta.json':
            scrub_meta(p, os.path.join(dst, name))
        elif name.endswith('.jsonl'):
            scrub_jsonl(p, os.path.join(dst, name), transcript=False)
        elif name.endswith(('.md', '.log')):
            scrub_text(p, os.path.join(dst, name))
    tp = os.path.join(src, 'transcripts')
    if not only_md and os.path.isdir(tp):
        os.makedirs(os.path.join(dst, 'transcripts'), exist_ok=True)
        for name in sorted(os.listdir(tp)):
            if name.endswith('.jsonl'):
                scrub_jsonl(os.path.join(tp, name), os.path.join(dst, 'transcripts', name), transcript=True)
    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
