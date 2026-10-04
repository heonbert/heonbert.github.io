"""Write sitemap.xml: every page in every language, and every work page with its image.
The links between language versions are in the pages themselves (hreflang), so the sitemap stays a plain list.
Usage: python tools/build_sitemap.py
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import SITE, rd, wr, have_langs, page_url
from i18n_extract import PAGES
from build_works import work_page, q


def main():
    cat = json.loads(rd('data/photos.json'))['photos']
    rows = ['<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">']
    n = 0
    for page in PAGES:
        for l in have_langs():
            rows.append('  <url><loc>%s</loc></url>' % page_url(l['code'], page)); n += 1
    rows.append('  <url><loc>%s/exhibition/</loc></url>' % SITE); n += 1
    for p in cat:
        for l in have_langs():
            rows.append('  <url><loc>%s</loc><image:image><image:loc>%s/%s</image:loc></image:image></url>' % (page_url(l['code'], work_page(p)), SITE, q(p['file']))); n += 1
    rows.append('</urlset>')
    wr('sitemap.xml', '\n'.join(rows) + '\n')
    print('sitemap:', n, 'addresses')


if __name__ == '__main__':
    main()
