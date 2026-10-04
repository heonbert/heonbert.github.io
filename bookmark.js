// Service Worker 등록 (PWA 설치 프롬프트에 필요)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(function() {});
}

// 즐겨찾기 / 홈 화면 추가 버튼 기능
(function() {
    var btn = document.querySelector('.bookmark-btn');
    if (!btn) return;

    var toast = document.getElementById('bookmark-toast');
    var toastTimer;

    // PWA 설치 프롬프트 저장
    var deferredPrompt = null;
    var isInstalledPwa = false;

    // 환경 감지
    // iPadOS 13+는 UA에 iPad가 없고 MacIntel로 나옴 → maxTouchPoints로 구분
    var isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var isAndroid = /Android/i.test(navigator.userAgent);
    var isMobile = isIOS || isAndroid;
    // Mac 감지: userAgentData (최신) → platform (레거시) → userAgent 폴백
    var isMac = false;
    if (navigator.userAgentData && navigator.userAgentData.platform) {
        isMac = navigator.userAgentData.platform === 'macOS';
    } else {
        isMac = /Mac/.test(navigator.platform || navigator.userAgent);
    }
    // iPad는 Mac이 아니라 iOS로 처리
    if (isIOS) isMac = false;

    var isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;

    // PWA 설치 여부 확인 (getInstalledRelatedApps API)
    if ('getInstalledRelatedApps' in navigator) {
        navigator.getInstalledRelatedApps().then(function(apps) {
            if (apps.length > 0) {
                isInstalledPwa = true;
                btn.classList.add('bookmarked');
            }
        }).catch(function() {});
    }

    // 안내 문구는 각 언어의 페이지가 넘겨준다(window.YUMOK_LABELS). 없으면 영어.
    var L = window.YUMOK_LABELS || {};
    var msg = {
        desktop: L.bm_desktop || 'Press Ctrl+D to bookmark this page',
        mac: L.bm_mac || 'Press ⌘+D to bookmark this page',
        iosGuide: L.bm_ios || 'Tap the Share button below,\nthen select "Add to Home Screen"',
        androidGuide: L.bm_android || 'Tap the browser menu and select\n"Add to Home Screen"',
        installed: L.bm_installed || 'Added to Home Screen!',
        alreadyInstalled: L.bm_already || 'Already installed as an app',
        alreadyStandalone: L.bm_running || 'Already running as an app'
    };

    // beforeinstallprompt 이벤트 캡처
    window.addEventListener('beforeinstallprompt', function(e) {
        e.preventDefault();
        deferredPrompt = e;
    });

    // 설치 완료 감지 (appinstalled에서만 토스트 표시)
    window.addEventListener('appinstalled', function() {
        deferredPrompt = null;
        isInstalledPwa = true;
        btn.classList.add('bookmarked');
    });

    function showToast(text) {
        if (!toast) return;
        toast.textContent = text;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function() {
            toast.classList.remove('show');
        }, 4000);
    }

    // 이미 standalone 모드면 별표 금색으로
    if (isStandalone) {
        btn.classList.add('bookmarked');
    }

    btn.addEventListener('click', function() {
        // 이미 PWA(standalone)로 실행 중
        if (isStandalone) {
            showToast(msg.alreadyStandalone);
            return;
        }

        // 이미 설치됨 (getInstalledRelatedApps로 확인)
        if (isInstalledPwa) {
            showToast(msg.alreadyInstalled);
            return;
        }

        // PWA 설치 프롬프트 (데스크톱·모바일 공통)
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(function(choiceResult) {
                if (choiceResult.outcome === 'accepted') {
                    showToast(msg.installed);
                } else if (isMobile) {
                    showToast(msg.androidGuide);
                }
                deferredPrompt = null;
            });
            return;
        }

        // PWA 프롬프트 없는 환경 폴백
        if (isIOS) {
            showToast(msg.iosGuide);
        } else if (isAndroid) {
            showToast(msg.androidGuide);
        } else if (isMac) {
            showToast(msg.mac);
        } else {
            showToast(msg.desktop);
        }
    });
})();
