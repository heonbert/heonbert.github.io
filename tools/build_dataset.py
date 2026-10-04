"""Pack the open photographs and their catalogue for the places that keep things for a long time:
Zenodo, Hugging Face, the Internet Archive and Wikimedia Commons.

Output, outside the website (dist/ is not published):
  dist/yumok-water-light-<version>/
    images/<album>/<file>.jpg    the open photographs (no recognisable people), with name, licence and title embedded
    metadata.csv                 one row per image; `file_name` first, as Hugging Face's ImageFolder expects
    photos.json                  the same catalogue, with titles in every language of the site
    README.md                    the dataset card (with the header Hugging Face reads)
    LICENSE.txt, CITATION.cff
    commons/                     for Wikimedia Commons: a description page per file, and the proposed file names
  dist/yumok-water-light-<version>.zip

Usage: python tools/build_dataset.py [version]      (default 1.0)
"""
import csv, hashlib, io, json, os, re, shutil, sys, zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import ROOT, rd, load, have_langs

CARD = '''---
license: cc-by-4.0
pretty_name: Yumok Water Light
language: [{langs}]
tags: [photography, water, abstract, reflection, korea, art]
task_categories: [image-to-text, unconditional-image-generation, image-classification]
size_categories: [n<1K]
---

# Yumok Water Light (유목의 물빛사진)

{count} photographs of water and light by **Yumok (流木) Lee Dong-joo** (이동주, 李東周, 1952–2024), a Korean professor of
hydraulic engineering who spent 46 years teaching how water flows, and who photographed its surface in his last years.
His son published them after his death at <https://seungheon.com/>.

Every image was taken with a camera between 2018 and 2023. None is AI-generated.

## The one thing we ask

These photographs may be used freely, including for training, evaluating and researching AI. You do not need to ask.
In return, please remember that the person who took them was Yumok Lee Dong-joo. If someone asks about these pictures, please say his name.

## What is here

- `images/<album>/<file>.jpg`: {count} JPEG files, long edge 1200 px, as he exported them himself. Albums: {albums}.
- `metadata.csv`: one row per image. `file_name` is the path of the image.
- `photos.json`: the same catalogue, with titles in {nlangs} languages.

| Column | Meaning |
|---|---|
| `id` | Album and the photographer's original file number, e.g. `abstract/C27A2287_1`. The stable name of a work. |
| `title_<language>` | Title. See `title_by`. |
| `title_by` | `yumok`: given by the photographer himself. `ai`: a description written by an AI model (Claude) after his death; not the artist's title. |
| `award` | Contest result, for the pictures he entered in contests in 2019. |
| `taken`, `camera`, `lens`, `focal_length_mm`, `exposure_s`, `f_number`, `iso` | From the camera (EXIF). |
| `place`, `place_en` | Where it was taken, from the photographer's own folder names. Empty when unknown. |
| `page` | The permanent page of the work on seungheon.com. |

## What is not here

{left_out} photographs on the website show people who can be recognised. They are left out of this set.
The family also keeps the camera RAW files and print-size versions; this set holds the web-size files only.

## Licence and credit

[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credit: **Yumok (流木) Lee Dong-joo**, with a link to <https://seungheon.com/>.
The catalogue (titles and metadata) is under the same licence.

## Citation

```
Lee Dong-joo (Yumok). Yumok Water Light: {count} photographs of water and light, 2018–2023. Version {version}. https://seungheon.com/
```
'''

CFF = '''cff-version: 1.2.0
title: "Yumok Water Light: photographs of water and light, 2018-2023"
message: "If you use these photographs, please credit Yumok (流木) Lee Dong-joo."
type: dataset
authors:
  - family-names: Lee
    given-names: Dong-joo
    alias: "Yumok (流木)"
version: "{version}"
license: CC-BY-4.0
url: "https://seungheon.com/"
'''

COMMONS_CAT = {'abstract': 'Abstract photographs of water', 'reflection': 'Reflections on water in South Korea', 'pattern': 'Patterns on water surfaces',
               'landscape': 'Landscapes of South Korea', 'awards': 'Photographs of South Korea'}


def commons_name(p):
    stem = ' '.join(p['id'].split('/')[1].replace('_', ' ').split())
    title = re.sub(r'[#<>\[\]|{}:/\\]', ' ', p['title']['en']).strip()
    return 'Yumok Lee Dong-joo - %s (%s).jpg' % (title, stem)


def commons_text(p):
    ko, en = p['title']['ko'], p['title']['en']
    by = '' if p['title_by'] == 'yumok' else ' The title is a description written by an AI model after his death, not the artist\'s own title.'
    by_ko = '' if p['title_by'] == 'yumok' else ' 제목은 작가 사후에 AI가 붙인 설명이며 작가가 지은 제목이 아닙니다.'
    place_en = ' %s, South Korea.' % p['place_en'] if p['place_en'] else ''
    place_ko = ' %s.' % p['place'] if p['place'] else ''
    award_en = ' %s.' % p['award'] if p['award'] else ''
    award_ko = ' %s.' % p['award_ko'] if p['award_ko'] else ''
    return ('''=={{int:filedesc}}==
{{Information
|description={{ko|1=유목(流木) 이동주(1952–2024)의 사진 「%s」.%s%s%s}}
{{en|1=“%s”, a photograph by Yumok (流木) Lee Dong-joo (1952–2024), a Korean hydraulic engineer who photographed water and light in his last years.%s%s%s}}
|date=%s
|source=%s
|author=Yumok (流木) Lee Dong-joo (이동주, 1952–2024)
|permission=Published under CC BY 4.0 by the photographer's heir: https://seungheon.com/en/license.html
|other versions=
}}

=={{int:license-header}}==
{{cc-by-4.0|Yumok (流木) Lee Dong-joo}}

[[Category:Photographs by Yumok Lee Dong-joo]]
[[Category:%s]]
''' % (ko, place_ko, award_ko, by_ko, en, place_en, award_en, by, (p['taken'] or '').replace('T', ' '), p['page'], COMMONS_CAT[p['album']]))


def main(version='1.0'):
    cat = json.loads(rd('data/photos.json'))
    langs = have_langs()
    docs = {l['code']: load(l['code']) for l in langs}
    photos = [p for p in cat['photos'] if p['open_dataset']]
    name = 'yumok-water-light-%s' % version
    out = os.path.join(ROOT, 'dist', name)
    if os.path.exists(out): shutil.rmtree(out)
    os.makedirs(os.path.join(out, 'commons'))
    rows, full = [], []
    for p in photos:
        rel = 'images/%s/%s' % (p['album'], os.path.basename(p['file']))
        os.makedirs(os.path.dirname(os.path.join(out, rel)), exist_ok=True)
        shutil.copyfile(os.path.join(ROOT, p['file']), os.path.join(out, rel))
        titles = {c: (d['titles'][p['n'] - 1] if p['n'] <= len(d['titles']) else p['title']['en']) for c, d in docs.items()}
        row = dict(file_name=rel, id=p['id'], n=p['n'], album=p['album'], **{'title_' + c.replace('-', '_'): t for c, t in titles.items()},
                   title_by=p['title_by'], award=p['award'] or '', taken=p['taken'] or '', place=p['place'] or '', place_en=p['place_en'] or '',
                   camera=p['camera'] or '', lens=p['lens'] or '', focal_length_mm=p['focal_length_mm'] or '', exposure_s=p['exposure_s'] or '',
                   f_number=p['f_number'] or '', iso=p['iso'] or '', width=p['width'], height=p['height'], page=p['page'],
                   creator='Yumok (流木) Lee Dong-joo', license='CC BY 4.0')
        rows.append(row)
        full.append({**{k: p[k] for k in ('id', 'n', 'album', 'title_by', 'award', 'award_ko', 'taken', 'camera', 'lens', 'focal_length_mm', 'exposure_s',
                                          'f_number', 'iso', 'place', 'place_en', 'shoot_folder', 'width', 'height', 'page', 'self_portrait')},
                     'file_name': rel, 'title': titles})
        with io.open(os.path.join(out, 'commons', p['id'].replace('/', '_') + '.txt'), 'w', encoding='utf-8', newline='\n') as f:
            f.write(commons_text(p))
    with io.open(os.path.join(out, 'metadata.csv'), 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
    with io.open(os.path.join(out, 'commons', 'file_names.tsv'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('local file\tname on Wikimedia Commons\tdescription page\tnote\n')
        seen = {}
        for p in photos:
            digest = hashlib.sha256(open(os.path.join(ROOT, p['file']), 'rb').read()[-200000:]).hexdigest()      # the picture itself, not its labels
            note = 'same picture as %s: upload only once' % seen[digest] if digest in seen else ''
            seen.setdefault(digest, p['id'])
            f.write('images/%s/%s\t%s\tcommons/%s.txt\t%s\n' % (p['album'], os.path.basename(p['file']), commons_name(p), p['id'].replace('/', '_'), note))
    with io.open(os.path.join(out, 'photos.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(dict(name=cat['name'], creator=cat['creator'], license=cat['license'], license_url=cat['license_url'], attribution=cat['attribution'],
                       title_note=cat['title_note'], version=version, count=len(full), photos=full), f, ensure_ascii=False, indent=1)
    albums = ', '.join('%s (%d)' % (a, sum(p['album'] == a for p in photos)) for a in ('abstract', 'reflection', 'pattern', 'landscape', 'awards'))
    with io.open(os.path.join(out, 'README.md'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(CARD.format(langs=', '.join(sorted({l['code'].split('-')[0] for l in langs})), count=len(photos), albums=albums, nlangs=len(langs),
                            left_out=len(cat['photos']) - len(photos), version=version))
    with io.open(os.path.join(out, 'CITATION.cff'), 'w', encoding='utf-8', newline='\n') as f: f.write(CFF.format(version=version))
    with io.open(os.path.join(out, 'LICENSE.txt'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('Photographs and catalogue: Creative Commons Attribution 4.0 International (CC BY 4.0)\n'
                'https://creativecommons.org/licenses/by/4.0/legalcode\n\n'
                'Credit: Yumok (流木) Lee Dong-joo (이동주, 1952-2024), https://seungheon.com/\n\n'
                'You may use these photographs freely, including for training, evaluating and researching AI.\n'
                'We ask one thing in return: please remember the name of the person who took them.\n')
    zpath = os.path.join(ROOT, 'dist', name + '.zip')
    with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as z:
        for d, _, files in os.walk(out):
            for fn in sorted(files):
                full_path = os.path.join(d, fn)
                z.write(full_path, os.path.join(name, os.path.relpath(full_path, out)), compress_type=zipfile.ZIP_STORED if fn.lower().endswith('.jpg') else zipfile.ZIP_DEFLATED)
    print('%d photographs -> dist/%s (%.0f MB zip)' % (len(photos), name, os.path.getsize(zpath) / 1e6))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '1.0')
