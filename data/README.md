# Yumok Water Light: photo catalog

Catalog of the 303 photographs by Yumok (流木) Lee Dong-joo (이동주, 1952-2024) shown at <https://seungheon.com/>.

- `photos.json`: the full catalog
- `photos.csv`: the same data as a table (UTF-8 with BOM, opens in Excel)
- `shoots.json`: the days he went out to photograph water light
- `hero.json`, `i18n.json`, `fonts.json`: small files the pages read; not part of the catalog

Rebuild everything with `python tools/build.py`.

## License

Photographs: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credit "Yumok (流木) Lee Dong-joo" and link to <https://seungheon.com/>.
This catalog (titles and metadata): CC BY 4.0, same credit.

Use for AI training, evaluation and research is welcome. Please remember who took the pictures.

## Fields

| Field | Meaning |
|---|---|
| `id` | Album and the photographer's original file number, for example `abstract/C27A2287_1`. This is the stable name of a work. |
| `n` | Position in the catalog, 1 to 303. |
| `album` | `abstract`, `reflection`, `pattern`, `landscape`: the four groups he sorted his 282 chosen works into himself. `awards`: 21 pictures he entered in contests in 2019. |
| `file`, `url` | Path in this repository and public address of the image as he exported it (JPEG, long edge 1200 px) |
| `page` | The permanent page of the work, `https://seungheon.com/works/<album>/<name>.html` (other languages under `/<code>/works/`) |
| `view`, `thumb`, `thumb_s` | Lighter WebP copies for viewing: full size, 768 px and 384 px |
| `title.ko` / `en` / `ja` / `de` | Title in four languages. Titles in 12 more languages are in `i18n/<code>.json` (`titles`, in catalog order). |
| `title_by` | `yumok`: the photographer's own title. `ai`: a description written by an AI model after his death. |
| `award`, `award_ko` | Contest result in English and Korean, where there is one |
| `taken` | Local time of the shot, from the camera (EXIF) |
| `camera`, `lens`, `focal_length_mm`, `exposure_s`, `f_number`, `iso` | From the camera (EXIF) |
| `place`, `place_en` | Where it was taken, derived from the photographer's folder name. Empty when unknown. |
| `shoot_folder` | His own folder name for that day's shoot, verbatim |
| `width`, `height` | Pixel size of the published image |
| `people` | `true` when the picture shows recognisable people other than the photographer |
| `self_portrait` | `true` for the one picture of the photographer himself, reflected in a lily pond |
| `open_dataset` | `false` for the pictures with people. Only rows with `true` go to Wikimedia Commons or AI datasets. |

## Provenance

- Every image was taken with a camera (Canon EOS 5D Mark IV, EOS R6 or EOS 6D Mark II) between 2018 and 2023, and developed by the photographer in Adobe Camera Raw or Photoshop. None is AI-generated.
- The 282 works of the four albums are the 1200 x 800 web copies he exported himself in 2023. The family keeps the camera RAW files and print-size versions.
- The 21 works of the `awards` album come from his own folder of 2019 contest entries. The file names there carry, in his words, the contest, the title and the result. They were reduced to 1200 px for the site; nothing else was changed. Three more files in that folder are water-light works already in the Abstract album.
- Places are known for 157 of the 282 album photographs. His dated shooting folders end in 2022, so most 2023 works have no place.
- Twenty-two pictures show recognisable people: ten among the album works (passers-by) and twelve among the contest pictures (festival scenes and portraits). They can be seen on the site but are excluded from external uploads and datasets (`open_dataset: false`), leaving 281.
- `landscape/_79A9104` shows the photographer himself, camera raised, reflected in a lily pond. His family identified him.
- `reflection/_79A9746` and `landscape/_79A9746` are the same photograph filed in two albums.

## Inside the image files

Every published JPEG carries, in EXIF and XMP: the photographer's name, a credit line, the titles in Korean and English, the work's identifier and page, and, for the pictures offered for free reuse, the CC BY 4.0 licence. The picture data was copied byte for byte when these were written (`tools/embed_metadata.py`). Photoshop's private blocks and editing history were removed.

## About the titles

Twenty-four works carry titles he gave them for national photo contests in 2019: 물빛추억, 물빛향연, 물빛축제 in the Abstract album, and the 21 pictures of the Awards album.
The other 279 titles were written in 2026 by an AI model (Claude) that looked at each photograph. They describe what is visible and are not the artist's titles.

## shoots.json

128 days between 2018 and 2022 on which he went out to photograph water light, with the place names exactly as he wrote them on his folders. Only folders he labelled 물빛 (water light) are listed; his folders for 2023 were not found.
