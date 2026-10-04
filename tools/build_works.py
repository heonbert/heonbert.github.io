"""Give every photograph a page of its own, with a permanent address, in every language.

  works/<album>/<name>.html            Korean
  <code>/works/<album>/<name>.html     every other language

Each page carries the picture, what is known about it, how to credit it, and machine-readable
licence data (schema.org ImageObject), so that the photographer's name travels with the image.
Usage: python tools/build_works.py
"""
import json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import ROOT, SITE, ALBUMS, OG_LOCALE, GLOBE, rd, wr, load, have_langs, html_lang, lang_info, page_url, hreflang, lang_nav, labels_script, font_preload, esc

CC = 'https://creativecommons.org/licenses/by/4.0/'


def slug(stem): return re.sub(r'[^A-Za-z0-9_-]+', '-', stem).strip('-')
def work_page(p): return 'works/%s/%s.html' % (p['album'], slug(p['id'].split('/')[1]))
def q(path): return path.replace(' ', '%20')
def fmt_date(s): return s[:10].replace('-', '.') if s else None


def render(code, doc, en, p, prev, nxt):
    L = {**en['labels'], **doc.get('labels', {})}
    ui = doc['ui']
    page = work_page(p)
    up = '../../' if code == 'ko' else '../../../'
    title = doc['titles'][p['n'] - 1]
    place = doc['places'].get(p['place_en']) if p['place_en'] else None
    year = (p['taken'] or '')[:4]
    own = p['title_by'] == 'yumok'
    award = ui['prize'].get(str(p['n']))
    note = award or (ui['self'] if p['self_portrait'] else None)
    album = ui['halls'][p['album']]
    url = page_url(code, page)
    desc = ' · '.join(x for x in [L['workDesc'].replace('{title}', title), place, fmt_date(p['taken']), award, None if p['people'] else 'CC BY 4.0'] if x)
    exp = ' · '.join(x for x in [p['focal_length_mm'] and '%dmm' % round(p['focal_length_mm']), p['f_number'] and 'f/%g' % p['f_number'],
                                 p['exposure_s'] and '%ss' % p['exposure_s'], p['iso'] and 'ISO %s' % p['iso']] if x)
    rows = [(ui['taken'], fmt_date(p['taken'])), (ui['place'], place), (ui['camera'], p['camera']), (ui['lens'], p['lens']), (ui['settings'], exp),
            (L['fileNo'], p['id'].split('/')[1])]
    cite = L['citeLine'].replace('{title}', title)
    cite = cite.replace('{year}', year) if year else re.sub(r'[,،、，]?\s*\{year\}', '', cite)
    creator_name = '이동주' if code == 'ko' else doc.get('site', {}).get('Lee Dong-joo', 'Lee Dong-joo')
    credit_text = '유목(流木) 이동주' if code == 'ko' else 'Yumok (流木) Lee Dong-joo'
    ld = {
        '@context': 'https://schema.org', '@type': 'ImageObject', 'name': title, 'description': desc, 'url': url,
        'contentUrl': SITE + '/' + q(p['file']), 'thumbnailUrl': SITE + '/' + q(p['thumb']), 'width': p['width'], 'height': p['height'],
        'encodingFormat': 'image/jpeg', 'inLanguage': html_lang(code),
        'creator': {'@type': 'Person', 'name': creator_name, 'alternateName': 'Yumok (流木)', 'birthDate': '1952', 'deathDate': '2024', 'url': page_url(code, 'about.html')},
        'creditText': credit_text, 'copyrightNotice': credit_text + ' (1952-2024)',
        'isPartOf': {'@type': 'ImageGallery', 'name': album, 'url': page_url(code, 'albums/%s.html' % p['album'])},
    }
    if not p['people']:
        ld['license'] = CC; ld['acquireLicensePage'] = page_url(code, 'license.html')
    if p['taken']: ld['dateCreated'] = p['taken']
    if place: ld['contentLocation'] = {'@type': 'Place', 'name': place}
    if award: ld['award'] = award
    exif = [(n, v) for n, v in (('Camera', p['camera']), ('Lens', p['lens']), ('Focal length', p['focal_length_mm'] and '%g mm' % p['focal_length_mm']),
                                ('Exposure time', p['exposure_s'] and '%s s' % p['exposure_s']), ('F-number', p['f_number'] and 'f/%g' % p['f_number']), ('ISO', p['iso'])) if v]
    if exif: ld['exifData'] = [{'@type': 'PropertyValue', 'name': n, 'value': str(v)} for n, v in exif]
    info = lang_info(code)
    nav = []
    if prev: nav.append('<a rel="prev" href="%s.html">%s</a>' % (slug(prev['id'].split('/')[1]), esc(doc['titles'][prev['n'] - 1])))
    else: nav.append('<span></span>')
    nav.append('<a class="work-up" href="../../albums/%s.html">%s</a>' % (p['album'], esc(album)))
    if nxt: nav.append('<a rel="next" href="%s.html">%s</a>' % (slug(nxt['id'].split('/')[1]), esc(doc['titles'][nxt['n'] - 1])))
    else: nav.append('<span></span>')
    meta_rows = '\n'.join('                    <dt>%s</dt><dd>%s</dd>' % (esc(k), esc(str(v))) for k, v in rows if v)
    credit = ('<p class="work-credit"><a href="../../license.html">%s</a></p>' % esc(L['license'])) if p['people'] else '<p class="work-credit">%s</p>' % esc(ui['credit'])
    preload = font_preload(code, page)
    return '''<!DOCTYPE html>
<html lang="{lang}"{dir}>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} - {site}</title>
    <meta name="description" content="{desc}">
    <link rel="canonical" href="{url}">
{hreflang}
    <link rel="icon" type="image/x-icon" href="{up}favicon.ico">
    <link rel="icon" type="image/png" sizes="32x32" href="{up}favicon-32x32.png">
    <link rel="apple-touch-icon" sizes="180x180" href="{up}apple-touch-icon.png">
    <link rel="manifest" href="{up}site.webmanifest">
    <meta name="theme-color" content="#0a0e14">
    <meta property="og:type" content="article">
    <meta property="og:title" content="{title}">
    <meta property="og:description" content="{desc}">
    <meta property="og:url" content="{url}">
    <meta property="og:image" content="{image}">
    <meta property="og:image:width" content="{w}">
    <meta property="og:image:height" content="{h}">
    <meta property="og:image:alt" content="{title}">
    <meta property="og:locale" content="{locale}">
    <meta property="og:site_name" content="{site}">
    <meta name="twitter:card" content="summary_large_image">
    <script type="application/ld+json">{ld}</script>
{preload}    <link rel="stylesheet" href="{up}style.css">
    <link rel="stylesheet" href="{up}motion.css">
</head>
<body class="work-page">
    <a href="#main-content" class="skip-link">{skip}</a>
    <header>
        {langnav}
        <p class="work-site"><a href="../../index.html">{site}</a></p>
        <h1>{title}</h1>
        <p>{sub}</p>
        <a href="../../albums/{album_id}.html" class="home-link">{album}</a>
    </header>
    <main id="main-content">
        <section class="work">
            <figure class="work-figure">
                <a href="{up}{file}"><img src="{up}{view}" width="{w}" height="{h}" alt="{title}"></a>
            </figure>
            <div class="work-info">
                <p class="work-by{own_cls}">{by}</p>
                <dl class="work-meta">
{meta}
                </dl>
                <p class="work-actions">
                    <a class="work-btn" href="{up}exhibition/?lang={code}#{id}">{in3d}</a>
                    <a class="work-btn" href="{up}{file}" download>{download}</a>
                </p>
                <h2>{cite_h}</h2>
                <p class="work-cite">{cite}</p>
                {credit}
            </div>
        </section>
        <nav class="work-nav" aria-label="{album}">
            {nav}
        </nav>
    </main>
    <footer>
        <p>&copy; {site} · <a href="../../license.html">{license}</a> · <a href="../../license.html#privacy">{privacy}</a> · <a href="../../about.html">{about}</a></p>
        <p class="footer-contact"></p>
    </footer>
    <script src="{up}contact.js"></script>
    <script type="module" src="{up}motion.js"></script>
</body>
</html>
'''.format(
        lang=html_lang(code), dir=' dir="rtl"' if info.get('dir') else '', title=esc(title), site=esc(L['siteName']), desc=esc(desc), url=url,
        hreflang=hreflang(page), up=up, image=SITE + '/' + q(p['file']), w=p['width'], h=p['height'], locale=OG_LOCALE[code],
        ld=json.dumps(ld, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/'), preload='    ' + preload + '\n' if preload else '',
        skip=esc(L['skip']), langnav=lang_nav(code, page, L['langLabel']), sub=esc(' · '.join(x for x in [note, place, year] if x) or album),
        album_id=p['album'], album=esc(album), file=q(p['file']), view=q(p['view']), own_cls=' own' if own else '',
        by=esc(ui['own'] if own else ui['ai']), meta=meta_rows, code=code, id=q(p['id']), in3d=esc(L['in3d']), download=esc(L['download']),
        cite_h=esc(L['cite']), cite=esc(cite), credit=credit, nav='\n            '.join(nav), license=esc(L['license']), privacy=esc(L['privacy']),
        about=esc(L['about']))


def main():
    cat = json.loads(rd('data/photos.json'))['photos']
    en = load('en')
    count = 0
    for l in have_langs():
        code = l['code']
        doc = load(code)
        doc['ui'] = {**en['ui'], **doc['ui']}
        for k in ('halls', 'prize'): doc['ui'][k] = {**en['ui'][k], **doc['ui'].get(k, {})}
        doc['titles'] = doc['titles'] + en['titles'][len(doc['titles']):]
        for alb in ALBUMS:
            works = [p for p in cat if p['album'] == alb]
            for i, p in enumerate(works):
                html = render(code, doc, en, p, works[i - 1] if i else None, works[i + 1] if i + 1 < len(works) else None)
                wr(('' if code == 'ko' else code + '/') + work_page(p), html)
                count += 1
    print(count, 'work pages')


if __name__ == '__main__':
    main()
