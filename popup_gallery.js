// 갤러리 이미지 배열
const galleryImages = Array.from(document.querySelectorAll('.gallery img'));
let currentIndex = 0;

// 팝업 요소 생성
const popup = document.createElement('div');
popup.classList.add('popup');
popup.innerHTML = `
    <div class="popup-content">
        <button class="popup-nav popup-prev" aria-label="이전 사진">&#10094;</button>
        <img src="" alt="Popup Image">
        <button class="popup-nav popup-next" aria-label="다음 사진">&#10095;</button>
        <button class="close-btn" aria-label="닫기">&times;</button>
        <div class="popup-bottom">
            <span class="popup-counter"></span>
            <a class="download-btn" href="" download>다운로드</a>
        </div>
    </div>
`;
document.body.appendChild(popup);

// 팝업 내부 요소 참조
const popupImage = popup.querySelector('img');
const closeBtn = popup.querySelector('.close-btn');
const downloadBtn = popup.querySelector('.download-btn');
const prevBtn = popup.querySelector('.popup-prev');
const nextBtn = popup.querySelector('.popup-next');
const counter = popup.querySelector('.popup-counter');

// 이미지 표시
function showImage(index) {
    if (galleryImages.length === 0) return;
    currentIndex = ((index % galleryImages.length) + galleryImages.length) % galleryImages.length;
    const image = galleryImages[currentIndex];
    popupImage.src = image.src;
    popupImage.alt = image.alt;
    downloadBtn.href = image.src;
    downloadBtn.download = image.src.split('/').pop();
    counter.textContent = `${currentIndex + 1} / ${galleryImages.length}`;

    // 네비게이션 버튼 표시/숨김
    prevBtn.style.display = galleryImages.length > 1 ? '' : 'none';
    nextBtn.style.display = galleryImages.length > 1 ? '' : 'none';
}

// 팝업 열기
function openPopup(index) {
    showImage(index);
    popup.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// 팝업 닫기
function closePopup() {
    popup.style.display = 'none';
    document.body.style.overflow = '';
}

// 갤러리 이미지 클릭 이벤트
galleryImages.forEach((image, index) => {
    image.addEventListener('click', () => openPopup(index));
});

// 닫기 버튼
closeBtn.addEventListener('click', closePopup);

// 이전/다음 버튼
prevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showImage(currentIndex - 1);
});
nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showImage(currentIndex + 1);
});

// 배경 클릭으로 닫기
popup.addEventListener('click', (e) => {
    if (e.target === popup) closePopup();
});

// 키보드 이벤트
document.addEventListener('keydown', (e) => {
    if (popup.style.display !== 'flex') return;
    if (e.key === 'Escape') closePopup();
    if (e.key === 'ArrowLeft') showImage(currentIndex - 1);
    if (e.key === 'ArrowRight') showImage(currentIndex + 1);
});

// 터치 스와이프 지원
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;

popup.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, { passive: true });

popup.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    const diffX = touchStartX - touchEndX;
    const diffY = Math.abs(touchStartY - touchEndY);

    // 수평 스와이프만 처리 (수직 이동이 작을 때)
    if (Math.abs(diffX) > 50 && diffY < 100) {
        if (diffX > 0) {
            showImage(currentIndex + 1); // 왼쪽 스와이프 → 다음
        } else {
            showImage(currentIndex - 1); // 오른쪽 스와이프 → 이전
        }
    }
}, { passive: true });
