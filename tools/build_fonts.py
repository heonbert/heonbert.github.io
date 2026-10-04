"""Serve the Korean serif from this site, cut down to the letters the site uses.

Source : tools/fonts/IropkeBatangM.woff  (Iropke Batang Medium, SIL Open Font License 1.1, (c) 2016 Iropke)
Output : assets/fonts/yumok-batang-core.<hash>.woff2   every character found in the Korean pages and texts
         assets/fonts/yumok-batang-rest.<hash>.woff2   all other characters of the font; fetched only if a page needs one
         the @font-face rules between the markers in style.css and exhibition/exhibition.css

The licence reserves the names "Iropke Batang" and "이롭게 바탕체" for the unmodified font, so the subset is named "Yumok Batang".
Only Korean pages use it. Other languages use serif faces already on the reader's device (see :root:lang() in style.css).
Usage: python tools/build_fonts.py
"""
import glob, hashlib, io, json, os, re
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'fonts', 'IropkeBatangM.woff')
OUT = os.path.join(ROOT, 'assets', 'fonts')
FAMILY = 'Yumok Batang'
TEXT_FILES = ['index.html', 'about.html', 'license.html', '404.html', 'albums/*.html', 'i18n/ko.json', 'data/shoots.json',
              'tools/places.json', 'exhibition/index.html', 'data/labels/ko.js', 'stats.html']


def rd(p): return io.open(p, encoding='utf-8').read()


def used_chars():
    chars = set(chr(c) for c in range(0x20, 0x7F))
    chars.update('·…–—‘’“”「」『』《》〈〉※×→←↑↓°′″©®™•‥○●◎▲▼△▽□■◇◆☆★')
    chars.add(chr(0xA0))                                # the non-breaking space, used by the style sheets
    for css in ('style.css', 'motion.css'):             # and whatever else the style sheets write into pages
        chars.update(rd(os.path.join(ROOT, css)))
    for pat in TEXT_FILES:
        for p in glob.glob(os.path.join(ROOT, pat)):
            chars.update(rd(p))
    # every language file carries the Korean name in places; and the catalogue has Korean place names
    for p in glob.glob(os.path.join(ROOT, 'i18n', '*.json')):
        chars.update(ch for ch in rd(p) if '가' <= ch <= '힣')
    return chars


def ranges(cps):
    cps = sorted(cps); out = []; i = 0
    while i < len(cps):
        j = i
        while j + 1 < len(cps) and cps[j + 1] == cps[j] + 1: j += 1
        out.append('U+%X' % cps[i] if i == j else 'U+%X-%X' % (cps[i], cps[j]))
        i = j + 1
    return ','.join(out)


def make(unicodes, tag):
    font = TTFont(SRC)
    opts = subset.Options()
    opts.flavor = 'woff2'; opts.layout_features = ['*']; opts.notdef_outline = True; opts.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    opts.name_languages = ['*']; opts.hinting = True
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=unicodes)
    sub.subset(font)
    for rec in list(font['name'].names):
        if rec.nameID in (1, 4, 16): font['name'].setName(FAMILY, rec.nameID, rec.platformID, rec.platEncID, rec.langID)
        elif rec.nameID == 6: font['name'].setName('YumokBatang', rec.nameID, rec.platformID, rec.platEncID, rec.langID)
        elif rec.nameID == 3: font['name'].setName('YumokBatang;subset of IropkeBatangM 1.001', rec.nameID, rec.platformID, rec.platEncID, rec.langID)
        elif rec.nameID in (7,): font['name'].removeNames(nameID=7)
    font['name'].setName('SIL Open Font License 1.1. Subset of Iropke Batang Medium, (c) 2016 Iropke, renamed as the licence requires.', 13, 3, 1, 0x409)
    font['name'].setName('https://openfontlicense.org', 14, 3, 1, 0x409)
    buf = io.BytesIO(); font.flavor = 'woff2'; font.save(buf)
    data = buf.getvalue()
    name = 'yumok-batang-%s.%s.woff2' % (tag, hashlib.sha256(data).hexdigest()[:8])
    for old in glob.glob(os.path.join(OUT, 'yumok-batang-%s.*.woff2' % tag)): os.remove(old)
    with open(os.path.join(OUT, name), 'wb') as f: f.write(data)
    return name, len(data)


def main():
    os.makedirs(OUT, exist_ok=True)
    cmap = set(TTFont(SRC).getBestCmap())
    core = sorted(c for c in (ord(ch) for ch in used_chars()) if c in cmap and c >= 0x20)
    rest = sorted(c for c in cmap - set(core) if c >= 0x20)      # control characters belong to neither file, or a line break would fetch the big one
    core_name, core_size = make(core, 'core')
    rest_name, rest_size = make(rest, 'rest')
    print('core %d chars %.0f KB (%s)\nrest %d chars %.0f KB (%s)' % (len(core), core_size / 1e3, core_name, len(rest), rest_size / 1e3, rest_name))
    for css, up in (('style.css', ''), ('exhibition/exhibition.css', '../')):
        face = lambda name, rng: ("@font-face {\n    font-family: '%s';\n    font-style: normal;\n    font-weight: 400;\n    font-display: swap;\n"
                                  "    src: url('%sassets/fonts/%s') format('woff2');\n    unicode-range: %s;\n}\n") % (FAMILY, up, name, rng)
        block = '/* fonts:start (written by tools/build_fonts.py) */\n' + face(core_name, ranges(core)) + face(rest_name, ranges(rest)) + '/* fonts:end */'
        path = os.path.join(ROOT, css)
        text = rd(path)
        text2, k = re.subn(r'/\* fonts:start.*?/\* fonts:end \*/', lambda m: block, text, count=1, flags=re.S)
        assert k == 1, 'markers missing in ' + css
        with io.open(path, 'w', encoding='utf-8', newline='\n') as f: f.write(text2)
    with io.open(os.path.join(ROOT, 'data', 'fonts.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(dict(family=FAMILY, core='assets/fonts/' + core_name, rest='assets/fonts/' + rest_name), f); f.write('\n')
    return core_name


if __name__ == '__main__':
    main()
