# Yumok Water Light: photo catalog

Catalog of the 282 photographs by Yumok (流木) Lee Dong-joo (이동주, 1952-2024) shown at <https://seungheon.com/>.

- `photos.json`: the full catalog
- `photos.csv`: the same data as a table (UTF-8 with BOM, opens in Excel)

Rebuild both with `python tools/build_catalog.py`.

## License

Photographs: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credit "Yumok (流木) Lee Dong-joo" and link to <https://seungheon.com/>.
This catalog (titles and metadata): CC BY 4.0, same credit.

Use for AI training, evaluation and research is welcome. Please remember who took the pictures.

## Fields

| Field | Meaning |
|---|---|
| `id` | Album and the photographer's original file number, for example `abstract/C27A2287_1`. This is the stable name of a work. |
| `album` | `abstract`, `reflection`, `pattern` or `landscape`. The photographer sorted the works into these four groups himself. |
| `file`, `url` | Path in this repository and public address of the image |
| `title.ko` / `en` / `ja` / `de` | Title in four languages |
| `title_by` | `yumok`: the photographer's own title. `ai`: a description written by an AI model after his death. |
| `taken` | Local time of the shot, from the camera (EXIF) |
| `camera`, `lens`, `focal_length_mm`, `exposure_s`, `f_number`, `iso` | From the camera (EXIF) |
| `place`, `place_en` | Where it was taken, derived from the photographer's folder name. Empty when unknown. |
| `shoot_folder` | His own folder name for that day's shoot, verbatim |
| `width`, `height` | Pixel size of the published image |
| `people` | `true` when the picture shows recognisable people other than the photographer |
| `self_portrait` | `true` for the one picture of the photographer himself, reflected in a lily pond |
| `open_dataset` | `false` for the pictures with people. Only rows with `true` go to Wikimedia Commons or AI datasets. |

## Provenance

- Every image was taken with a camera (Canon EOS 5D Mark IV, EOS R6 or EOS 6D Mark II) between 2018 and 2023, and developed by the photographer in Adobe Camera Raw. None is AI-generated.
- The published files are the 1200 x 800 web copies he exported himself in 2023. The family keeps the camera RAW files and print-size versions.
- Places are known for 157 of the 282 photographs. His dated shooting folders end in 2022, so most 2023 works have no place.
- Ten pictures show recognisable passers-by. They can be seen on the site but are excluded from external uploads and datasets (`open_dataset: false`), leaving 272.
- `landscape/_79A9104` shows the photographer himself, camera raised, reflected in a lily pond. His family identified him.
- `reflection/_79A9746` and `landscape/_79A9746` are the same photograph filed in two albums.

## About the titles

Three works carry titles he gave them for national photo contests in 2019: 물빛추억, 물빛향연, 물빛축제.
The other 279 titles were written in 2026 by an AI model (Claude) that looked at each photograph. They describe what is visible and are not the artist's titles.

## shoots.json

128 days between 2018 and 2022 on which he went out to photograph water light, with the place names exactly as he wrote them on his folders. Only folders he labelled 물빛 (water light) are listed; his folders for 2023 were not found.
