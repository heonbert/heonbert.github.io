"""Build data/photos.json + data/photos.csv and write the titles into the album pages.

Inputs : tools/titles.tsv (n, ko, en, ja, de[, yumok]), tools/places.json (optional), EXIF of assets/.
Usage  : python tools/build_catalog.py
"""
import csv, io, json, os, re
from fractions import Fraction
from PIL import Image
from PIL.ExifTags import TAGS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALBUMS = ['abstract', 'reflection', 'pattern', 'landscape']
LANGS = {'ko': 'albums', 'en': 'en/albums', 'ja': 'ja/albums', 'de': 'de/albums'}
SITE = 'https://seungheon.com'

def rd(p): return io.open(os.path.join(ROOT, p), encoding='utf-8').read()
def wr(p, s):
    with io.open(os.path.join(ROOT, p), 'w', encoding='utf-8', newline='\n') as f: f.write(s)

titles = {}
for line in rd('tools/titles.tsv').splitlines():
    c = line.split('\t')
    if len(c) >= 5:
        titles[int(c[0])] = dict(ko=c[1], en=c[2], ja=c[3], de=c[4], by='yumok' if len(c) > 5 and c[5] == 'yumok' else 'ai')
places = {}
pp = os.path.join(ROOT, 'tools/places.json')
if os.path.exists(pp): places = {int(k): v for k, v in json.load(io.open(pp, encoding='utf-8')).items()}

# Photos that show recognisable people other than the photographer. They stay on the site,
# but are left out of anything sent elsewhere (Wikimedia Commons, AI datasets).
PEOPLE = {153, 167, 175, 228, 234, 255, 257, 266, 275, 279}
# The photographer reflected in a pond, camera in hand. Identified by his family.
SELF_PORTRAIT = {274}

photos, n = [], 0
for alb in ALBUMS:
    order = re.findall(r'<img src="\.\./assets/%s/([^"]+)"' % alb, rd('albums/%s.html' % alb))
    for fn in order:
        n += 1
        im = Image.open(os.path.join(ROOT, 'assets', alb, fn)); ex = im.getexif()
        d = {TAGS.get(k, k): v for k, v in ex.items()}
        s = {TAGS.get(k, k): v for k, v in ex.get_ifd(0x8769).items()}
        shot = s.get('DateTimeOriginal')
        if shot: shot = shot[:10].replace(':', '-') + 'T' + shot[11:]
        et = s.get('ExposureTime')
        exp = None
        if et:
            fr = Fraction(float(et)).limit_denominator(8000)
            exp = '%d/%d' % (fr.numerator, fr.denominator) if fr.numerator < fr.denominator else '%g' % float(et)
        t = titles[n]; pl = places.get(n, {})
        photos.append(dict(
            id='%s/%s' % (alb, os.path.splitext(fn)[0]), n=n, album=alb, file='assets/%s/%s' % (alb, fn),
            url='%s/assets/%s/%s' % (SITE, alb, fn.replace(' ', '%20')), thumb='assets/thumbs/%s/%s' % (alb, fn),
            width=im.size[0], height=im.size[1],
            title=dict(ko=t['ko'], en=t['en'], ja=t['ja'], de=t['de']), title_by=t['by'],
            taken=shot, camera=d.get('Model'), lens=s.get('LensModel'),
            focal_length_mm=float(s['FocalLength']) if s.get('FocalLength') else None,
            exposure_s=exp, f_number=float(s['FNumber']) if s.get('FNumber') else None, iso=s.get('ISOSpeedRatings'),
            place=pl.get('place'), place_en=pl.get('place_en'), shoot_folder=pl.get('folder'),
            people=n in PEOPLE, self_portrait=n in SELF_PORTRAIT, open_dataset=n not in PEOPLE))

catalog = dict(
    name='유목의 물빛사진 / Yumok\'s Water Light Photography',
    creator=dict(name='이동주', name_en='Lee Dong-joo', pen_name='유목 (流木, Yumok)', born=1952, died=2024),
    license='CC BY 4.0', license_url='https://creativecommons.org/licenses/by/4.0/',
    attribution='Yumok (流木) Lee Dong-joo, https://seungheon.com/',
    title_note='title_by="yumok": title given by the photographer himself. title_by="ai": title written by an AI model (Claude) after his death; it is a description, not the artist\'s title.',
    count=len(photos), open_dataset_count=sum(p['open_dataset'] for p in photos), photos=photos)
wr('data/photos.json', json.dumps(catalog, ensure_ascii=False, indent=1) + '\n')

cols = ['n', 'id', 'album', 'file', 'title_ko', 'title_en', 'title_ja', 'title_de', 'title_by', 'taken', 'camera', 'lens',
        'focal_length_mm', 'exposure_s', 'f_number', 'iso', 'place', 'place_en', 'shoot_folder', 'width', 'height',
        'people', 'self_portrait', 'open_dataset']
buf = io.StringIO(); w = csv.writer(buf, lineterminator='\n'); w.writerow(cols)
for p in photos:
    row = dict(p); row.update({'title_' + k: v for k, v in p['title'].items()})
    w.writerow(['' if row.get(c) is None else row.get(c) for c in cols])
wr('data/photos.csv', '\ufeff' + buf.getvalue())

# works shown in the home page hero: his three contest pictures, his exhibition picture, and two more
HERO = [9, 147, 11, 1, 12, 143]
hero = [dict(id=p['id'], file=p['file'], title=p['title'], place=p['place'], place_en=p['place_en'], year=(p['taken'] or '')[:4])
        for p in (photos[n - 1] for n in HERO)]
wr('data/hero.json', json.dumps(hero, ensure_ascii=False, indent=1) + '\n')

# write titles into the album pages (alt text is what the popup shows)
by_file = {(p['album'], os.path.basename(p['file'])): p for p in photos}
for lang, d in LANGS.items():
    for alb in ALBUMS:
        path = '%s/%s.html' % (d, alb); html = rd(path)
        def sub(m):
            p = by_file[(alb, m.group(2))]
            return '%s%s" alt="%s"' % (m.group(1), m.group(2), p['title'][lang].replace('"', '&quot;'))
        html2, k = re.subn(r'(<img src="(?:\.\./)+assets/%s/)([^"]+)" alt="[^"]*"' % alb, sub, html)
        wr(path, html2); print(path, k)

# thumbnails for the 3D exhibition
for p in photos:
    dst = os.path.join(ROOT, p['thumb'])
    if not os.path.exists(dst):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        im = Image.open(os.path.join(ROOT, p['file'])).convert('RGB'); im.thumbnail((768, 768), Image.LANCZOS)
        im.save(dst, quality=82, optimize=True, progressive=True)
print(len(photos), 'photos')
