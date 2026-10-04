"""Build everything, in order. Run this after changing texts, translations, pictures or page templates.

    python tools/build.py            build and check
    python tools/build.py --check    only run the checks

Steps
  1. embed_metadata   photographer, licence and title inside every published JPEG (lossless, idempotent)
  2. build_catalog    data/photos.json and .csv, viewing copies and thumbnails, the picture grids of the album pages
  3. build_images     album covers, portraits, favicon
  4. apply_site_text  the notes on the Korean and English license pages
  5. build_fonts      the Korean serif, cut down to the letters in use
  6. apply_common     language menu, hreflang, labels: the same on every hand-written page
  7. i18n_extract     the list of English sentences that translations are keyed by
  8. build_i18n       the pages of every other language, and the language files of the 3D exhibition
  9. build_works      one page per photograph, in every language
 10. build_misc       the "not found" page, the service worker's version
 11. build_sitemap
Checks: every language file against English, every internal link, the scripts' syntax.
"""
import os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
STEPS = ['embed_metadata', 'build_catalog', 'build_images', 'apply_site_text', 'build_fonts', 'apply_common', 'i18n_extract',
         'build_i18n', 'build_works', 'build_misc', 'build_sitemap']


def run(args, **kw):
    env = dict(os.environ, PYTHONIOENCODING='utf-8')
    return subprocess.run(args, cwd=ROOT, env=env, **kw).returncode


def checks():
    sys.path.insert(0, HERE)
    from common import LANGS
    bad = 0
    for l in LANGS:
        if l['code'] in ('ko', 'en'): continue
        bad += run([sys.executable, os.path.join(HERE, 'i18n_check.py'), l['code']], stdout=subprocess.DEVNULL) != 0 and (print('language file needs attention:', l['code']) or 1)
    bad += run([sys.executable, os.path.join(HERE, 'i18n_delta.py'), 'status'])
    bad += run([sys.executable, os.path.join(HERE, 'check_links.py')])
    for js in ('motion.js', 'popup_gallery.js', 'bookmark.js', 'contact.js', 'sw.js', 'exhibition/main.js', 'exhibition/layout.js',
               'exhibition/presence.js', 'exhibition/npc.js', 'exhibition/config.js', 'realtime/src/index.js'):
        bad += run(['node', '--check', js])
    return bad


if __name__ == '__main__':
    if '--check' not in sys.argv:
        for step in STEPS:
            print('---', step)
            if run([sys.executable, os.path.join(HERE, step + '.py')]) != 0:
                sys.exit('stopped at ' + step)
    print('--- checks')
    bad = checks()
    print('all good' if not bad else 'problems found')
    sys.exit(1 if bad else 0)
