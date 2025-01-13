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
    <title>{album_title} 앨범 - 물빛사진 갤러리</title>
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
        <p>© 2025 물빛사진 갤러리</p>
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

# 모든 앨범에 대해 HTML 생성
for album in albums:
    generate_album_html(album)
