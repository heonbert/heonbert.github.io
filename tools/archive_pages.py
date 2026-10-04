"""Ask the Internet Archive's Wayback Machine to keep a copy of the site's pages ("Save Page Now").

    python tools/archive_pages.py            the main pages in every language, the exhibition and the data files
    python tools/archive_pages.py works ko   also the work pages of one language (about 300 requests; slow)

The Archive allows only a few captures a minute from one address, so this goes slowly and can be stopped and run again:
addresses already captured today are skipped.
"""
import json, os, sys, time, urllib.parse, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import SITE, rd, have_langs, page_url
from i18n_extract import PAGES
from build_works import work_page

UA = {'User-Agent': 'seungheon.com archive helper (https://seungheon.com/)'}


def captured_today(url):
    try:
        q = 'https://archive.org/wayback/available?url=' + urllib.parse.quote(url, safe='')
        with urllib.request.urlopen(urllib.request.Request(q, headers=UA), timeout=30) as r:
            snap = json.load(r).get('archived_snapshots', {}).get('closest')
        return bool(snap) and snap.get('timestamp', '')[:8] == time.strftime('%Y%m%d', time.gmtime())
    except Exception:
        return False


def save(url):
    try:
        with urllib.request.urlopen(urllib.request.Request('https://web.archive.org/save/' + url, headers=UA), timeout=180) as r:
            return r.status
    except Exception as e:
        return getattr(e, 'code', None) or str(e)[:60]


def main():
    urls = [page_url(l['code'], p) for p in PAGES for l in have_langs()]
    urls += [SITE + '/exhibition/', SITE + '/data/photos.json', SITE + '/data/photos.csv', SITE + '/data/README.md', SITE + '/llms.txt', SITE + '/sitemap.xml']
    if len(sys.argv) > 2 and sys.argv[1] == 'works':
        cat = json.loads(rd('data/photos.json'))['photos']
        urls = [page_url(sys.argv[2], work_page(p)) for p in cat]
    done = failed = skipped = 0
    for i, url in enumerate(urls):
        if captured_today(url): skipped += 1; continue
        status = save(url)
        ok = status == 200
        done += ok; failed += not ok
        print('%3d/%d %s %s' % (i + 1, len(urls), status, url), flush=True)
        time.sleep(8 if ok else 30)             # stay well under the Archive's limit; wait longer after a refusal
    print('saved %d, already there %d, not saved %d' % (done, skipped, failed))


if __name__ == '__main__':
    main()
