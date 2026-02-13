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

    // 언어 감지
    var lang = document.documentElement.lang || 'ko';

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

    var messages = {
        ko: {
            desktop: 'Ctrl+D를 눌러 즐겨찾기에 추가하세요',
            mac: '\u2318+D를 눌러 즐겨찾기에 추가하세요',
            iosGuide: '하단 공유 버튼(□↑)을 누른 후\n"홈 화면에 추가"를 선택하세요',
            androidGuide: '브라우저 메뉴(⋮)에서\n"홈 화면에 추가"를 선택하세요',
            installed: '홈 화면에 추가되었습니다!',
            dismissed: '브라우저 메뉴(⋮)에서\n"홈 화면에 추가"를 선택하세요',
            alreadyInstalled: '이미 앱으로 설치되어 있습니다 ✓',
            alreadyStandalone: '이미 앱으로 실행 중입니다'
        },
        en: {
            desktop: 'Press Ctrl+D to bookmark this page',
            mac: 'Press \u2318+D to bookmark this page',
            iosGuide: 'Tap the Share button (□↑) below,\nthen select "Add to Home Screen"',
            androidGuide: 'Tap browser menu (\u22ee) and select\n"Add to Home Screen"',
            installed: 'Added to Home Screen!',
            dismissed: 'Tap browser menu (\u22ee) and select\n"Add to Home Screen"',
            alreadyInstalled: 'Already installed as an app ✓',
            alreadyStandalone: 'Already running as an app'
        },
        ja: {
            desktop: 'Ctrl+Dでブックマークに追加できます',
            mac: '\u2318+Dでブックマークに追加できます',
            iosGuide: '下の共有ボタン(□↑)をタップし、\n「ホーム画面に追加」を選択してください',
            androidGuide: 'ブラウザメニュー(\u22ee)から\n「ホーム画面に追加」を選択してください',
            installed: 'ホーム画面に追加しました！',
            dismissed: 'ブラウザメニュー(\u22ee)から\n「ホーム画面に追加」を選択してください',
            alreadyInstalled: 'すでにアプリとしてインストール済みです ✓',
            alreadyStandalone: 'すでにアプリとして実行中です'
        },
        de: {
            desktop: 'Dr\u00fccken Sie Strg+D, um ein Lesezeichen zu setzen',
            mac: 'Dr\u00fccken Sie \u2318+D, um ein Lesezeichen zu setzen',
            iosGuide: 'Tippen Sie auf Teilen (□↑) unten,\ndann "Zum Home-Bildschirm"',
            androidGuide: 'Tippen Sie auf das Browsermen\u00fc (\u22ee)\nund w\u00e4hlen Sie "Zum Home-Bildschirm"',
            installed: 'Zum Home-Bildschirm hinzugef\u00fcgt!',
            dismissed: 'Tippen Sie auf das Browsermen\u00fc (\u22ee)\nund w\u00e4hlen Sie "Zum Home-Bildschirm"',
            alreadyInstalled: 'Bereits als App installiert ✓',
            alreadyStandalone: 'Bereits als App ge\u00f6ffnet'
        }
    };

    var msg = messages[lang] || messages.ko;

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
                    // appinstalled 이벤트에서 처리되므로 토스트는 여기서 표시
                    showToast(msg.installed);
                } else {
                    if (isMobile) {
                        showToast(msg.dismissed);
                    }
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
