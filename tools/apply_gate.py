"""Write the two-door gate (3D exhibition / 2D gallery) into the four home pages.

Idempotent: the block sits between marker comments and is replaced on re-run.
Usage: python tools/apply_gate.py
"""
import io, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREFIX = {'ko': '', 'en': 'en/', 'ja': 'ja/', 'de': 'de/'}

GATE = {
    'ko': dict(label='전시 입장',
               d3=('걸어서 보는', '3D 전시관', '전시실을 거닐며 한 점씩 마주합니다', '입장'),
               d2=('한눈에 보는', '2D 갤러리', '앨범별로 282점을 펼쳐 봅니다', '보기')),
    'en': dict(label='Enter the exhibition',
               d3=('Walk through', '3D Exhibition', 'Stroll the halls and meet each work', 'Enter'),
               d2=('At a glance', '2D Gallery', 'Browse all 282 photographs by album', 'View')),
    'ja': dict(label='展示への入口',
               d3=('歩いて観る', '3D展示館', '展示室を巡り、一点ずつ向き合います', '入場'),
               d2=('一望する', '2Dギャラリー', 'アルバムごとに282点を見渡します', '見る')),
    'de': dict(label='Zur Ausstellung',
               d3=('Zu Fuß', '3D-Ausstellung', 'Durch die Säle gehen und jedem Bild begegnen', 'Eintreten'),
               d2=('Auf einen Blick', '2D-Galerie', 'Alle 282 Fotografien nach Alben', 'Ansehen')),
}


def door(cls, href, t):
    return ('            <a class="door %s" href="%s">\n'
            '                <span class="door-kicker">%s</span>\n'
            '                <strong>%s</strong>\n'
            '                <span class="door-desc">%s</span>\n'
            '                <span class="door-go">%s</span>\n'
            '            </a>') % (cls, href, t[0], t[1], t[2], t[3])


for lang, pre in PREFIX.items():
    path = os.path.join(ROOT, pre + 'index.html')
    s = io.open(path, encoding='utf-8').read()
    up = '../' if pre else ''
    g = GATE[lang]
    block = ('<!-- gate:start -->\n'
             '        <nav class="gate" aria-label="%s">\n%s\n%s\n        </nav>\n'
             '        <!-- gate:end -->') % (g['label'], door('door-3d', '%sexhibition/?lang=%s' % (up, lang), g['d3']),
                                              door('door-2d', '#main-content', g['d2']))
    # the separate "3D exhibition" section is replaced by the gate
    s = re.sub(r'[ \t]*<!-- exhibition:start -->.*?<!-- exhibition:end -->\n', '', s, flags=re.S)
    if '<!-- gate:start -->' in s:
        s = re.sub(r'<!-- gate:start -->.*?<!-- gate:end -->', lambda m: block, s, flags=re.S)
    else:
        i = s.index('</header>')
        line = s.rfind('\n', 0, i) + 1
        s = s[:line] + '        ' + block + '\n' + s[line:]
    io.open(path, 'w', encoding='utf-8', newline='\n').write(s)
    print('gate written:', pre + 'index.html')
