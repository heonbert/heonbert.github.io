"""Build everything that depends on language from i18n/<code>.json.

  exhibition/i18n/<code>.json   words, titles and places for the 3D exhibition
  exhibition/i18n/langs.json    the list of languages
  data/i18n.json                the few strings the 2D motion layer needs, per language, plus the language list
  <code>/*.html                 the 2D pages of every language that has no hand-written pages (built from en/)

Hand-written languages (ko at the root, en, ja, de) are left as they are.
Usage: python tools/build_i18n.py
"""
import io, json, os, re, sys
from bs4 import BeautifulSoup

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from i18n_extract import walk, norm, PAGES

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://seungheon.com'
LANGS = [
    dict(code='ko', name='한국어'), dict(code='en', name='English'), dict(code='ja', name='日本語'), dict(code='de', name='Deutsch'),
    dict(code='zh', name='简体中文', html='zh-Hans'), dict(code='zh-tw', name='繁體中文', html='zh-Hant'),
    dict(code='es', name='Español'), dict(code='fr', name='Français'), dict(code='pt', name='Português'), dict(code='it', name='Italiano'),
    dict(code='ru', name='Русский'), dict(code='ar', name='العربية', dir='rtl'), dict(code='hi', name='हिन्दी'),
    dict(code='id', name='Bahasa Indonesia'), dict(code='vi', name='Tiếng Việt'), dict(code='tr', name='Türkçe'),
]
HAND = {'ko', 'en', 'ja', 'de'}
OG_LOCALE = {'zh': 'zh_CN', 'zh-tw': 'zh_TW', 'es': 'es_ES', 'fr': 'fr_FR', 'pt': 'pt_BR', 'it': 'it_IT', 'ru': 'ru_RU',
             'ar': 'ar_AR', 'hi': 'hi_IN', 'id': 'id_ID', 'vi': 'vi_VN', 'tr': 'tr_TR'}


def rd(p): return io.open(os.path.join(ROOT, p), encoding='utf-8').read()
def wr(p, s):
    full = os.path.join(ROOT, p)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with io.open(full, 'w', encoding='utf-8', newline='\n') as f: f.write(s)
def dump(obj): return json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
def page_url(code, page): return '%s/%s%s' % (SITE, '' if code == 'ko' else code + '/', '' if page == 'index.html' else page)


have = [l for l in LANGS if os.path.exists(os.path.join(ROOT, 'i18n', l['code'] + '.json'))]
docs = {l['code']: json.loads(rd('i18n/%s.json' % l['code'])) for l in have}
print('languages:', ' '.join(l['code'] for l in have))

# ---- exhibition
for code, d in docs.items():
    wr('exhibition/i18n/%s.json' % code, dump(dict(ui=d['ui'], titles=d['titles'], places=d['places'])))
wr('exhibition/i18n/langs.json', dump(have))
wr('data/i18n.json', dump(dict(langs=have, motion={c: d['motion'] for c, d in docs.items()})))

# ---- captions of the front-page hero, in every language
hero = json.loads(rd('data/hero.json'))
by_id = {p['id']: p for p in json.loads(rd('data/photos.json'))['photos']}
for item in hero:
    p = by_id[item['id']]
    item['t'] = {c: [d['titles'][p['n'] - 1], d['places'].get(p['place_en']) if p['place_en'] else None] for c, d in docs.items()}
wr('data/hero.json', json.dumps(hero, ensure_ascii=False, indent=1) + '\n')

# ---- 2D pages for the generated languages
en_site = docs['en']['site']
cat = json.loads(rd('data/photos.json'))['photos']
title_by_file = {os.path.basename(p['file']): p['n'] - 1 for p in cat}


def links(soup, code, page):
    """hreflang alternates for every language, canonical, and the plain language links."""
    for l in soup.find_all('link', rel='alternate'):
        l.decompose()
    canon = soup.find('link', rel='canonical')
    canon['href'] = page_url(code, page)
    last = canon
    for l in have + [dict(code='x-default')]:
        tag = soup.new_tag('link', rel='alternate', hreflang=l.get('html', l['code']), href=page_url('ko' if l['code'] == 'x-default' else l['code'], page))
        last.insert_after('\n    ', tag)
        last = tag
    og = soup.find('meta', property='og:url')
    if og: og['content'] = page_url(code, page)
    loc = soup.find('meta', property='og:locale')
    if loc and code in OG_LOCALE: loc['content'] = OG_LOCALE[code]


def build_page(code, page, tr):
    soup = BeautifulSoup(rd('en/' + page), 'html.parser')
    info = next(l for l in have if l['code'] == code)
    soup.html['lang'] = info.get('html', code)
    if info.get('dir'): soup.html['dir'] = info['dir']
    missing = []

    def unit(el):
        key = norm(el.decode_contents())
        if key in tr:
            el.clear()
            el.append(BeautifulSoup(tr[key], 'html.parser'))
        elif key in en_site:
            missing.append(key)

    def attr(el, a):
        key = norm(el[a])
        if key in tr: el[a] = BeautifulSoup(tr[key], 'html.parser').get_text()
        elif key in en_site: missing.append(key)
    walk(soup, unit, attr)

    # photograph titles in the albums
    titles = docs[code]['titles']
    for img in soup.select('img.gallery-image'):
        i = title_by_file.get(os.path.basename(img['src']))
        if i is not None: img['alt'] = titles[i]
    # the gate
    g = docs[code]['gate']
    nav = soup.select_one('nav.gate')
    if nav:
        nav['aria-label'] = g['label']
        for door, key in ((nav.select_one('.door-3d'), 'd3'), (nav.select_one('.door-2d'), 'd2')):
            for el, text in zip(door.find_all(['span', 'strong'], recursive=False), g[key]):
                el.string = text
            if key == 'd3': door['href'] = '../exhibition/?lang=' + code
    # language links (motion.js turns these into one menu)
    sw = soup.select_one('.lang-switcher')
    if sw:
        sw.clear()
        name = 'index.html' if page == 'index.html' else page
        for l in have:
            a = soup.new_tag('a', href=('../' * (page.count('/') + 1)) + ('' if l['code'] == 'ko' else l['code'] + '/') + name)
            a.string = l['code'].upper()
            if l['code'] == code:
                a['class'] = 'active'; a['aria-current'] = 'page'
            sw.append(a); sw.append(' ')
    links(soup, code, page)
    out = str(soup)
    out = out.replace("lang === 'ko'", "lang === 'ko'")
    wr('%s/%s' % (code, page), out)
    return missing


total_missing = {}
for l in have:
    code = l['code']
    if code in HAND:
        continue
    tr = docs[code].get('site', {})
    for page in PAGES:
        miss = build_page(code, page, tr)
        if miss: total_missing.setdefault(code, set()).update(miss)
    print('built', code, len(PAGES), 'pages', 'missing %d' % len(total_missing.get(code, ())))
for code, miss in total_missing.items():
    for m in sorted(miss)[:5]: print('  missing in', code, ':', m[:80])

# ---- sitemap: one entry per page and language, with alternates
rows = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"', '        xmlns:xhtml="http://www.w3.org/1999/xhtml">']
for page in PAGES:
    for l in have:
        rows.append('  <url>\n    <loc>%s</loc>' % page_url(l['code'], page))
        for a in have:
            rows.append('    <xhtml:link rel="alternate" hreflang="%s" href="%s"/>' % (a.get('html', a['code']), page_url(a['code'], page)))
        rows.append('    <xhtml:link rel="alternate" hreflang="x-default" href="%s"/>\n  </url>' % page_url('ko', page))
rows.append('  <url>\n    <loc>%s/exhibition/</loc>\n  </url>\n</urlset>' % SITE)
wr('sitemap.xml', '\n'.join(rows) + '\n')
print('sitemap urls', len(PAGES) * len(have) + 1)
