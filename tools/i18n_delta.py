"""Hand translators only what is new, and merge their work back.

    python tools/i18n_delta.py export            write i18n/delta/<code>.json for every language that lacks something
    python tools/i18n_delta.py check <code>      validate a translator's i18n/delta/<code>.out.json
    python tools/i18n_delta.py apply [code ...]  merge i18n/delta/<code>.out.json into i18n/<code>.json
    python tools/i18n_delta.py status            what is still missing, per language

A delta file lists, section by section, each string to translate with its English and Korean wording.
The translator writes <code>.out.json with the same keys and the translation as the value.
"""
import difflib, io, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import ROOT, LANGS, load

DELTA = os.path.join(ROOT, 'i18n', 'delta')
KEEP = {'GitHub', 'Copyright © 2025 Lee Seungheon', 'Photography by 流木 Lee Dong-joo'}      # the same in every language
ORDER = ['ui', 'labels', 'motion', 'gate', 'titles', 'places', 'site', 'same']
tags = lambda s: sorted(re.findall(r'</?[a-z][a-z0-9]*[^>]*>', s))
holes = lambda s: sorted(re.findall(r'\{[a-z]+\}', s))
latin = lambda s: len(re.findall(r'[A-Za-z]', re.sub(r'<[^>]+>', '', s)))


def flat(d, pre=''):
    """{'halls': {'awards': x}} -> {'halls.awards': x}; lists are kept whole."""
    out = {}
    for k, v in d.items():
        if isinstance(v, dict): out.update(flat(v, pre + k + '.'))
        else: out[pre + k] = v
    return out


def put(d, path, value):
    keys = path.split('.')
    for k in keys[:-1]: d = d.setdefault(k, {})
    d[keys[-1]] = value


def missing(code, en, ko):
    tr = load(code)
    out = {}
    for sec in ('ui', 'labels'):
        e, k, t = flat(en[sec]), flat(ko[sec]), flat(tr.get(sec, {}))
        need = {p: dict(en=e[p], ko=k.get(p)) for p in e if p not in t}
        if need: out[sec] = need
    need = {str(i + 1): dict(en=en['titles'][i], ko=ko['titles'][i]) for i in range(len(tr['titles']), len(en['titles']))}
    if need: out['titles'] = need
    same = set(tr.get('same', []))                  # strings a translator has confirmed are right as they stand in English
    need = {p: dict(en=p, ko=ko['places'].get(p)) for p in en['places'] if tr['places'].get(p, p) == p and p not in same}
    if need and code not in ('id', 'vi', 'tr', 'es', 'fr', 'pt', 'it'): out['places'] = need      # Latin-script languages reviewed these already
    site = tr.get('site', {})
    old = {k: v for k, v in site.items() if k not in en['site']}
    need = {}
    for k in en['site']:
        if k in KEEP: continue
        if k not in site:
            item = dict(en=k)
            near = difflib.get_close_matches(k, list(old), n=1, cutoff=0.55)
            if near: item['hint'] = 'An earlier version of this sentence was translated as: ' + old[near[0]]
            need[k] = item
        elif site[k] == k and latin(k) >= 4 and code in ('ja', 'de') and k not in same:
            need[k] = dict(en=k, hint='Currently left in English. Translate it, or repeat it unchanged if that is right in your language.')
    if need: out['site'] = need
    return out


def export():
    en, ko = load('en'), load('ko')
    os.makedirs(DELTA, exist_ok=True)
    for l in LANGS:
        code = l['code']
        if code in ('ko', 'en'): continue
        m = missing(code, en, ko)
        path = os.path.join(DELTA, code + '.json')
        if not m:
            if os.path.exists(path): os.remove(path)
            continue
        with io.open(path, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(dict(lang=code, name=l['name'], **m), f, ensure_ascii=False, indent=1); f.write('\n')
        print('%-6s %s' % (code, ', '.join('%s %d' % (k, len(v)) for k, v in m.items())))


def problems(items_by_section, got):
    """What is wrong with a translator's file, measured against the strings it was asked for."""
    errors = []
    for sec, items in items_by_section.items():
        for key, ref in items.items():
            v = got.get(sec, {}).get(key)
            if not isinstance(v, str) or not v.strip(): errors.append('%s: missing %r' % (sec, key[:70])); continue
            if tags(v) != tags(ref['en']): errors.append('%s: HTML tags differ in %r' % (sec, key[:70]))
            if holes(v) != holes(ref['en']): errors.append('%s: placeholders differ in %r' % (sec, key[:70]))
            if ref['en'].count(chr(10)) != v.count(chr(10)): errors.append('%s: line breaks differ in %r' % (sec, key[:70]))
        for key in got.get(sec, {}):
            if key not in items: errors.append('%s: unknown key %r' % (sec, key[:70]))
    return errors


def check(code):
    """Validate <code>.out.json against the delta that was handed out."""
    ref = json.load(io.open(os.path.join(DELTA, code + '.json'), encoding='utf-8'))
    src = os.path.join(DELTA, code + '.out.json')
    if not os.path.exists(src): print('no', os.path.basename(src)); return False
    try: got = json.load(io.open(src, encoding='utf-8'))
    except Exception as e: print('not valid JSON:', e); return False
    errors = problems({k: v for k, v in ref.items() if isinstance(v, dict)}, got)
    print(chr(10).join(errors[:60]) if errors else 'OK: %s.out.json is complete' % code)
    return not errors


def apply(codes):
    """Merge what the translators delivered; anything still wanted but not delivered stays missing."""
    en, ko = load('en'), load('ko')
    for code in codes:
        src = os.path.join(DELTA, code + '.out.json')
        if not os.path.exists(src): print('%-6s no %s' % (code, os.path.basename(src))); continue
        got = json.load(io.open(src, encoding='utf-8'))
        want = missing(code, en, ko)
        ok = lambda sec, key: isinstance(got.get(sec, {}).get(key), str) and not problems({sec: {key: want[sec][key]}}, {sec: {key: got[sec][key]}})
        doc = load(code)
        n = 0
        for sec in ('ui', 'labels'):
            for key in want.get(sec, {}):
                if ok(sec, key): put(doc.setdefault(sec, {}), key, got[sec][key]); n += 1
        for key in sorted(want.get('titles', {}), key=int):
            if int(key) != len(doc['titles']) + 1 or not ok('titles', key): break
            doc['titles'].append(got['titles'][key]); n += 1
        kept = set(doc.get('same', []))
        for key in want.get('places', {}):
            if ok('places', key):
                doc['places'][key] = got['places'][key]; n += 1
                if got['places'][key] == key: kept.add(key)
        site = doc.setdefault('site', {})
        for key in want.get('site', {}):
            if ok('site', key):
                site[key] = got['site'][key]; n += 1
                if got['site'][key] == key: kept.add(key)
        doc['site'] = {k: site[k] for k in en['site'] if k in site}                      # same order as English; unused ones dropped
        doc['ui'].pop('open', None)
        if kept: doc['same'] = sorted(kept)
        doc = {k: doc[k] for k in ORDER if k in doc}
        with io.open(os.path.join(ROOT, 'i18n', code + '.json'), 'w', encoding='utf-8', newline=chr(10)) as f:
            json.dump(doc, f, ensure_ascii=False, indent=1); f.write(chr(10))
        print('%-6s merged %d' % (code, n))


def status():
    en, ko = load('en'), load('ko')
    for l in LANGS:
        if l['code'] in ('ko', 'en'): continue
        m = missing(l['code'], en, ko)
        print('%-6s %s' % (l['code'], ', '.join('%s %d' % (k, len(v)) for k, v in m.items()) or 'complete'))


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'status'
    if cmd == 'export': export()
    elif cmd == 'check': sys.exit(0 if check(sys.argv[2]) else 1)
    elif cmd == 'apply': apply(sys.argv[2:] or [l['code'] for l in LANGS if l['code'] not in ('ko', 'en')]); status()
    else: status()
