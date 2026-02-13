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
    var pwaSupported = false; // beforeinstallprompt를 한 번이라도 받았는지

    // 환경 감지
    var isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    var isAndroid = /Android/i.test(navigator.userAgent);
    var isMobile = isIOS || isAndroid;
    var isMac = /Mac/.test(navigator.platform || '');
    var isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;

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
        pwaSupported = true;
    });

    // 설치 완료 감지
    window.addEventListener('appinstalled', function() {
        deferredPrompt = null;
        showToast(msg.installed);
        btn.classList.add('bookmarked');
    });

    function showToast(text) {
        if (!toast) return;
        toast.textContent = text;
        toast.style.whiteSpace = 'pre-line';
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

        // 1순위: PWA 설치 프롬프트 (데스크톱·모바일 공통)
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(function(choiceResult) {
                if (choiceResult.outcome === 'accepted') {
                    showToast(msg.installed);
                    btn.classList.add('bookmarked');
                } else {
                    // 거절 시: 모바일이면 메뉴 안내, 데스크톱이면 즐겨찾기 안내
                    if (isMobile) {
                        showToast(msg.dismissed);
                    }
                }
                deferredPrompt = null;
            });
            return;
        }

        // 2순위: deferredPrompt 없음
        // iOS: beforeinstallprompt 미지원이므로 항상 공유 안내
        if (isIOS) {
            showToast(msg.iosGuide);
            return;
        }
        // Android/데스크톱: beforeinstallprompt를 지원하는 브라우저인데
        // 이벤트가 안 왔다면 = 이미 설치됨
        if ('BeforeInstallPromptEvent' in window || pwaSupported) {
            showToast(msg.alreadyInstalled);
            btn.classList.add('bookmarked');
            return;
        }
        // beforeinstallprompt 자체를 지원하지 않는 브라우저 (삼성 등)
        if (isAndroid) {
            showToast(msg.androidGuide);
            return;
        }
        // 데스크톱 (Firefox 등 PWA 미지원): 즐겨찾기 안내
        if (isMac) {
            showToast(msg.mac);
        } else {
            showToast(msg.desktop);
        }
    });
})();
