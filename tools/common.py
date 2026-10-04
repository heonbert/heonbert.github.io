"""Things every build tool shares: where the site lives, its languages, and the pieces of markup that must be
identical on every page (the language menu, the hreflang links, the labels handed to the page scripts)."""
import io, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://seungheon.com'
LANGS = [
    dict(code='ko', name='한국어'), dict(code='en', name='English'), dict(code='ja', name='日本語'), dict(code='de', name='Deutsch'),
    dict(code='zh', name='简体中文', html='zh-Hans'), dict(code='zh-tw', name='繁體中文', html='zh-Hant'),
    dict(code='es', name='Español'), dict(code='fr', name='Français'), dict(code='pt', name='Português'), dict(code='it', name='Italiano'),
    dict(code='ru', name='Русский'), dict(code='ar', name='العربية', dir='rtl'), dict(code='hi', name='हिन्दी'),
    dict(code='id', name='Bahasa Indonesia'), dict(code='vi', name='Tiếng Việt'), dict(code='tr', name='Türkçe'),
]
HAND = ('ko', 'en')            # written by hand; every other language is built from the English pages
ALBUMS = ['abstract', 'reflection', 'pattern', 'landscape', 'awards']
OG_LOCALE = {'ko': 'ko_KR', 'en': 'en_US', 'ja': 'ja_JP', 'de': 'de_DE', 'zh': 'zh_CN', 'zh-tw': 'zh_TW', 'es': 'es_ES', 'fr': 'fr_FR',
             'pt': 'pt_BR', 'it': 'it_IT', 'ru': 'ru_RU', 'ar': 'ar_AR', 'hi': 'hi_IN', 'id': 'id_ID', 'vi': 'vi_VN', 'tr': 'tr_TR'}
GLOBE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.2 3 3.2 15 0 18M12 3c-3.2 3-3.2 15 0 18"/></svg>'
# what the page scripts (popup, bookmark, language suggestion) need from i18n/<code>.json `labels`
SCRIPT_LABELS = ['viewer', 'prev', 'next', 'close', 'download', 'share', 'page', 'copied', 'bm_desktop', 'bm_mac', 'bm_ios', 'bm_android',
                 'bm_installed', 'bm_already', 'bm_running']


def rd(p): return io.open(os.path.join(ROOT, p), encoding='utf-8').read()
def wr(p, s):
    full = os.path.join(ROOT, p)
    os.makedirs(os.path.dirname(full) or ROOT, exist_ok=True)
    with io.open(full, 'w', encoding='utf-8', newline='\n') as f: f.write(s)
def load(code): return json.loads(rd('i18n/%s.json' % code))
def have_langs(): return [l for l in LANGS if os.path.exists(os.path.join(ROOT, 'i18n', l['code'] + '.json'))]
def lang_info(code): return next(l for l in LANGS if l['code'] == code)
def html_lang(code): return lang_info(code).get('html', code)
def esc(s): return s.replace('&', '&amp;').replace('"', '&quot;').replace('<', '&lt;').replace('>', '&gt;')


def page_url(code, page):
    """Public address of a page ('index.html', 'albums/abstract.html', 'works/abstract/x.html') in one language."""
    path = '' if page == 'index.html' else page
    return '%s/%s%s' % (SITE, '' if code == 'ko' else code + '/', path)


def up(code, page):
    """Relative prefix from a page to the site root."""
    depth = page.count('/') + (0 if code == 'ko' else 1)
    return '../' * depth


def hreflang(page, indent='    '):
    rows = ['%s<link rel="alternate" hreflang="%s" href="%s">' % (indent, html_lang(l['code']), page_url(l['code'], page)) for l in have_langs()]
    rows.append('%s<link rel="alternate" hreflang="x-default" href="%s">' % (indent, page_url('ko', page)))
    return '\n'.join(rows)


def lang_nav(code, page, label, indent='        '):
    """The language menu. A <details> element, so it works without scripts; motion.js only adds comfort."""
    root = up(code, page)
    rows = []
    for l in have_langs():
        cur = l['code'] == code
        rows.append('%s        <a href="%s%s%s" lang="%s" hreflang="%s"%s>%s</a>' % (
            indent, root, '' if l['code'] == 'ko' else l['code'] + '/', page, html_lang(l['code']), html_lang(l['code']),
            ' class="active" aria-current="page"' if cur else '', l['name']))
    return ('<nav class="lang-switcher" aria-label="%s">\n%s    <details class="lang-menu">\n%s        <summary>%s<span>%s</span></summary>\n'
            '%s        <div class="lang-list">\n%s\n%s        </div>\n%s    </details>\n%s</nav>') % (
        esc(label), indent, indent, GLOBE, lang_info(code)['name'], indent, '\n'.join('    ' + r for r in rows), indent, indent, indent)


def labels_script(code, doc):
    data = {k: doc['labels'][k] for k in SCRIPT_LABELS}
    return '<script id="yumok-labels">window.YUMOK_LABELS = %s;</script>' % json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')


def font_preload(code, page):
    """Korean pages fetch the Korean serif early; nobody else needs it."""
    if code != 'ko': return ''
    fonts = json.loads(rd('data/fonts.json'))
    return '<link rel="preload" href="%s%s" as="font" type="font/woff2" crossorigin>' % (up(code, page), fonts['core'])
