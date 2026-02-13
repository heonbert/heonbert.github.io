import os
import json

# 앨범 설정
albums = [
    {
        "name": "abstract",
        "title": "추상",
        "cover": "assets/abstract/cover.jpg",
        "description": "물과 빛이 만들어내는 추상적인 아름다움을 담은 사진 작품",
        "subtitle": "물과 빛이 만들어내는 추상적 아름다움",
        "keywords": "유목, 이동주, 추상사진, 물빛사진, 예술사진, 추상예술, 물사진, 빛사진",
    },
    {
        "name": "reflection",
        "title": "반영",
        "cover": "assets/reflection/cover.jpg",
        "description": "수면 위에 비친 자연의 아름다움을 담은 사진 작품",
        "subtitle": "수면 위에 비친 자연의 아름다움",
        "keywords": "유목, 이동주, 반영사진, 물빛사진, 수면반영, 물반영, 예술사진, 자연사진",
    },
    {
        "name": "pattern",
        "title": "문양",
        "cover": "assets/pattern/cover.jpg",
        "description": "자연이 만들어낸 아름다운 문양과 패턴을 담은 사진 작품",
        "subtitle": "자연이 만들어낸 아름다운 문양과 패턴",
        "keywords": "유목, 이동주, 문양사진, 물빛사진, 자연문양, 패턴사진, 예술사진, 자연패턴",
    },
    {
        "name": "landscape",
        "title": "풍경",
        "cover": "assets/landscape/cover.jpg",
        "description": "자연의 아름다운 풍경을 담은 사진 작품",
        "subtitle": "자연의 아름다운 풍경을 담은 작품",
        "keywords": "유목, 이동주, 풍경사진, 물빛사진, 자연풍경, 예술사진, 한국풍경, 자연사진",
    },
]

SITE_URL = "https://seungheon.com"
GA_MEASUREMENT_ID = "G-9ZBRVGQ4CH"


def generate_album_html(album):
    image_dir = f"assets/{album['name']}"
    output_file = f"albums/{album['name']}.html"

    if not os.path.exists(image_dir):
        print(f"경고: {image_dir} 디렉토리가 없습니다. 건너뜁니다.")
        return

    image_files = sorted([
        f for f in os.listdir(image_dir)
        if f.lower().endswith(('.jpg', '.jpeg', '.png', '.gif')) and f != 'cover.jpg'
    ])

    if not image_files:
        print(f"경고: {image_dir}에 이미지 파일이 없습니다. 건너뜁니다.")
        return

    count = len(image_files)
    title = album['title']
    name = album['name']
    desc = album['description']
    subtitle = album['subtitle']
    keywords = album['keywords']

    # 이미지 태그 생성 (lazy loading + 의미있는 alt 텍스트)
    image_tags = "\n".join([
        f'                <img src="../{image_dir}/{img}" alt="유목 이동주 {title} 사진 작품 {i}" class="gallery-image" loading="lazy">'
        for i, img in enumerate(image_files, 1)
    ])

    # JSON-LD 구조화 데이터
    jsonld = json.dumps({
        "@context": "https://schema.org",
        "@type": "ImageGallery",
        "name": f"{title} 앨범 - 유목의 물빛사진",
        "description": desc,
        "url": f"{SITE_URL}/albums/{name}.html",
        "numberOfItems": count,
        "author": {
            "@type": "Person",
            "name": "이동주",
            "alternateName": "유목 (流木)"
        }
    }, ensure_ascii=False, indent=8)

    html_content = f"""<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">

    <!-- Google Analytics -->
    <script async src="https://www.googletagmanager.com/gtag/js?id={GA_MEASUREMENT_ID}"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){{dataLayer.push(arguments);}}
        gtag('js', new Date());
        gtag('config', '{GA_MEASUREMENT_ID}');
    </script>

    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} 앨범 - 유목의 물빛사진</title>
    <meta name="description" content="유목(流木) 이동주 작가의 {title} 사진 작품 갤러리. {desc} {count}점.">
    <meta name="keywords" content="{keywords}">
    <link rel="canonical" href="{SITE_URL}/albums/{name}.html">
    <link rel="icon" type="image/x-icon" href="../favicon.ico">
    <link rel="icon" type="image/png" sizes="32x32" href="../favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="../favicon-16x16.png">
    <link rel="apple-touch-icon" sizes="180x180" href="../apple-touch-icon.png">
    <link rel="manifest" href="../site.webmanifest">
    <meta name="theme-color" content="#0a0e14">

    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:title" content="{title} 앨범 - 유목의 물빛사진">
    <meta property="og:description" content="유목(流木) 이동주 작가의 {title} 사진 작품 갤러리. {desc}.">
    <meta property="og:url" content="{SITE_URL}/albums/{name}.html">
    <meta property="og:image" content="{SITE_URL}/{album['cover']}">
    <meta property="og:locale" content="ko_KR">
    <meta property="og:site_name" content="유목의 물빛사진">

    <!-- 구조화 데이터 -->
    <script type="application/ld+json">
    {jsonld}
    </script>

    <link rel="stylesheet" href="../style.css">
</head>
<body>
    <header>
        <h1>{title} 앨범</h1>
        <p>{subtitle}</p>
        <a href="../index.html" class="home-link">홈으로 돌아가기</a>
    </header>
    <main>
        <section class="gallery">
            <h2>{title} 작품 · {count}</h2>
            <div class="grid">
{image_tags}
            </div>
        </section>
    </main>
    <footer>
        <a href="../index.html" class="home-link">홈으로 돌아가기</a>
        <p>&copy; 유목의 물빛사진</p>
        <p class="footer-contact"><a href="https://github.com/heonbert/heonbert.github.io" target="_blank" rel="noopener">GitHub</a></p>
    </footer>

    <button class="scroll-top" aria-label="위로 가기">&#9650;</button>

    <script>
        document.body.classList.add('intro-animate');
        window.addEventListener('pageshow', function(e) {
            if (e.persisted) document.body.classList.remove('intro-animate');
        });
    </script>
    <script src="../popup_gallery.js"></script>
    <script>
        // 위로 가기 버튼
        const scrollTopBtn = document.querySelector('.scroll-top');
        window.addEventListener('scroll', () => {{
            if (window.scrollY > 400) {{
                scrollTopBtn.classList.add('visible');
            }} else {{
                scrollTopBtn.classList.remove('visible');
            }}
        }});
        scrollTopBtn.addEventListener('click', () => {{
            window.scrollTo({{ top: 0, behavior: 'smooth' }});
        }});
    </script>
</body>
</html>
"""

    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as file:
        file.write(html_content)

    print(f"HTML 파일 생성 완료: {output_file} ({count}개 이미지)")


# 모든 앨범에 대해 HTML 생성
for album in albums:
    generate_album_html(album)

print("\n앨범 HTML 생성 완료.")
print("참고: index.html은 수동으로 관리됩니다. (SEO 메타태그, JSON-LD 등 포함)")
