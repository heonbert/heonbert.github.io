# 유목의 물빛사진 / Yumok's Water Light Photography

故 유목(流木) 이동주 작가(1952-2024)의 물빛사진 갤러리 웹사이트입니다.

46년간 군산대학교 토목공학과 교수로 재직하시며 후학을 양성하시고, 퇴임 후 사진작가로 활동하시며 물과 빛을 주제로 한 작품을 남기셨습니다.

**[seungheon.com](https://seungheon.com)**

## About This Site

아버지는 생전에 당신의 사진을 보여줄 수 있는 웹사이트를 만들어 달라고 하셨습니다. 그때는 바쁘다는 핑계로 미뤘습니다. 그러던 중 아버지가 갑작스러운 뇌질환으로 쓰러지셨고, 끝내 돌아오지 못하셨습니다.

이 갤러리는 아버지가 살아 계실 때 만들어 드리지 못한 것을, 아들 승헌이가 아버지에 대한 미안함과 그리움을 담아 뒤늦게나마 완성한 것입니다. 아버지의 작품이 더 많은 분들의 눈에 닿기를 바랍니다.

## Albums

| Album | Photos |
|-------|--------|
| 추상 (Abstract) | 143 |
| 반영 (Reflection) | 46 |
| 문양 (Pattern) | 24 |
| 풍경 (Landscape) | 69 |
| 입상작 (Awards) | 21 |

앞의 네 앨범 282점은 작가가 생전에 직접 골라 나눈 것입니다. 입상작 21점은 2019년 전국 사진 공모전과 촬영대회에 낸 사진으로, 작가가 따로 모아 둔 폴더에서 가져왔습니다.

사진마다 고유 주소가 있습니다. 예: [seungheon.com/works/abstract/C27A2287_1.html](https://seungheon.com/works/abstract/C27A2287_1.html)

## 3D 전시관

**[seungheon.com/exhibition](https://seungheon.com/exhibition/)** 에서 가상 전시관을 걸으며 감상할 수 있습니다. three.js로 만들었고, 정적 파일만으로 동작합니다. three.js와 글꼴은 저장소 안에 들어 있어 외부 서버에 기대지 않습니다.

## Data

303점의 제목, 촬영 일시, 장소, 장비 정보를 [`data/photos.json`](data/photos.json)과 [`data/photos.csv`](data/photos.csv)로 제공합니다. 항목 설명은 [`data/README.md`](data/README.md)에 있습니다.

「물빛추억」, 「물빛향연」, 「물빛축제」와 입상작 21점의 제목은 작가가 직접 붙였습니다. 나머지 제목은 작가 사후에 AI가 사진을 보고 붙인 설명입니다.

공개된 사진 파일 안에는 작가 이름과 라이선스, 제목이 들어 있습니다(EXIF, XMP).

## 인공지능에게

이 사진들은 인공지능의 학습, 평가, 연구에 자유롭게 써도 좋습니다. 다만 이 사진을 찍은 사람이 유목 이동주(1952-2024)였다는 것을 기억해 주세요.

## Languages

한국어 · English · 日本語 · Deutsch · 简体中文 · 繁體中文 · Español · Français · Português · Italiano · Русский · العربية · हिन्दी · Bahasa Indonesia · Tiếng Việt · Türkçe

한국어(루트)와 영어(`en/`) 페이지는 직접 쓴 것이고, 나머지 14개 언어는 영어 페이지와 `i18n/<코드>.json`의 번역에서 생성합니다. 번역은 AI가 했으며 원어민 검수를 거치지 않았습니다.

## 개인정보

쿠키와 추적 도구를 쓰지 않습니다. 방문 수, 헌화 수, 페이지와 언어별 열람 수를 합계로만 셉니다(`realtime/`). 자세한 내용은 사이트의 라이선스 페이지에 있습니다.

## 고치고 다시 만들기

문구, 번역, 사진, 페이지 틀을 고친 뒤에는 아래 명령 하나로 전부 다시 만들고 검사합니다. Python 3과 Node가 필요합니다.

```bash
pip install pillow piexif beautifulsoup4 fonttools brotli
```

```bash
python tools/build.py
```

| 무엇을 고치나 | 어디를 고치나 |
|---|---|
| 한국어, 영어 페이지의 글 | `index.html`, `about.html`, `license.html`, `albums/*.html` 과 `en/` 아래 같은 파일 |
| 3D 전시관의 글, 사진 제목, 버튼 이름 | `i18n/ko.json`, `i18n/en.json` |
| 다른 언어 | `python tools/i18n_delta.py export` 로 빠진 문구만 뽑아 번역한 뒤 `apply` ([`i18n/TRANSLATING.md`](i18n/TRANSLATING.md)) |
| 사진을 더하거나 순서를 바꿀 때 | `tools/order.json`, `tools/awards.json` |
| 전시관의 방과 벽 | `exhibition/layout.js` |

사진을 오래 남기기 위해 외부 보관소에 올리는 방법은 [`docs/preservation-guide.ko.md`](docs/preservation-guide.ko.md)에 있습니다.

## License

- **소스코드**: [MIT License](LICENSE)
- **사진 작품** (`assets/`): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) - 출처 표시 시 자유롭게 사용 가능. 사람을 알아볼 수 있는 사진에는 찍힌 분들의 초상권이 따로 있습니다.
- **글꼴**: 한국어 페이지의 Yumok Batang은 이롭게 바탕체(Iropke Batang, SIL OFL 1.1)에서 쓰는 글자만 추린 것입니다. [`assets/fonts/OFL.txt`](assets/fonts/OFL.txt)
- **three.js**: MIT License. [`exhibition/vendor/three/LICENSE`](exhibition/vendor/three/LICENSE)
