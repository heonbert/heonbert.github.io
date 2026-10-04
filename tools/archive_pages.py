"""Ask the Internet Archive's Wayback Machine to keep a copy of the site's pages ("Save Page Now").

    python tools/archive_pages.py            the main pages in every language, the exhibition and the data files
    python tools/archive_pages.py works ko   also the work pages of one language (about 300 requests; slow)

The Archive allows only a few captures a minute from one address, so this goes slowly. It can be stopped and run again:
what was saved is noted in dist/archive_log.json (not published), and addresses saved within the last week are skipped.
"""
import json, os, sys, time, urllib.error, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import ROOT, SITE, rd, have_langs, page_url
from i18n_extract import PAGES
from build_works import work_page

UA = {'User-Agent': 'seungheon.com archive helper (https://seungheon.com/)'}
LOG = os.path.join(ROOT, 'dist', 'archive_log.json')
FRESH = 7 * 86400


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kw): return None


def save(url):
    """200 when the Archive has taken a copy. It answers with a redirect to the copy; the copy itself may take
    a minute to become readable, so the redirect is not followed."""
    opener = urllib.request.build_opener(NoRedirect)
    try:
        with opener.open(urllib.request.Request('https://web.archive.org/save/' + url, headers=UA), timeout=180) as r:
            return r.status
    except urllib.error.HTTPError as e:
        if e.code in (301, 302) and '/web/2' in (e.headers.get('Location') or ''): return 200
        return e.code
    except Exception as e:
        return str(e)[:60]


def main():
    urls = [page_url(l['code'], p) for p in PAGES for l in have_langs()]
    urls += [SITE + '/exhibition/', SITE + '/data/photos.json', SITE + '/data/photos.csv', SITE + '/data/README.md', SITE + '/llms.txt', SITE + '/sitemap.xml']
    if len(sys.argv) > 2 and sys.argv[1] == 'works':
        cat = json.loads(rd('data/photos.json'))['photos']
        urls = [page_url(sys.argv[2], work_page(p)) for p in cat]
    log = json.load(open(LOG, encoding='utf-8')) if os.path.exists(LOG) else {}
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    done = failed = skipped = 0
    for i, url in enumerate(urls):
        if time.time() - log.get(url, 0) < FRESH: skipped += 1; continue
        status = save(url)
        ok = status == 200
        done += ok; failed += not ok
        if ok:
            log[url] = int(time.time())
            with open(LOG, 'w', encoding='utf-8') as f: json.dump(log, f, indent=0)
        print('%3d/%d %s %s' % (i + 1, len(urls), status, url), flush=True)
        time.sleep(8 if ok else 30)             # stay well under the Archive's limit; wait longer after a refusal
    print('saved %d, saved earlier %d, not saved %d' % (done, skipped, failed))
    return failed


if __name__ == '__main__':
    sys.exit(1 if main() else 0)
