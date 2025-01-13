// 팝업 요소 가져오기
const popup = document.createElement('div');
popup.classList.add('popup');
popup.innerHTML = `
    <button class="close-btn">닫기</button>
    <button class="download-btn">다운로드</button>
    <img src="" alt="Popup Image">
`;
document.body.appendChild(popup);

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

// 닫기 버튼 이벤트
closeBtn.addEventListener('click', () => {
    popup.style.display = 'none';
});

// 팝업 외부 클릭 시 닫기
popup.addEventListener('click', (e) => {
    if (e.target === popup) {
        popup.style.display = 'none';
    }
});
