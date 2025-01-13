// 팝업 요소 생성
const popup = document.createElement('div');
popup.classList.add('popup');
popup.innerHTML = `
    <div class="popup-content">
        <img src="" alt="Popup Image">
        <button class="close-btn">닫기</button>
        <a class="download-btn" href="" download>다운로드</a>
    </div>
`;
document.body.appendChild(popup);

// 팝업 내부 요소 참조
const popupContent = popup.querySelector('.popup-content');
const popupImage = popup.querySelector('img');
const closeBtn = popup.querySelector('.close-btn');
const downloadBtn = popup.querySelector('.download-btn');

// 갤러리 이미지 클릭 이벤트 추가
const galleryImages = document.querySelectorAll('.gallery img');
galleryImages.forEach(image => {
    image.addEventListener('click', () => {
        popup.style.display = 'flex';
        popupImage.src = image.src;
        downloadBtn.href = image.src;
        downloadBtn.download = image.src.split('/').pop();
    });
});

// 팝업 닫기 이벤트
closeBtn.addEventListener('click', () => {
    popup.style.display = 'none';
});

popup.addEventListener('click', (e) => {
    if (e.target === popup) {
        popup.style.display = 'none';
    }
});

// ESC 키로 닫기
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        popup.style.display = 'none';
    }
});

// 앨범 카드 이미지와 버튼 동작 통합
const albumCards = document.querySelectorAll('.album-card');
albumCards.forEach(card => {
    const link = card.querySelector('a');
    const img = card.querySelector('img');

    img.addEventListener('click', () => {
        link.click(); // 이미지를 클릭하면 버튼처럼 동작
    });
});