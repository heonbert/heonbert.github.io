"""Keep the parts that must be the same on every hand-written page (Korean and English) in step:

  - no analytics script, no third-party connections
  - hreflang links to all languages
  - the language menu
  - the labels the page scripts use, and the Korean font preload

Idempotent. The other languages are built from the English pages by build_i18n.py and get the same pieces there.
Usage: python tools/apply_common.py
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import ROOT, HAND, rd, wr, load, have_langs, hreflang, lang_nav, labels_script, font_preload, up
from i18n_extract import PAGES

GA = re.compile(r'\n?[ \t]*<!-- Google Analytics -->\s*<script async src="https://www\.googletagmanager\.com[^>]*></script>\s*<script>.*?</script>', re.S)
HINT = re.compile(r'[ \t]*<link rel="(?:preconnect|dns-prefetch)" href="https://(?:www\.googletagmanager\.com|cdn\.jsdelivr\.net)"[^>]*>\n')
ALT = re.compile(r'[ \t]*(?:<!-- hreflang -->\n[ \t]*)?<link rel="alternate" hreflang="[^"]*" href="[^"]*">\n')
CANON = re.compile(r'([ \t]*)<link rel="canonical" href="[^"]*">\n')
NAV = re.compile(r'<nav class="lang-switcher" aria-label="([^"]*)">.*?</nav>', re.S)
LABELS = re.compile(r'[ \t]*<script id="yumok-labels">.*?</script>\n', re.S)
HERO = re.compile(r'[ \t]*<link rel="preload" as="image"[^>]*>\n')
PRELOAD = re.compile(r'[ \t]*<link rel="preload" href="[^"]*yumok-batang-core[^"]*"[^>]*>\n')
STYLE = re.compile(r'([ \t]*)<link rel="stylesheet" href="[^"]*style\.css">\n')
FIRST_SCRIPT = re.compile(r'([ \t]*)<script(?: src="[^"]*(?:popup_gallery|bookmark)\.js")?>', re.S)


def normalise(html, code, page, doc):
    html = GA.sub('', html)
    html = HINT.sub('', html)
    html = re.sub(r'<head>\n(\s*<meta charset="UTF-8">\n)\n+', r'<head>\n\1', html)
    # hreflang, straight after the canonical link
    html = ALT.sub('', html)
    m = CANON.search(html)
    assert m, page
    html = html[:m.end()] + hreflang(page, m.group(1)) + '\n' + html[m.end():]
    # language menu
    m = NAV.search(html)
    assert m, page
    indent = html[html.rfind('\n', 0, m.start()) + 1:m.start()]
    html = html[:m.start()] + lang_nav(code, page, m.group(1), indent) + html[m.end():]
    # font preload, just before the stylesheet
    html = PRELOAD.sub('', html)
    pre = font_preload(code, page)
    if pre:
        m = STYLE.search(html)
        html = html[:m.start()] + m.group(1) + pre + '\n' + html[m.start():]
    # the front page asks early for the first picture of its hero
    html = HERO.sub('', html)
    if page == 'index.html':
        first = json.loads(rd('data/hero.json'))[0]['file']
        m = STYLE.search(html)
        html = html[:m.start()] + m.group(1) + '<link rel="preload" as="image" href="%s%s" fetchpriority="high">' % (up(code, page), first) + chr(10) + html[m.start():]
    # labels for the page scripts, before the first of them
    html = LABELS.sub('', html)
    body = html.index('<body')
    m = re.search(r'([ \t]*)<script src="[^"]*(?:popup_gallery|bookmark)\.js"></script>', html[body:])
    assert m, page
    at = body + m.start()
    html = html[:at] + m.group(1) + labels_script(code, doc) + '\n' + html[at:]
    # structured data: the site exists in every language
    codes = ', '.join('"%s"' % l['code'] for l in have_langs())
    html = re.sub(r'"inLanguage": \[[^\]]*\]', '"inLanguage": [%s]' % codes, html)
    return html


def main():
    for code in HAND:
        doc = load(code)
        for page in PAGES:
            path = ('' if code == 'ko' else code + '/') + page
            if not os.path.exists(os.path.join(ROOT, path)):
                print('no page yet:', path); continue
            html = rd(path)
            out = normalise(html, code, page, doc)
            if out != html: wr(path, out)
    print('common parts applied to', ', '.join(HAND))


if __name__ == '__main__':
    main()
