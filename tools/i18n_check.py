"""Check a translated language file against i18n/en.json. Usage: python tools/i18n_check.py <code>"""
import io, json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load = lambda c: json.load(io.open(os.path.join(ROOT, 'i18n', c + '.json'), encoding='utf-8'))
en, tr = load('en'), load(sys.argv[1])
errors = []
tags = lambda s: sorted(re.findall(r'</?[a-z]+[^>]*>', s))
holes = lambda s: sorted(re.findall(r'\{[a-z]+\}', s))
icons = lambda s: sorted(re.findall(r'<x[0-9]+/>', s))
links = lambda s: len(re.findall(r'<a ', s))
def cmp(a, b, path):
    if type(a) != type(b): errors.append('%s: type differs' % path); return
    if isinstance(a, dict):
        for k in a:
            if k not in b: errors.append('%s: missing key %r' % (path, k[:60]))
            else: cmp(a[k], b[k], path + '.' + k[:40])
        for k in b:
            if k not in a: errors.append('%s: extra key %r' % (path, k[:60]))
    elif isinstance(a, list):
        if len(a) != len(b): errors.append('%s: length %d, expected %d' % (path, len(b), len(a))); return
        for i, (x, y) in enumerate(zip(a, b)): cmp(x, y, '%s[%d]' % (path, i))
    elif isinstance(a, str):
        if not b.strip(): errors.append('%s: empty' % path)
        if path.startswith('.site'):          # page sentences: links and icons must survive; other markup may follow the language's own conventions
            if icons(a) != icons(b) or links(a) != links(b): errors.append('%s: links or icons differ' % path)
        elif tags(a) != tags(b): errors.append('%s: HTML tags differ' % path)
        if holes(a) != holes(b): errors.append('%s: placeholders differ' % path)
tr.pop('same', None)          # a translator's list of strings that are right as they stand in English
cmp(en, tr, '')
same = sum(1 for a, b in zip(en['titles'], tr['titles']) if a == b)
if same > 20: errors.append('titles: %d are still English' % same)
print('\n'.join(errors[:60]) if errors else 'OK: %s matches en.json' % sys.argv[1])
sys.exit(1 if errors else 0)
