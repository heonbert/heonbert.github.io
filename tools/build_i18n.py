"""Build everything that depends on language from i18n/<code>.json.

  exhibition/i18n/<code>.json   words, titles and places for the 3D exhibition
  exhibition/i18n/langs.json    the list of languages
  data/i18n.json                the few strings the 2D motion layer needs, per language, plus the language list
  data/hero.json                captions of the front-page pictures in every language
  <code>/*.html                 the 2D pages of every language except Korean and English (built from en/)

Korean (at the root) and English (en/) are written by hand and left as they are.
Usage: python tools/build_i18n.py
"""
import json, os, re, sys
from bs4 import BeautifulSoup

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import ROOT, SITE, HAND, OG_LOCALE, rd, wr, load, have_langs, html_lang, page_url, hreflang, lang_nav, labels_script
from i18n_extract import walk, walk_ld, unit_key, fill_unit, norm, PAGES

dump = lambda obj: json.dumps(obj, ensure_ascii=False, separators=(',', ':'))


def build_page(code, page, doc, en_site, cat):
    tr = doc.get('site', {})
    info = next(l for l in have_langs() if l['code'] == code)
    soup = BeautifulSoup(rd('en/' + page), 'html.parser')
    soup.html['lang'] = html_lang(code)
    if info.get('dir'): soup.html['dir'] = info['dir']
    missing = []

    def text(key):
        if key in tr: return tr[key]
        if key in en_site: missing.append(key)
        return None

    def unit(el):
        t = text(unit_key(el))
        if t is not None: fill_unit(el, t)

    def attr(el, a):
        t = text(norm(el[a]))
        if t is not None: el[a] = BeautifulSoup(t, 'html.parser').get_text()
    walk(soup, unit, attr)

    # structured data
    def ld(o, k):
        t = text(norm(o[k]))
        if t is not None: o[k] = BeautifulSoup(t, 'html.parser').get_text()
    for script, data in walk_ld(soup, ld):
        def fix(o):
            if isinstance(o, dict):
                for k, v in o.items():
                    if k in ('url', 'item') and isinstance(v, str) and v.startswith(SITE + '/en/'): o[k] = v.replace(SITE + '/en/', SITE + '/' + code + '/')
                    elif k == 'inLanguage' and isinstance(v, str): o[k] = html_lang(code)
                    else: fix(v)
            elif isinstance(o, list):
                for v in o: fix(v)
        fix(data)
        script.string = '\n    ' + json.dumps(data, ensure_ascii=False, indent=4).replace('\n', '\n    ') + '\n    '

    # photograph titles and notes in the albums
    ui = doc['ui']
    for img in soup.select('img.gallery-image'):
        n = int(img['data-n']); p = cat[n - 1]
        img['alt'] = doc['titles'][n - 1]
        note = ui['prize'].get(str(n)) or (ui['self'] if p['self_portrait'] else None)
        if note: img['data-note'] = note
        elif img.has_attr('data-note'): del img['data-note']
    # the gate
    g = doc['gate']
    nav = soup.select_one('nav.gate')
    if nav:
        nav['aria-label'] = g['label']
        for door, key in ((nav.select_one('.door-3d'), 'd3'), (nav.select_one('.door-2d'), 'd2')):
            for el, t in zip(door.find_all(['span', 'strong'], recursive=False), g[key]):
                el.string = t
            if key == 'd3': door['href'] = '../exhibition/?lang=' + code
    # the language menu
    sw = soup.select_one('nav.lang-switcher')
    if sw:
        sw.replace_with(BeautifulSoup(lang_nav(code, page, doc['labels']['langLabel']), 'html.parser'))
    # labels for the page scripts
    tag = soup.find('script', id='yumok-labels')
    if tag: tag.replace_with(BeautifulSoup(labels_script(code, doc), 'html.parser'))
    # canonical, hreflang, Open Graph
    for l in soup.find_all('link', rel='alternate'):
        if l.get('hreflang'): l.decompose()
    canon = soup.find('link', rel='canonical')
    canon['href'] = page_url(code, page)
    canon.insert_after(BeautifulSoup('\n' + hreflang(page), 'html.parser'))
    og = soup.find('meta', property='og:url')
    if og: og['content'] = page_url(code, page)
    loc = soup.find('meta', property='og:locale')
    if loc: loc['content'] = OG_LOCALE[code]
    out = re.sub(r'\n[ \t]*\n[ \t]*\n+', '\n\n', str(soup))
    wr('%s/%s' % (code, page), out)
    return missing


def main():
    have = have_langs()
    docs = {l['code']: load(l['code']) for l in have}
    cat = json.loads(rd('data/photos.json'))['photos']
    en = docs['en']
    full = lambda d, sec: {**en[sec], **d.get(sec, {})}                 # a language still being translated falls back to English
    print('languages:', ' '.join(docs))

    # ---- exhibition
    for code, d in docs.items():
        ui = {**en['ui'], **d['ui']}
        for k in ('halls', 'hallText', 'hallNote', 'prize'): ui[k] = {**en['ui'][k], **d['ui'].get(k, {})}
        titles = d['titles'] + en['titles'][len(d['titles']):]
        wr('exhibition/i18n/%s.json' % code, dump(dict(ui=ui, titles=titles, places=d['places'], labels={k: full(d, 'labels')[k] for k in ('page', 'download', 'siteName')})))
        d['ui'], d['titles'], d['labels'] = ui, titles, full(d, 'labels')
    wr('exhibition/i18n/langs.json', dump(have))
    wr('data/i18n.json', dump(dict(langs=have, motion={c: d['motion'] for c, d in docs.items()},
                                   suggest={c: [d['labels']['suggest'], d['labels']['close']] for c, d in docs.items()})))

    # ---- captions of the front-page hero, in every language
    hero = json.loads(rd('data/hero.json'))
    for item in hero:
        p = cat[item['n'] - 1]
        item['t'] = {c: [d['titles'][p['n'] - 1], d['places'].get(p['place_en']) if p['place_en'] else None] for c, d in docs.items()}
    wr('data/hero.json', json.dumps(hero, ensure_ascii=False, indent=1) + '\n')

    # ---- 2D pages for every language built from English
    total = {}
    for l in have:
        code = l['code']
        if code in HAND: continue
        for page in PAGES:
            miss = build_page(code, page, docs[code], en['site'], cat)
            if miss: total.setdefault(code, set()).update(miss)
        print('built %-6s %d pages%s' % (code, len(PAGES), ', %d strings still in English' % len(total[code]) if code in total else ''))
    return total


if __name__ == '__main__':
    main()
