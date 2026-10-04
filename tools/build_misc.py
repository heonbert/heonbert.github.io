"""Small generated files: the "page not found" page in every language, and the service worker's version stamp.
Usage: python tools/build_misc.py
"""
import hashlib, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import ROOT, rd, wr, load, have_langs, html_lang

PAGE = '''<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>페이지를 찾을 수 없습니다 - 유목의 물빛사진</title>
    <meta name="robots" content="noindex">
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <link rel="stylesheet" href="/style.css">
    <style>
        .error-page { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 72vh; text-align: center; padding: 40px 20px; }
        .error-code { font-size: 6em; font-weight: 300; color: var(--accent); line-height: 1; margin-bottom: 10px; }
        .error-page h1 { margin: 0; font-size: 1.3em; font-weight: 400; letter-spacing: 0.08em; }
        .error-page p { margin: 12px 0 0; color: var(--text-secondary); }
        .error-page .home-link { margin-top: 26px; }
        .error-links { display: flex; gap: 8px 6px; flex-wrap: wrap; justify-content: center; max-width: 640px; margin-top: 44px; }
        .error-links a { color: var(--text-secondary); text-decoration: none; padding: 6px 14px; font-family: var(--sans); font-size: 0.86em; border: 1px solid var(--border); border-radius: 30px; transition: all 0.3s ease; }
        .error-links a:hover { color: var(--accent); background: var(--accent-soft); border-color: var(--accent); }
    </style>
</head>
<body>
    <main id="main-content" class="error-page">
        <div class="error-code">404</div>
        <h1 id="nf-title">페이지를 찾을 수 없습니다 · Page not found</h1>
        <p id="nf-text">주소가 바뀌었거나 없는 페이지입니다.</p>
        <a id="nf-home" class="home-link" href="/">처음으로</a>
        <nav class="error-links" aria-label="Languages">
%s
        </nav>
    </main>
    <footer>
        <p>&copy; <span id="nf-site">유목의 물빛사진</span></p>
    </footer>
    <script>
        // say it in the language of the address that was asked for, or else in the reader's own
        (function() {
            var T = %s;
            var first = location.pathname.split('/')[1];
            var code = T[first] ? first : null;
            if (!code) {
                var prefs = navigator.languages || [navigator.language || 'ko'];
                for (var i = 0; i < prefs.length && !code; i++) {
                    var tag = prefs[i].toLowerCase();
                    if (/^zh-(tw|hk|mo|hant)/.test(tag)) code = 'zh-tw';
                    else if (T[tag]) code = tag;
                    else if (T[tag.slice(0, 2)]) code = tag.slice(0, 2);
                }
            }
            var t = T[code || 'ko'];
            document.documentElement.lang = t[4];
            if (t[5]) document.documentElement.dir = 'rtl';
            document.title = t[0] + ' - ' + t[3];
            document.getElementById('nf-title').textContent = t[0];
            document.getElementById('nf-text').textContent = t[1];
            document.getElementById('nf-site').textContent = t[3];
            var home = document.getElementById('nf-home');
            home.textContent = t[2];
            home.href = code && code !== 'ko' ? '/' + code + '/' : '/';
        })();
    </script>
</body>
</html>
'''


def main():
    langs = have_langs()
    en = load('en')
    table, links = {}, []
    for l in langs:
        L = {**en['labels'], **load(l['code']).get('labels', {})}
        table[l['code']] = [L['notFound'], L['notFoundText'], L['toHome'], L['siteName'], html_lang(l['code']), 1 if l.get('dir') else 0]
        links.append('            <a href="/%s" lang="%s">%s</a>' % ('' if l['code'] == 'ko' else l['code'] + '/', html_lang(l['code']), l['name']))
    wr('404.html', PAGE % ('\n'.join(links), json.dumps(table, ensure_ascii=False, separators=(',', ':'))))

    # the service worker is renewed whenever anything it may have cached has changed
    h = hashlib.sha256()
    for path in ('style.css', 'motion.css', 'motion.js', 'popup_gallery.js', 'bookmark.js', 'data/photos.json', 'data/fonts.json',
                 'exhibition/main.js', 'exhibition/layout.js', 'exhibition/presence.js', 'exhibition/npc.js', 'exhibition/exhibition.css', 'exhibition/index.html'):
        h.update(rd(path).encode('utf-8'))
    sw = rd('sw.js')
    sw2, k = re.subn(r"const VERSION = '[^']*';", "const VERSION = 'yumok-%s';" % h.hexdigest()[:10], sw, count=1)
    assert k == 1
    if sw2 != sw: wr('sw.js', sw2)
    print('404 page in %d languages; service worker %s' % (len(langs), h.hexdigest()[:10]))


if __name__ == '__main__':
    main()
