"""Check that every link inside the site leads somewhere: pages, pictures, scripts, styles, fonts.
Looks at every HTML page of the published site, and at url() in the style sheets. External addresses are not fetched.
Usage: python tools/check_links.py
"""
import os, re, sys
from urllib.parse import unquote, urlsplit

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {'.git', 'node_modules', 'tools', 'realtime', '.claude', '.github'}
ATTR = re.compile(r'''(?:href|src|data-full|data-file|data-page|poster)\s*=\s*"([^"]*)"''')
SRCSET = re.compile(r'srcset\s*=\s*"([^"]*)"')
CSS_URL = re.compile(r'''url\(\s*['"]?([^'")]+)['"]?\s*\)''')
IDS = {}


def ids(path):
    if path not in IDS:
        try: text = open(path, encoding='utf-8').read()
        except Exception: text = ''
        IDS[path] = set(re.findall(r'\bid="([^"]+)"', text))
    return IDS[path]


def target(base, link):
    """The file a link points at, or None for links that leave the site or stay on the page."""
    if not link or link.startswith(('#', 'mailto:', 'tel:', 'data:', 'javascript:', 'blob:')): return None
    parts = urlsplit(link)
    if parts.scheme or link.startswith('//'): return None
    path = unquote(parts.path)
    full = os.path.join(ROOT, path.lstrip('/')) if path.startswith('/') else os.path.normpath(os.path.join(os.path.dirname(base), path))
    if os.path.isdir(full): full = os.path.join(full, 'index.html')
    return full, parts.fragment


def main():
    pages, sheets, problems = [], [], []
    for d, dirs, files in os.walk(ROOT):
        dirs[:] = [x for x in dirs if x not in SKIP_DIRS]
        for f in files:
            if f.endswith('.html'): pages.append(os.path.join(d, f))
            elif f.endswith('.css'): sheets.append(os.path.join(d, f))
    seen = 0
    for page in pages:
        text = open(page, encoding='utf-8').read()
        links = ATTR.findall(text)
        for s in SRCSET.findall(text): links += [part.strip().split(' ')[0] for part in s.split(',')]
        for link in links:
            t = target(page, link.strip())
            if not t: continue
            seen += 1
            full, frag = t
            if not os.path.exists(full): problems.append('%s -> %s' % (os.path.relpath(page, ROOT), link))
            elif frag and full.endswith('.html') and not frag.startswith('img=') and '/' not in frag and frag not in ids(full):
                problems.append('%s -> %s (no such place on the page)' % (os.path.relpath(page, ROOT), link))
    for sheet in sheets:
        for link in CSS_URL.findall(open(sheet, encoding='utf-8').read()):
            t = target(sheet, link)
            if t:
                seen += 1
                if not os.path.exists(t[0]): problems.append('%s -> %s' % (os.path.relpath(sheet, ROOT), link))
    print('%d pages, %d style sheets, %d internal links, %d broken' % (len(pages), len(sheets), seen, len(problems)))
    for p in problems[:40]: print('  ', p)
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
