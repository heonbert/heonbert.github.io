"""Small web copies of the pictures that are not works: album covers, portraits, the favicon.

The originals stay where they are (they are what the download buttons give). Pages show these copies:
  assets/covers/<album>.webp               600 x 800, the album cards on the front page
  assets/photographer/web/<name>-s.webp    inline size
  assets/photographer/web/<name>-l.webp    the enlarged view
Usage: python tools/build_images.py
"""
import os
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COVERS = {'abstract': 'assets/abstract/cover.jpg', 'reflection': 'assets/reflection/cover.jpg', 'pattern': 'assets/pattern/cover.jpg',
          'landscape': 'assets/landscape/cover.jpg', 'awards': 'assets/awards/seocheon-moorhen.jpg'}
# name -> (source, inline long edge, enlarged long edge)
PORTRAITS = {'leedongjoo': ('leedongjoo.jpg', 840, 1800), 'professor': ('professor.jpg', 640, 1800), 'lab': ('lab.jpg', 640, 1800),
             'photographer': ('photographer.jpg', 640, 1800), 'family': ('family.png', 640, 1264)}


def fresh(src, dst):
    """True when the copy is already there and newer than its source."""
    a, b = os.path.join(ROOT, src), os.path.join(ROOT, dst)
    return os.path.exists(b) and os.path.getmtime(b) >= os.path.getmtime(a)


def save(im, dst, quality):
    full = os.path.join(ROOT, dst)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    im.save(full, 'WEBP', quality=quality, method=6)
    return os.path.getsize(full)


def main():
    out = {}
    for alb, src in COVERS.items():
        if fresh(src, 'assets/covers/%s.webp' % alb): continue
        im = ImageOps.exif_transpose(Image.open(os.path.join(ROOT, src))).convert('RGB')
        im = ImageOps.fit(im, (600, 800), Image.LANCZOS, centering=(0.5, 0.5))
        print('cover %-11s %4.0f KB' % (alb, save(im, 'assets/covers/%s.webp' % alb, 80) / 1e3))
    for name, (src, small, large) in PORTRAITS.items():
        if fresh('assets/photographer/' + src, 'assets/photographer/web/%s-l.webp' % name): continue
        im = ImageOps.exif_transpose(Image.open(os.path.join(ROOT, 'assets/photographer', src))).convert('RGB')
        for tag, size, q in (('s', small, 80), ('l', large, 84)):
            t = im.copy(); t.thumbnail((size, size), Image.LANCZOS)
            kb = save(t, 'assets/photographer/web/%s-%s.webp' % (name, tag), q) / 1e3
            out['%s-%s' % (name, tag)] = t.size
            print('%-16s %4dx%-4d %4.0f KB' % (name + '-' + tag, t.size[0], t.size[1], kb))
    # a small favicon.ico (16, 32, 48) in place of a 259 KB one
    if os.path.getsize(os.path.join(ROOT, 'favicon.ico')) > 50000:
        icon = Image.open(os.path.join(ROOT, 'android-chrome-512x512.png')).convert('RGBA')
        icon.save(os.path.join(ROOT, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
        print('favicon.ico %.0f KB' % (os.path.getsize(os.path.join(ROOT, 'favicon.ico')) / 1e3))
    return out


if __name__ == '__main__':
    main()
