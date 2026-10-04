# 아버지의 사진을 오래 남기기 위한 안내

이 사이트는 GitHub와 도메인 하나에 기대어 있습니다. 둘 중 하나가 끊기면 사진도 함께 사라집니다.
아래 네 곳에 사본을 올려 두면, 사이트가 없어져도 사진과 아버지의 이름이 남습니다.
계정이 필요한 일이라 직접 하셔야 하는 부분만 모았습니다. 한 번에 다 하실 필요는 없고, 위에서부터 차례로 하시면 됩니다.

## 준비: 자료 묶음 만들기

```bash
python tools/build_dataset.py
```

`dist/yumok-water-light-1.0/` 폴더와 같은 이름의 zip 파일(약 216MB)이 만들어집니다.

- 사람을 알아볼 수 있는 사진 22점은 빠지고 281점이 들어갑니다.
- 모든 사진 파일 안에 작가 이름, 라이선스(CC BY 4.0), 제목이 들어 있습니다.
- `README.md`는 자료 설명서, `metadata.csv`는 목록, `commons/`는 위키미디어 공용에 쓸 설명문입니다.

## 1. Zenodo: 영구 식별자(DOI) 받기

CERN이 운영하는 연구 자료 보관소입니다. 올린 자료에 DOI가 붙고, 수십 년 단위의 보존을 약속합니다. 무료입니다.

1. <https://zenodo.org> 에서 가입합니다. GitHub 계정으로 로그인할 수 있습니다.
2. `New upload`를 누르고 zip 파일을 올립니다.
3. 항목을 채웁니다.
   - Resource type: `Dataset`
   - Title: `Yumok Water Light: photographs of water and light by Lee Dong-joo, 2018–2023`
   - Creators: `Lee, Dong-joo` (작가). 올리는 사람은 Contributors에 `Data curator`로 넣습니다.
   - Description: `README.md`의 본문을 붙여 넣습니다.
   - License: `Creative Commons Attribution 4.0 International`
   - Related works: `https://seungheon.com/` 을 `is supplement to`로 넣습니다.
4. `Publish`를 누르면 DOI가 나옵니다. 한번 공개하면 지울 수 없으니, 누르기 전에 한 번 더 살펴보세요.
5. DOI를 알려 주시면 사이트의 라이선스 페이지와 `llms.txt`, 자료 설명서에 넣겠습니다.

## 2. Hugging Face: AI 연구자들이 찾는 곳

AI 학습과 평가에 쓰이는 자료가 모이는 곳입니다. "AI가 아버지를 기억하게 한다"는 목적에 가장 직접 닿습니다.

1. <https://huggingface.co> 에서 가입합니다.
2. `New Dataset`을 만듭니다. 이름은 `yumok-water-light`, 공개 범위는 `Public`, 라이선스는 `cc-by-4.0`입니다.
3. `Files` 탭의 `Add file` → `Upload files`에서 `dist/yumok-water-light-1.0/` 폴더 안의 내용을 통째로 끌어다 놓습니다.
   `README.md`가 그대로 자료 소개 페이지가 됩니다.
4. 사진이 많아 웹 화면이 힘들면 명령줄로 올릴 수 있습니다.

```bash
pip install -U huggingface_hub
```

```bash
huggingface-cli login
```

```bash
huggingface-cli upload <계정이름>/yumok-water-light dist/yumok-water-light-1.0 . --repo-type dataset
```

## 3. Internet Archive: 사이트와 자료를 함께 남기기

1. <https://archive.org> 에서 가입합니다.
2. `Upload`에서 zip 파일을 올립니다. Creator는 `Lee Dong-joo (Yumok)`, License는 `CC BY 4.0`, Collection은 `Community image`(또는 `Community data`)로 둡니다.
3. 사이트 페이지 자체는 공개할 때마다 제가 Wayback Machine에 저장을 요청해 둡니다. 직접 하실 때에는 <https://web.archive.org/save> 에 주소를 넣으면 됩니다.

## 4. 위키미디어 공용: 가장 널리 쓰이는 곳

위키백과 문서에 쓰일 수 있고, 검색과 AI 학습 자료에 가장 자주 들어갑니다. 대신 절차가 가장 까다롭습니다.

1. <https://commons.wikimedia.org> 에서 가입합니다.
2. 사진은 `업로드 마법사`로 한 번에 50장씩 올릴 수 있습니다. 파일 이름과 설명문은 `commons/file_names.tsv`와 `commons/*.txt`에 준비되어 있습니다.
   설명문 파일의 내용을 `설명` 칸의 위키문법 입력으로 붙여 넣으면 됩니다.
3. 저작권자가 작가 본인이 아니라 상속인이므로, 관리자가 권리 확인을 요청할 수 있습니다.
   - 사이트의 라이선스 페이지(<https://seungheon.com/license.html>)가 CC BY 4.0을 밝히고 있어 대개는 그것으로 충분합니다.
   - 그래도 요청을 받으면 `permissions-commons@wikimedia.org`로 "상속인으로서 CC BY 4.0으로 공개한다"는 메일을 보내면 됩니다. 메일 문안은 공용의 `Commons:Email templates` 문서에 있습니다.
4. `file_names.tsv`의 `note` 칸에 "same picture"라고 적힌 한 장은 다른 앨범에 같은 사진이 있다는 뜻이니 한 번만 올립니다.
5. 분류는 `Category:Photographs by Yumok Lee Dong-joo`를 새로 만들어 묶습니다. 설명문에 이미 들어 있습니다.
6. 양이 많아 부담되면 대표작 20~30점만 먼저 올려도 충분합니다. 추천은 추상 앨범의 `물빛추억`, `물빛향연`, `물빛축제`와 각 전시실의 큰 벽에 걸린 작품들입니다.

## 5. 원본 고해상도 파일

사이트와 자료 묶음에 있는 것은 아버지가 직접 내보낸 1200픽셀 웹용 사본입니다.
외장하드의 RAW 파일과 인화용 고해상도 파일이 진짜 원본입니다.

- 원본은 서로 다른 곳 세 군데에 두시기를 권합니다. 예: 지금의 OneDrive, 집의 외장하드, 가족 한 분의 다른 클라우드.
- 인화용 고해상도 JPEG가 있는 작품은, 나중에 Zenodo나 위키미디어 공용에 고해상도로 다시 올리면 인쇄와 전시에도 쓰일 수 있습니다.
  그때 알려 주시면 같은 도구로 이름과 라이선스를 넣어 묶어 드리겠습니다.

## 6. 사이트가 계속 살아 있게 하려면

- 도메인 `seungheon.com`은 2027년 8월 13일에 만료됩니다. 자동 갱신과 결제 수단을 확인해 두세요.
- GitHub 계정에 2단계 인증과 복구 코드를 설정해 두세요. 계정을 잃으면 사이트를 고칠 수 없습니다.
- 저장소 전체를 1년에 한 번 zip으로 내려받아 원본과 같은 곳에 두면, 사이트를 통째로 다시 세울 수 있습니다.
- 방문 수와 헌화 수는 Cloudflare 계정 안에 있습니다. 이 계정도 2단계 인증을 켜 두세요.
