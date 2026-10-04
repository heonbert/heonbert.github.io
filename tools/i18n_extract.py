"""Collect every string of the site into one file per base language: i18n/ko.json, en.json, ja.json, de.json.

Sections of each file:
  ui      words of the 3D exhibition
  motion  the visitor and flower line on the front page
  gate    the two doors on the front page
  titles  the 282 photograph titles, in catalogue order
  places  place names, keyed by their English form
  site    (en only) every sentence of the 2D pages, keyed by the English text; other languages are built from these

Run once to create the base files. After that the JSON files are the source of truth.
Usage: python tools/i18n_extract.py path/to/ui_dump.json
"""
import io, json, os, re, sys
from bs4 import BeautifulSoup, NavigableString, Comment

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = ['ko', 'en', 'ja', 'de']
PAGES = ['index.html', 'about.html', 'license.html', 'albums/abstract.html', 'albums/reflection.html',
         'albums/pattern.html', 'albums/landscape.html']

MOTION = {
    'ko': dict(count='헌화 {f}송이 · 방문 {v}명', now='지금 전시관에 {n}명', offer='헌화하기', done='꽃을 놓았습니다'),
    'en': dict(count='{f} flowers · {v} visitors', now='{n} in the hall now', offer='Lay a flower', done='Your flower is laid'),
    'ja': dict(count='献花 {f}輪 · 来訪 {v}人', now='いま展示館に{n}人', offer='献花する', done='花を手向けました'),
    'de': dict(count='{f} Blumen · {v} Besucher', now='Jetzt {n} in der Halle', offer='Blume niederlegen', done='Ihre Blume liegt dort'),
}
GATE = {
    'ko': dict(label='전시 입장', d3=['걸어서 보는', '3D 전시관', '전시실을 거닐며 한 점씩 마주합니다', '입장'],
               d2=['한눈에 보는', '2D 갤러리', '앨범별로 282점을 펼쳐 봅니다', '보기']),
    'en': dict(label='Enter the exhibition', d3=['Walk through', '3D Exhibition', 'Stroll the halls and meet each work', 'Enter'],
               d2=['At a glance', '2D Gallery', 'Browse all 282 photographs by album', 'View']),
    'ja': dict(label='展示への入口', d3=['歩いて観る', '3D展示館', '展示室を巡り、一点ずつ向き合います', '入場'],
               d2=['一望する', '2Dギャラリー', 'アルバムごとに282点を見渡します', '見る']),
    'de': dict(label='Zur Ausstellung', d3=['Zu Fuß', '3D-Ausstellung', 'Durch die Säle gehen und jedem Bild begegnen', 'Eintreten'],
               d2=['Auf einen Blick', '2D-Galerie', 'Alle 282 Fotografien nach Alben', 'Ansehen']),
}

INLINE = {'strong', 'b', 'em', 'i', 'sub', 'sup', 'a', 'br', 'span', 'small'}
UNIT = {'p', 'li', 'h1', 'h2', 'h3', 'h4', 'dt', 'dd', 'a', 'button', 'span', 'figcaption', 'title', 'label', 'summary', 'strong', 'small', 'div', 'time'}
ATTRS = ['alt', 'aria-label', 'title', 'placeholder']
META = {'description', 'keywords', 'og:title', 'og:description', 'og:site_name', 'twitter:title', 'twitter:description'}
norm = lambda s: re.sub(r'\s+', ' ', s).strip()
has_words = lambda s: bool(re.search(r'[A-Za-z]{2}', re.sub(r'<[^>]+>', '', s)))


def is_unit(el):
    """An element whose content is text plus inline tags only: translated as one piece, tags kept."""
    if el.name not in UNIT or el.find('svg'):
        return False
    for d in el.descendants:
        if isinstance(d, NavigableString):
            continue
        if d.name not in INLINE:
            return False
    return bool(norm(el.get_text()))


def walk(soup, visit_unit, visit_attr):
    def rec(el):
        if el.name in ('script', 'style', 'svg', 'noscript'):
            return
        for a in ATTRS:
            if el.has_attr(a) and not (el.name == 'img' and 'gallery-image' in (el.get('class') or [])):
                visit_attr(el, a)
        if el.name == 'meta' and (el.get('name') in META or el.get('property') in META) and el.has_attr('content'):
            visit_attr(el, 'content')
        if is_unit(el):
            visit_unit(el)
            return
        for c in list(el.children):
            if not isinstance(c, NavigableString):
                rec(c)
    rec(soup.html)


if __name__ == '__main__':
    ui = json.load(io.open(sys.argv[1], encoding='utf-8'))
    cat = json.load(io.open(os.path.join(ROOT, 'data/photos.json'), encoding='utf-8'))['photos']
    places = {}
    for p in cat:
        if p['place_en']:
            places[p['place_en']] = p['place']
    site = {}
    for page in PAGES:
        soup = BeautifulSoup(io.open(os.path.join(ROOT, 'en', page), encoding='utf-8').read(), 'html.parser')
        def unit(el):
            s = norm(el.decode_contents())
            if has_words(s): site.setdefault(s, s)
        def attr(el, a):
            s = norm(el[a])
            if has_words(s): site.setdefault(s, s)
        walk(soup, unit, attr)
    os.makedirs(os.path.join(ROOT, 'i18n'), exist_ok=True)
    for lang in BASE:
        doc = dict(ui=ui[lang], motion=MOTION[lang], gate=GATE[lang], titles=[p['title'][lang] for p in cat],
                   places={en: (ko if lang == 'ko' else en) for en, ko in places.items()})
        if lang == 'en':
            doc['site'] = site
        with io.open(os.path.join(ROOT, 'i18n', lang + '.json'), 'w', encoding='utf-8', newline='\n') as f:
            json.dump(doc, f, ensure_ascii=False, indent=1)
            f.write('\n')
    print('site strings', len(site), 'chars', sum(len(k) for k in site), 'places', len(places))
