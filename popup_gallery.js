// 갤러리 이미지 배열
const galleryImages = Array.from(document.querySelectorAll('.gallery img'));
let currentIndex = 0;

// 모바일 감지
const isMobile = () => window.innerWidth <= 580;

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
            <a class="download-btn" href="" download aria-label="다운로드"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></a>
            <button class="share-btn" aria-label="공유"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></button>
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
const shareBtn = popup.querySelector('.share-btn');

// Web Share API 미지원 시 공유 버튼 숨김
if (!navigator.share) {
    shareBtn.style.display = 'none';
}

// 이미지 전환 애니메이션 방향
let slideDirection = 'none'; // 'up', 'down', 'none'

// 이미지 표시
function showImage(index, direction) {
    if (galleryImages.length === 0) return;
    currentIndex = ((index % galleryImages.length) + galleryImages.length) % galleryImages.length;
    const image = galleryImages[currentIndex];

    // URL 해시 업데이트 (사진 번호는 1부터)
    history.replaceState(null, '', '#img=' + (currentIndex + 1));

    direction = direction || 'none';

    // 모바일 숏츠 스타일 전환 애니메이션
    if (direction !== 'none' && isMobile()) {
        const slideOut = direction === 'up' ? 'slideOutUp' : 'slideOutDown';
        const slideIn = direction === 'up' ? 'slideInUp' : 'slideInDown';

        popupImage.style.animation = `${slideOut} 0.25s ease-in forwards`;
        setTimeout(() => {
            popupImage.src = image.src;
            popupImage.alt = image.alt;
            downloadBtn.href = image.src;
            downloadBtn.download = image.src.split('/').pop();
            counter.textContent = `${currentIndex + 1} / ${galleryImages.length}`;
            popupImage.style.animation = `${slideIn} 0.25s ease-out forwards`;
        }, 200);
    } else {
        popupImage.src = image.src;
        popupImage.alt = image.alt;
        downloadBtn.href = image.src;
        downloadBtn.download = image.src.split('/').pop();
        counter.textContent = `${currentIndex + 1} / ${galleryImages.length}`;
        if (!isMobile()) {
            popupImage.style.animation = 'imageReveal 0.3s ease-out';
        }
    }

    // 네비게이션 버튼 표시/숨김
    prevBtn.style.display = galleryImages.length > 1 ? '' : 'none';
    nextBtn.style.display = galleryImages.length > 1 ? '' : 'none';
}

// 팝업 열기
function openPopup(index) {
    showImage(index, 'none');
    popup.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    // 모바일에서 pull-to-refresh 차단
    if (isMobile()) {
        document.body.style.overscrollBehavior = 'none';
    }
}

// 팝업 닫기
function closePopup() {
    popup.style.display = 'none';
    document.body.style.overflow = '';
    document.body.style.overscrollBehavior = '';
    // 해시 제거
    history.replaceState(null, '', window.location.pathname + window.location.search);
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
    showImage(currentIndex - 1, 'down');
});
nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showImage(currentIndex + 1, 'up');
});

// 공유 버튼 — 현재 보고 있는 사진의 직접 링크를 공유
shareBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const shareUrl = window.location.origin + window.location.pathname + '#img=' + (currentIndex + 1);
    try {
        await navigator.share({
            title: document.title,
            url: shareUrl
        });
    } catch (err) {
        // 사용자가 공유 취소한 경우 무시
    }
});

// 배경 클릭으로 닫기
popup.addEventListener('click', (e) => {
    if (e.target === popup) closePopup();
});

// 키보드 이벤트
document.addEventListener('keydown', (e) => {
    if (popup.style.display !== 'flex') return;
    if (e.key === 'Escape') closePopup();
    if (e.key === 'ArrowLeft') showImage(currentIndex - 1, 'down');
    if (e.key === 'ArrowRight') showImage(currentIndex + 1, 'up');
    if (e.key === 'ArrowUp') showImage(currentIndex - 1, 'down');
    if (e.key === 'ArrowDown') showImage(currentIndex + 1, 'up');
});

// 터치 스와이프 (숏츠 스타일)
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let isSwiping = false;

popup.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
    isSwiping = true;
}, { passive: false });

popup.addEventListener('touchmove', (e) => {
    if (!isSwiping) return;
    // 팝업 열려있을 때 스크롤/pull-to-refresh 완전 차단
    e.preventDefault();
}, { passive: false });

popup.addEventListener('touchend', (e) => {
    if (!isSwiping) return;
    isSwiping = false;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchStartX - touchEndX;
    const diffY = touchStartY - touchEndY;
    const absDiffX = Math.abs(diffX);
    const absDiffY = Math.abs(diffY);
    const elapsed = Date.now() - touchStartTime;

    // 빠른 플릭도 감지 (짧은 거리여도 빠르면 인정)
    const minSwipe = elapsed < 300 ? 30 : 50;

    if (isMobile()) {
        // 모바일: 세로 스와이프 우선 (숏츠 스타일)
        if (absDiffY > minSwipe && absDiffY > absDiffX * 0.7) {
            if (diffY > 0) {
                showImage(currentIndex + 1, 'up');   // 위로 밀면 → 다음
            } else {
                showImage(currentIndex - 1, 'down'); // 아래로 밀면 → 이전
            }
        }
        // 가로 스와이프도 지원
        else if (absDiffX > minSwipe && absDiffX > absDiffY) {
            if (diffX > 0) {
                showImage(currentIndex + 1, 'up');
            } else {
                showImage(currentIndex - 1, 'down');
            }
        }
    } else {
        // PC/태블릿: 가로 스와이프만
        if (absDiffX > 50 && absDiffY < 100) {
            if (diffX > 0) {
                showImage(currentIndex + 1, 'up');
            } else {
                showImage(currentIndex - 1, 'down');
            }
        }
    }
}, { passive: false });

// 페이지 로드 시 해시 확인 → 해당 사진 자동 열기
(function checkHashOnLoad() {
    const hash = window.location.hash;
    const match = hash.match(/^#img=(\d+)$/);
    if (match) {
        const imgNum = parseInt(match[1], 10);
        if (imgNum >= 1 && imgNum <= galleryImages.length) {
            // 이미지 로딩 대기 후 팝업 열기
            setTimeout(() => openPopup(imgNum - 1), 300);
        }
    }
})();
