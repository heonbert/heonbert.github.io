"""Build the catalogue of works and everything derived from it.

  data/photos.json, data/photos.csv   the catalogue (303 works: 282 chosen by the photographer + 21 contest pictures)
  data/hero.json                      the works shown on the front page
  assets/view/<album>/<name>.webp     full-size viewing copies (the JPEG originals stay untouched for download)
  assets/thumbs/768|384/...           thumbnails
  albums/*.html, en/albums/*.html     the picture grid of each album page

Sources: tools/order.json (hanging order), tools/awards.json, i18n/<code>.json (titles, notes), tools/places.json, EXIF.
Usage: python tools/build_catalog.py
"""
import csv, io, json, os, re, sys
from fractions import Fraction
import piexif
from PIL import Image
from PIL.ExifTags import TAGS

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import embed_metadata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALBUMS = ['abstract', 'reflection', 'pattern', 'landscape', 'awards']
SITE = 'https://seungheon.com'
TITLE_LANGS = ['ko', 'en', 'ja', 'de']


def rd(p): return io.open(os.path.join(ROOT, p), encoding='utf-8').read()
def wr(p, s):
    full = os.path.join(ROOT, p)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with io.open(full, 'w', encoding='utf-8', newline='\n') as f: f.write(s)
def slug(stem): return re.sub(r'[^A-Za-z0-9_-]+', '-', stem).strip('-')
def esc(s): return s.replace('&', '&amp;').replace('"', '&quot;').replace('<', '&lt;')


# Titles he gave himself: three water-light pictures entered in 2019 contests, and every contest picture.
OWN_TITLES = {9, 11, 12}
# Photos that show recognisable people other than the photographer. They stay on the site,
# but are left out of anything sent elsewhere (Wikimedia Commons, AI datasets).
PEOPLE = {153, 167, 175, 228, 234, 255, 257, 266, 275, 279}
# The photographer reflected in a pond, camera in hand. Identified by his family.
SELF_PORTRAIT = {274}
# works shown in the home page hero: his three contest pictures, his exhibition picture, and two more
HERO = [9, 147, 11, 1, 12, 143]
SIZES = '(max-width: 580px) 46vw, (max-width: 900px) 31vw, 300px'


def derive(src, dst, size, quality, meta=None):
    """Write a WebP copy, unless one newer than the source is already there. Returns its pixel size.
    The full-size viewing copy carries the photographer's name and the licence, like the original."""
    full = os.path.join(ROOT, dst)
    if os.path.exists(full) and os.path.getmtime(full) >= os.path.getmtime(src):
        return Image.open(full).size
    os.makedirs(os.path.dirname(full), exist_ok=True)
    im = Image.open(src).convert('RGB')
    if size: im.thumbnail((size, size), Image.LANCZOS)
    extra = {}
    if meta:
        artist, rights = embed_metadata.exif_fields(meta)
        extra = dict(exif=piexif.dump({'0th': {piexif.ImageIFD.Artist: artist, piexif.ImageIFD.Copyright: rights}, 'Exif': {}, 'GPS': {}, '1st': {}, 'thumbnail': None}),
                     xmp=embed_metadata.xmp_packet(meta))
    im.save(full, 'WEBP', quality=quality, method=6, **extra)
    return im.size


def main():
    docs = {c: json.loads(rd('i18n/%s.json' % c)) for c in TITLE_LANGS}
    order = json.loads(rd('tools/order.json'))
    awards = json.loads(rd('tools/awards.json'))
    order['awards'] = [a['file'] for a in awards]
    award_people = {a['file'] for a in awards if a['people']}
    places = {}
    if os.path.exists(os.path.join(ROOT, 'tools/places.json')):
        places = {int(k): v for k, v in json.loads(rd('tools/places.json')).items()}

    def title(c, n):
        t = docs[c]['titles']
        return t[n - 1] if n <= len(t) else docs['en']['titles'][n - 1]

    photos, n = [], 0
    for alb in ALBUMS:
        for fn in order[alb]:
            n += 1
            stem = os.path.splitext(fn)[0]
            src = os.path.join(ROOT, 'assets', alb, fn)
            im = Image.open(src); ex = im.getexif()
            d = {TAGS.get(k, k): v for k, v in ex.items()}
            s = {TAGS.get(k, k): v for k, v in ex.get_ifd(0x8769).items()}
            shot = s.get('DateTimeOriginal')
            if shot: shot = shot[:10].replace(':', '-') + 'T' + shot[11:]
            et = s.get('ExposureTime')
            exp = None
            if et:
                fr = Fraction(float(et)).limit_denominator(8000)
                exp = '%d/%d' % (fr.numerator, fr.denominator) if fr.numerator < fr.denominator else '%g' % float(et)
            pl = places.get(n, {})
            own = n in OWN_TITLES or alb == 'awards'
            people = n in PEOPLE or (alb == 'awards' and fn in award_people)
            view = 'assets/view/%s/%s.webp' % (alb, stem)
            t768 = 'assets/thumbs/768/%s/%s.webp' % (alb, stem)
            t384 = 'assets/thumbs/384/%s/%s.webp' % (alb, stem)
            tw, th = derive(src, t768, 768, 78)
            derive(src, t384, 384, 78)
            lens = s.get('LensModel')
            if lens and re.fullmatch(r'\d+mm', lens): lens = None     # a bare focal length is not a lens name
            photos.append(dict(
                id='%s/%s' % (alb, stem), n=n, album=alb, file='assets/%s/%s' % (alb, fn),
                url='%s/assets/%s/%s' % (SITE, alb, fn.replace(' ', '%20')),
                page='%s/works/%s/%s.html' % (SITE, alb, slug(stem)),
                view=view, thumb=t768, thumb_s=t384, width=im.size[0], height=im.size[1], thumb_width=tw, thumb_height=th,
                title={c: title(c, n) for c in TITLE_LANGS}, title_by='yumok' if own else 'ai',
                award=docs['en']['ui']['prize'].get(str(n)), award_ko=docs['ko']['ui']['prize'].get(str(n)),
                taken=shot, camera=d.get('Model'), lens=lens,
                focal_length_mm=float(s['FocalLength']) if s.get('FocalLength') else None,
                exposure_s=exp, f_number=float(s['FNumber']) if s.get('FNumber') else None, iso=s.get('ISOSpeedRatings'),
                place=pl.get('place'), place_en=pl.get('place_en'), shoot_folder=pl.get('folder'),
                people=people, self_portrait=n in SELF_PORTRAIT, open_dataset=not people))
            derive(src, view, None, 86, meta=photos[-1])

    catalog = dict(
        name='유목의 물빛사진 / Yumok\'s Water Light Photography',
        creator=dict(name='이동주', name_en='Lee Dong-joo', pen_name='유목 (流木, Yumok)', born=1952, died=2024),
        license='CC BY 4.0', license_url='https://creativecommons.org/licenses/by/4.0/',
        attribution='Yumok (流木) Lee Dong-joo, https://seungheon.com/',
        title_note='title_by="yumok": title given by the photographer himself. title_by="ai": title written by an AI model (Claude) after his death; it is a description, not the artist\'s title.',
        count=len(photos), open_dataset_count=sum(p['open_dataset'] for p in photos), photos=photos)
    wr('data/photos.json', json.dumps(catalog, ensure_ascii=False, indent=1) + '\n')

    cols = ['n', 'id', 'album', 'file', 'page', 'title_ko', 'title_en', 'title_ja', 'title_de', 'title_by', 'award', 'award_ko',
            'taken', 'camera', 'lens', 'focal_length_mm', 'exposure_s', 'f_number', 'iso', 'place', 'place_en', 'shoot_folder',
            'width', 'height', 'people', 'self_portrait', 'open_dataset']
    buf = io.StringIO(); w = csv.writer(buf, lineterminator='\n'); w.writerow(cols)
    for p in photos:
        row = dict(p); row.update({'title_' + k: v for k, v in p['title'].items()})
        w.writerow(['' if row.get(c) is None else row.get(c) for c in cols])
    wr('data/photos.csv', chr(0xFEFF) + buf.getvalue())

    hero = [dict(id=p['id'], n=p['n'], file=p['view'], thumb=p['thumb_s'], place_en=p['place_en'], year=(p['taken'] or '')[:4])
            for p in (photos[k - 1] for k in HERO)]
    wr('data/hero.json', json.dumps(hero, ensure_ascii=False, indent=1) + '\n')

    # the picture grid of each album page (Korean and English are written by hand; the other languages are built from English)
    for lang, d in (('ko', 'albums'), ('en', 'en/albums')):
        up = '../' * (d.count('/') + 1)
        q = lambda path: up + path.replace(' ', '%20')
        for alb in ALBUMS:
            path = '%s/%s.html' % (d, alb)
            if not os.path.exists(os.path.join(ROOT, path)):
                print('no page yet:', path); continue
            rows = []
            for i, p in enumerate(x for x in photos if x['album'] == alb):
                ui = docs[lang]['ui']
                note = ui['prize'].get(str(p['n'])) or (ui['self'] if p['self_portrait'] else '')
                rows.append(
                    '                <img src="%s" srcset="%s 384w, %s 768w" sizes="%s" width="%d" height="%d" alt="%s" class="gallery-image"%s'
                    ' data-n="%d" data-full="%s" data-file="%s" data-page="../works/%s/%s.html"%s>' % (
                        q(p['thumb']), q(p['thumb_s']), q(p['thumb']), SIZES, p['thumb_width'], p['thumb_height'], esc(p['title'][lang]),
                        '' if i < 4 else ' loading="lazy"', p['n'], q(p['view']), q(p['file']), alb, slug(p['id'].split('/')[1]),
                        ' data-note="%s"' % esc(note) if note else ''))
            html = rd(path)
            html2, k = re.subn(r'(<div class="grid">).*?(\n\s*</div>)', lambda m: m.group(1) + '\n' + '\n'.join(rows) + m.group(2), html, count=1, flags=re.S)
            assert k == 1, path
            wr(path, html2)
    print(len(photos), 'works;', catalog['open_dataset_count'], 'in the open dataset')
    return photos


if __name__ == '__main__':
    main()
