"""Find every sentence of the English 2D pages (en/) and keep i18n/en.json `site` in step with them.

The English pages are the template for every language except Korean. Each sentence, heading, label and
meta text is keyed by its English wording; i18n/<code>.json `site` maps that wording to the translation.

    python tools/i18n_extract.py          refresh the keys in i18n/en.json (new ones are added, unused ones dropped)

This module is also the shared reader used by build_i18n.py: walk(), walk_ld(), unit_key(), fill_unit().
"""
import io, json, os, re, sys
from bs4 import BeautifulSoup, NavigableString

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = ['index.html', 'about.html', 'license.html', 'albums/abstract.html', 'albums/reflection.html',
         'albums/pattern.html', 'albums/landscape.html', 'albums/awards.html']

INLINE = {'strong', 'b', 'em', 'i', 'sub', 'sup', 'a', 'br', 'span', 'small', 'cite', 'q', 'abbr', 'time'}
UNIT = {'p', 'li', 'h1', 'h2', 'h3', 'h4', 'dt', 'dd', 'a', 'button', 'span', 'figcaption', 'title', 'label', 'summary', 'strong', 'small', 'div', 'time'}
ATTRS = ['alt', 'aria-label', 'title', 'placeholder', 'data-label']
META = {'description', 'keywords', 'og:title', 'og:description', 'og:site_name', 'og:image:alt', 'twitter:title', 'twitter:description', 'author'}
LD_KEYS = {'name', 'description', 'jobTitle', 'award', 'alternateName', 'creditText', 'copyrightNotice'}
norm = lambda s: re.sub(r'\s+', ' ', s).strip()
has_words = lambda s: bool(re.search(r'[A-Za-z]{2}', re.sub(r'<[^>]+>', '', s)))


def atoms(el):
    """Icons inside a sentence (an svg, or a link or button drawn as one). They are not translated:
    translators see them as <x1/>, <x2/>, ... and the build puts the originals back."""
    out = []
    for d in el.find_all(True):
        if d.name == 'svg' or (d.name in INLINE and d.find('svg')):
            if not any(a in out for a in d.parents):
                out.append(d)
    return out


def is_unit(el):
    """An element whose content is text plus inline tags and icons only: translated as one piece, tags kept."""
    if el.name not in UNIT:
        return False
    at = atoms(el)
    inside = set()
    for a in at:
        inside.add(id(a))
        for d in a.descendants: inside.add(id(d))
    text = ''
    for d in el.descendants:
        if id(d) in inside:
            continue
        if isinstance(d, NavigableString):
            text += str(d)
        elif d.name not in INLINE:
            return False
    return bool(norm(text))


def unit_key(el):
    html = el.decode_contents()
    for i, a in enumerate(atoms(el)):
        html = html.replace(str(a), '<x%d/>' % (i + 1), 1)
    return norm(html)


def fill_unit(el, translated):
    """Replace the content of a unit with its translation, putting the icons back."""
    at = [a.extract() for a in atoms(el)]
    el.clear()
    frag = BeautifulSoup(translated, 'html.parser')
    for i, a in enumerate(at):
        slot = frag.find('x%d' % (i + 1))
        if slot is not None: slot.replace_with(a)
        else: frag.append(a)                    # a translation that lost its icon keeps it at the end
    el.append(frag)
    return at


def walk(soup, visit_unit, visit_attr):
    def attrs(el):
        for a in ATTRS:
            if el.has_attr(a) and not (el.name == 'img' and 'gallery-image' in (el.get('class') or [])):
                visit_attr(el, a)
        if el.name == 'meta' and (el.get('name') in META or el.get('property') in META) and el.has_attr('content'):
            visit_attr(el, 'content')

    def rec(el):
        if el.name in ('script', 'style', 'svg', 'noscript'):
            return
        attrs(el)
        if {'lang-switcher', 'gate'} & set(el.get('class') or []):     # the language menu and the gate are rebuilt for each language
            return
        if is_unit(el):
            icons = atoms(el)
            visit_unit(el)
            for a in icons:                      # labels on the icons themselves
                for d in [a] + a.find_all(True): attrs(d)
            return
        for c in list(el.children):
            if not isinstance(c, NavigableString):
                rec(c)
    rec(soup.html)


def walk_ld(soup, visit):
    """Structured data (JSON-LD): visit(obj, key) for each translatable string; returns [(script, data)]."""
    out = []

    def rec(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if isinstance(v, str) and k in LD_KEYS: visit(o, k)
                else: rec(v)
        elif isinstance(o, list):
            for v in o: rec(v)
    for s in soup.find_all('script', type='application/ld+json'):
        try: data = json.loads(s.string)
        except Exception: continue
        rec(data)
        out.append((s, data))
    return out


def page_strings(html):
    """Every translatable string of one page, in document order."""
    soup = BeautifulSoup(html, 'html.parser')
    out = []
    walk(soup, lambda el: out.append(('unit', unit_key(el))), lambda el, a: out.append(('attr', norm(el[a]))))
    walk_ld(soup, lambda o, k: out.append(('ld', norm(o[k]))))
    return out


if __name__ == '__main__':
    path = os.path.join(ROOT, 'i18n', 'en.json')
    doc = json.load(io.open(path, encoding='utf-8'))
    old = doc.get('site', {})
    site = {}
    for page in PAGES:
        p = os.path.join(ROOT, 'en', page)
        if not os.path.exists(p): print('no page yet:', page); continue
        for kind, s in page_strings(io.open(p, encoding='utf-8').read()):
            if has_words(s): site.setdefault(s, s)
    added = [k for k in site if k not in old]
    dropped = [k for k in old if k not in site]
    doc['site'] = site
    with io.open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(doc, f, ensure_ascii=False, indent=1); f.write('\n')
    print('site strings %d (added %d, dropped %d)' % (len(site), len(added), len(dropped)))
    for k in added: print('  +', k[:110])
    for k in dropped: print('  -', k[:110])
