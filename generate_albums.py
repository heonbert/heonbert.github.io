import os

# 앨범 설정
albums = [
    {"name": "abstract", "title": "추상"},
    {"name": "reflection", "title": "반영"},
    {"name": "pattern", "title": "문양"},
    {"name": "landscape", "title": "풍경"},
]

# HTML 템플릿
html_template = """
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{album_title} 앨범 - 유목의 물빛사진</title>
    <link href="https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2107@1.0/Godo.woff2" rel="stylesheet" type="text/css">
    <link rel="stylesheet" href="../style.css">
</head>
<body>
    <header>
        <h1>{album_title} 앨범</h1>
        <a href="../index.html">홈으로 돌아가기</a>
    </header>
    <main>
        <section class="gallery">
            <h2>{album_title} 작품</h2>
            <div class="grid">
{images}
            </div>
        </section>
    </main>
    <footer>
        <p>© 2025 유목의 물빛사진</p>
    </footer>
    <script src="../popup_gallery.js"></script>
</body>
</html>
"""

# 메인 페이지 HTML 템플릿
index_html_template = """
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>유목의 물빛사진</title>
    <link href="https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2107@1.0/Godo.woff2" rel="stylesheet" type="text/css">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header>
        <h1>유목의 물빛사진</h1>
        <p>작가 유목 이동주의 작품 세계</p>
    </header>
    <main>
        <section class="introduction">
            <h2>작가 소개</h2>
            <p>유목 이동주 (1952-2024)</p>
            <p>군산대학교 토목공학과 교수로 재직하며 후학을 양성하셨고, 퇴임 시 황조 근정 훈장을 수훈하셨습니다. 그의 사진 작품은 물과 빛을 주제로 한 깊은 철학과 예술성을 담고 있습니다.</p>
        </section>
        <section class="albums">
            <h2>앨범</h2>
            <ul>
                <li><a href="albums/abstract.html">추상</a></li>
                <li><a href="albums/reflection.html">반영</a></li>
                <li><a href="albums/pattern.html">문양</a></li>
                <li><a href="albums/landscape.html">풍경</a></li>
            </ul>
        </section>
    </main>
    <footer>
        <p>© 2025 유목의 물빛사진</p>
    </footer>
</body>
</html>
"""

# HTML 파일 생성 함수
def generate_album_html(album):
    image_dir = f"assets/{album['name']}"
    output_file = f"albums/{album['name']}.html"

    # 이미지 파일 목록 가져오기
    if not os.path.exists(image_dir):
        print(f"경고: {image_dir} 디렉토리가 없습니다. 건너뜁니다.")
        return

    image_files = [f for f in os.listdir(image_dir) if f.endswith(('.jpg', '.jpeg', '.png', '.gif'))]

    if not image_files:
        print(f"경고: {image_dir}에 이미지 파일이 없습니다. 건너뜁니다.")
        return

    # 이미지 태그 생성
    image_tags = "\n".join([f'                <img src="../{image_dir}/{img}" alt="{img.split('.')[0]}">' for img in image_files])

    # HTML 생성
    html_content = html_template.format(album_title=album['title'], images=image_tags)

    # HTML 파일 저장
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as file:
        file.write(html_content)

    print(f"HTML 파일 생성 완료: {output_file}")

# 메인 페이지 생성 함수
def generate_index_html():
    output_file = "index.html"
    html_content = index_html_template

    # HTML 파일 저장
    with open(output_file, "w", encoding="utf-8") as file:
        file.write(html_content)

    print(f"메인 페이지 HTML 파일 생성 완료: {output_file}")

# 모든 앨범에 대해 HTML 생성
for album in albums:
    generate_album_html(album)

# 메인 페이지 HTML 생성
generate_index_html()
