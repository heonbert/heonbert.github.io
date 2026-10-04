// Motion layer for the 2D pages: a living hero, scroll choreography, a lightbox that grows out of
// its thumbnail, and the visitor count. Everything degrades to the plain page if anything fails.
import { REALTIME } from './exhibition/config.js';

const ROOT = new URL('.', import.meta.url).href;
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
const isHome = !!document.querySelector('section.albums');
const DAY = new Date().toISOString().slice(0, 10);

// which language this page is in, and the list of all of them
const I18N = await fetch(ROOT + 'data/i18n.json').then(r => r.json()).catch(() => ({ langs: [], motion: {} }));
const htmlLang = (document.documentElement.lang || 'ko').toLowerCase();
const lang = (I18N.langs.find(l => (l.html || l.code).toLowerCase() === htmlLang) || I18N.langs.find(l => l.code === htmlLang.slice(0, 2)) || { code: 'ko' }).code;
const TEXT = I18N.motion[lang] || I18N.motion.en;

/* ---------- one language menu instead of a row of codes ---------- */
function languageMenu() {
    const sw = document.querySelector('.lang-switcher');
    if (!sw || I18N.langs.length < 2) return;
    let page = location.href.slice(ROOT.length).split(/[?#]/)[0];
    const first = page.split('/')[0];
    if (I18N.langs.some(l => l.code === first)) page = page.slice(first.length + 1);
    if (page === 'index.html') page = '';
    const cur = I18N.langs.find(l => l.code === lang) || I18N.langs[0];
    sw.textContent = '';
    sw.classList.add('m-lang');
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'm-lang-btn'; btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.2 3 3.2 15 0 18M12 3c-3.2 3-3.2 15 0 18"/></svg>';
    btn.append(cur.name);
    const list = document.createElement('div'); list.className = 'm-lang-list'; list.hidden = true;
    for (const l of I18N.langs) {
        const a = document.createElement('a');
        a.href = ROOT + (l.code === 'ko' ? '' : l.code + '/') + page;
        a.textContent = l.name; a.lang = l.html || l.code;
        if (l.code === lang) { a.className = 'active'; a.setAttribute('aria-current', 'page'); }
        list.append(a);
    }
    btn.addEventListener('click', ev => { ev.stopPropagation(); list.hidden = !list.hidden; btn.setAttribute('aria-expanded', String(!list.hidden)); });
    document.addEventListener('click', ev => { if (!ev.target.closest('.m-lang, .m-lang-list')) { list.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape') list.hidden = true; });
    sw.append(btn);
    document.body.append(list);
    const place = () => { const r = btn.getBoundingClientRect(); list.style.top = (r.bottom + 8) + 'px'; list.style.right = Math.max(8, innerWidth - r.right) + 'px'; };
    btn.addEventListener('click', place);
    window.addEventListener('scroll', () => { list.hidden = true; }, { passive: true });
}

/* ---------- reveal on scroll ---------- */
function reveal(targets, { y = 30, duration = 1100, step = 70, max = 420 } = {}) {
    if (calm || !('IntersectionObserver' in window)) return;
    let alive = false;
    const io = new IntersectionObserver(entries => {
        alive = true;
        const seen = entries.filter(e => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
        seen.forEach((e, i) => {
            io.unobserve(e.target);
            const anim = e.target.animate(
                [{ opacity: 0, transform: `translateY(${y}px)` }, { opacity: 1, transform: 'none' }],
                { duration, delay: Math.min(max, i * step), easing: EASE, fill: 'backwards' });
            e.target.style.opacity = '';
            anim.finished.catch(() => {});
            e.target.dispatchEvent(new CustomEvent('m-reveal'));
        });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    for (const el of targets) { el.style.opacity = '0'; io.observe(el); }
    // never leave anything hidden: if the observer has not reported at all, show everything
    setTimeout(() => { if (!alive) { io.disconnect(); for (const el of targets) el.style.opacity = ''; } }, 2500);
}

/* ---------- title letters ---------- */
function splitTitle(h1) {
    if (calm || !h1 || h1.children.length) return;
    const text = h1.textContent;
    h1.setAttribute('aria-label', text);
    h1.textContent = '';
    // scripts whose letters join (Arabic, Devanagari) surface word by word; others letter by letter
    const joined = /[؀-ۿऀ-ॿ]/.test(text);
    const pieces = joined ? text.split(/(\s+)/) : [...text];
    pieces.forEach((ch, i) => {
        const s = document.createElement('span');
        s.className = 'm-char'; s.setAttribute('aria-hidden', 'true'); s.textContent = ch;
        h1.append(s);
        s.animate([{ opacity: 0, transform: 'translateY(0.55em)', filter: 'blur(10px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
            { duration: 1300, delay: 250 + i * (joined ? 90 : 55), easing: EASE, fill: 'backwards' });
    });
    const after = 250 + pieces.length * 55;
    for (const [i, el] of [...h1.parentElement.querySelectorAll(':scope > p, :scope > .subtitle, :scope > .home-link')].entries()) {
        el.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
            { duration: 1100, delay: after + 150 + i * 160, easing: EASE, fill: 'backwards' });
    }
}

/* ---------- hero: photographs through water ---------- */
const VS = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
const FS = `precision highp float;
uniform sampler2D uA, uB; uniform vec2 uRes, uSA, uSB, uPtr; uniform float uT, uMix, uPulse;
vec2 cover(vec2 uv, vec2 s, float zoom){ float ra = uRes.x/uRes.y, ri = s.x/s.y;
  vec2 sc = ra > ri ? vec2(1.0, ri/ra) : vec2(ra/ri, 1.0); return (uv - 0.5) * sc * zoom + 0.5; }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes; uv.y = 1.0 - uv.y;
  float asp = uRes.x / uRes.y; vec2 p = uv * vec2(asp, 1.0);
  vec2 n = vec2(sin(p.y*6.0 + uT*0.5 + sin(p.x*3.0 + uT*0.3)), cos(p.x*5.0 - uT*0.4 + cos(p.y*4.0 + uT*0.2)));
  n += 0.5 * vec2(sin(p.y*13.0 - uT*0.9 + p.x*4.0), cos(p.x*11.0 + uT*0.7 - p.y*5.0));
  vec2 dp = p - uPtr * vec2(asp, 1.0); float d = length(dp);
  n += normalize(dp + 1e-4) * sin(d*26.0 - uT*4.0) * exp(-d*5.0) * 1.8 * uPulse;
  float m = smoothstep(0.0, 1.0, uMix);
  vec2 off = n * 0.0055;
  vec3 a = texture2D(uA, cover(uv + off * (1.0 + m*6.0), uSA, 0.92 - 0.04*uMix)).rgb;
  vec3 b = texture2D(uB, cover(uv + off * (1.0 + (1.0-m)*6.0), uSB, 0.96 - 0.04*uMix)).rgb;
  float edge = clamp((m*1.4 - 0.2) - (uv.x*0.35 + (n.x*0.5 + 0.5)*0.25) + 0.3, 0.0, 1.0);
  vec3 c = mix(a, b, smoothstep(0.0, 1.0, mix(m, edge, 0.5)));
  float vig = smoothstep(1.15, 0.15, length(uv - 0.5) * 1.35);
  c *= 0.52 * mix(0.55, 1.0, vig);
  vec3 bg = vec3(0.039, 0.055, 0.078);
  c = mix(c, bg, smoothstep(0.70, 0.985, uv.y));
  c = mix(c, bg, smoothstep(0.22, 0.0, uv.y) * 0.55);
  gl_FragColor = vec4(c, 1.0);
}`;

async function hero(header) {
    header.classList.add('m-hero');
    let list;
    try { list = await (await fetch(ROOT + 'data/hero.json')).json(); } catch (e) { return; }
    if (!list.length) return;
    gateScenes(list);
    const canvas = document.createElement('canvas'); canvas.className = 'm-hero-canvas'; canvas.setAttribute('aria-hidden', 'true');
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return;
    header.prepend(canvas);
    const cap = document.createElement('a'); cap.className = 'm-hero-cap swap';
    header.append(cap);

    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = Object.fromEntries(['uA', 'uB', 'uRes', 'uSA', 'uSB', 'uPtr', 'uT', 'uMix', 'uPulse'].map(n => [n, gl.getUniformLocation(prog, n)]));
    gl.uniform1i(U.uA, 0); gl.uniform1i(U.uB, 1);

    const load = item => item.tex ? Promise.resolve(item) : new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => {
            item.tex = gl.createTexture(); item.size = [img.naturalWidth, img.naturalHeight];
            gl.bindTexture(gl.TEXTURE_2D, item.tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
            for (const k of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            res(item);
        };
        img.onerror = rej;
        img.src = ROOT + encodeURI(item.file);
    });
    const caption = item => {
        cap.classList.add('swap');
        setTimeout(() => {
            cap.textContent = '';
            const tr = (item.t && (item.t[lang] || item.t.en)) || [item.title.en, item.place_en];
            const b = document.createElement('b'); b.textContent = tr[0];
            const place = tr[1];
            cap.append(b, [place, item.year].filter(Boolean).join(' · '));
            cap.href = ROOT + 'exhibition/?lang=' + lang + '#' + item.id;
            cap.classList.remove('swap');
        }, 700);
    };

    let cur, next = null, mix = 0, index = 0, hold = 0, time = 0, pulse = 0, visible = true, last = performance.now();
    const ptr = [0.5, 0.5];
    try { cur = await load(list[0]); } catch (e) { canvas.remove(); cap.remove(); return; }
    caption(cur);
    canvas.classList.add('on');
    header.addEventListener('pointermove', ev => {
        const r = header.getBoundingClientRect();
        ptr[0] = (ev.clientX - r.left) / r.width; ptr[1] = (ev.clientY - r.top) / r.height; pulse = 1;
    });
    new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(header);
    const size = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5), w = Math.round(header.clientWidth * dpr), h = Math.round(header.clientHeight * dpr);
        if (w && h && (canvas.width !== w || canvas.height !== h)) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
    };
    function frame(now) {
        requestAnimationFrame(frame);
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (!visible || document.hidden) return;
        size();
        if (!calm) { time += dt; hold += dt; }
        pulse = Math.max(0, pulse - dt * 0.6);
        if (!next && hold > 7 && list.length > 1 && !calm) {
            hold = -1e9;
            const cand = list[(index + 1) % list.length];
            load(cand).then(item => { next = item; mix = 0; index = (index + 1) % list.length; caption(item); }).catch(() => { hold = 0; });
        }
        if (next) { mix += dt / 2.6; if (mix >= 1) { cur = next; next = null; mix = 0; hold = 0; } }
        const b = next || cur;
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, cur.tex);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, b.tex);
        gl.uniform2f(U.uRes, canvas.width, canvas.height);
        gl.uniform2f(U.uSA, cur.size[0], cur.size[1]); gl.uniform2f(U.uSB, b.size[0], b.size[1]);
        gl.uniform2f(U.uPtr, ptr[0], ptr[1]);
        gl.uniform1f(U.uT, time); gl.uniform1f(U.uMix, next ? mix : 0); gl.uniform1f(U.uPulse, pulse);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    requestAnimationFrame(frame);
}

/* ---------- album cards ---------- */
function countUp(el, to, duration = 1400) {
    if (calm) { el.textContent = to.toLocaleString(); return; }
    const t0 = performance.now();
    const tick = now => {
        const k = Math.min(1, (now - t0) / duration), e = 1 - Math.pow(1 - k, 4);
        el.textContent = Math.round(to * e).toLocaleString();
        if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}
function cards() {
    const list = [...document.querySelectorAll('a.album-card')];
    for (const card of list) {
        const badge = card.querySelector('.album-count');
        if (badge && /^\d+$/.test(badge.textContent.trim())) {
            const n = Number(badge.textContent);
            card.addEventListener('m-reveal', () => countUp(badge, n), { once: true });
        }
        if (calm || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) continue;
        card.classList.add('m-tilt');
        card.addEventListener('pointermove', ev => {
            const r = card.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width - 0.5, y = (ev.clientY - r.top) / r.height - 0.5;
            card.style.transform = `translateY(-10px) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg)`;
        });
        card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    }
    reveal(list, { y: 44, step: 110 });
}

/* ---------- gallery ---------- */
function gallery() {
    const imgs = [...document.querySelectorAll('.gallery .grid > img')];
    if (!imgs.length) return;
    const figs = imgs.map(img => {
        const fig = document.createElement('figure'); fig.className = 'm-fig';
        img.replaceWith(fig);
        const cap = document.createElement('figcaption'); cap.textContent = img.alt; cap.setAttribute('aria-hidden', 'true');
        fig.append(img, cap);
        return fig;
    });
    reveal(figs, { y: 36, step: 55, max: 330, duration: 950 });

    // the lightbox image grows out of the thumbnail that was pressed
    let from = null;
    document.addEventListener('click', ev => {
        const img = ev.target.closest && ev.target.closest('.gallery .grid img');
        if (!img) return;
        from = img.getBoundingClientRect();
        requestAnimationFrame(() => {
            const big = [...document.querySelectorAll('.popup')].map(p => getComputedStyle(p).display !== 'none' && p.querySelector('.popup-content > img')).find(Boolean);
            if (!big || calm || !from) return;
            const run = () => {
                const to = big.getBoundingClientRect();
                if (!to.width) return;
                const s = Math.max(from.width / to.width, from.height / to.height);
                const dx = from.left + from.width / 2 - (to.left + to.width / 2), dy = from.top + from.height / 2 - (to.top + to.height / 2);
                big.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${s})`, borderRadius: '14px' }, { transform: 'none', borderRadius: '8px' }],
                    { duration: 620, easing: EASE });
            };
            if (big.complete && big.naturalWidth) run(); else big.addEventListener('load', run, { once: true });
        });
    }, true);
}

/* ---------- the gate ---------- */
const thumb = item => `url("${ROOT}${encodeURI(item.file.replace('assets/', 'assets/thumbs/'))}")`;
function gateScenes(list) {
    const d3 = document.querySelector('.door-3d'), d2 = document.querySelector('.door-2d');
    if (!d3 || !d2) return;
    // a corridor: two walls, floor and ceiling, with a picture every 300px
    const s3 = document.createElement('span'); s3.className = 'door-scene scene-3d'; s3.setAttribute('aria-hidden', 'true');
    const cor = document.createElement('span'); cor.className = 'corridor';
    for (const side of ['l', 'r']) {
        const wall = document.createElement('i'); wall.className = 'wall ' + side;
        for (let k = 0; k < 13; k++) {
            const pic = document.createElement('b');
            pic.style.left = (150 + k * 300) + 'px';
            pic.style.backgroundImage = thumb(list[(k + (side === 'r' ? 3 : 0)) % list.length]);
            wall.append(pic);
        }
        cor.append(wall);
    }
    for (const c of ['floor', 'ceil']) { const el = document.createElement('i'); el.className = c; cor.append(el); }
    s3.append(cor); d3.prepend(s3);
    // three drifting columns
    const s2 = document.createElement('span'); s2.className = 'door-scene scene-2d'; s2.setAttribute('aria-hidden', 'true');
    for (let c = 0; c < 3; c++) {
        const col = document.createElement('span'); col.className = 'col';
        for (let k = 0; k < 12; k++) { const pic = document.createElement('b'); pic.style.backgroundImage = thumb(list[(k + c * 2) % list.length]); col.append(pic); }
        s2.append(col);
    }
    d2.prepend(s2);
}
function gate(header) {
    const nav = header.querySelector('.gate');
    if (!nav) return;
    const doors = [...nav.querySelectorAll('.door')];
    if (!calm) doors.forEach((d, i) => d.animate(
        [{ opacity: 0, transform: 'translateY(46px) scale(0.97)', clipPath: 'inset(18% 0 0 0 round 22px)' }, { opacity: 1, transform: 'none', clipPath: 'inset(0 0 0 0 round 22px)' }],
        { duration: 1500, delay: 900 + i * 180, easing: EASE, fill: 'backwards' }));
    // 3D: the hall's darkness opens from where you pressed, then we go in
    const d3 = nav.querySelector('.door-3d');
    d3.addEventListener('click', ev => {
        if (calm || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return;
        ev.preventDefault();
        const wipe = document.createElement('div'); wipe.className = 'm-wipe';
        const x = ev.clientX || innerWidth / 2, y = ev.clientY || innerHeight / 2;
        document.body.append(wipe);
        wipe.animate([{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${Math.hypot(innerWidth, innerHeight)}px at ${x}px ${y}px)` }],
            { duration: 760, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'forwards' }).finished.then(() => { location.href = d3.href; });
    });
    window.addEventListener('pageshow', ev => { if (ev.persisted) document.querySelectorAll('.m-wipe').forEach(w => w.remove()); });
    // 2D: glide down to the gallery
    nav.querySelector('.door-2d').addEventListener('click', ev => {
        const main = document.getElementById('main-content');
        if (!main) return;
        ev.preventDefault();
        main.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
        history.replaceState(null, '', '#main-content');
    });
}

/* ---------- flowers and visitors ---------- */
const NS = 'http://www.w3.org/2000/svg';
function flowerSvg(i) {
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '-12 -12 24 24');
    for (let ring = 0; ring < 2; ring++) for (let k = 0; k < 12; k++) {
        const p = document.createElementNS(NS, 'ellipse');
        p.setAttribute('rx', ring ? 1.5 : 1.8); p.setAttribute('ry', ring ? 3.6 : 5); p.setAttribute('cy', ring ? -4.4 : -6.4);
        p.setAttribute('fill', ring ? '#ffffff' : '#e6e8e4');
        p.setAttribute('transform', `rotate(${(k + ring * 0.5) * 30})`);
        svg.append(p);
    }
    const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', 2.2); c.setAttribute('fill', '#e9d27a'); svg.append(c);
    svg.style.transform = `rotate(${(i * 47) % 360}deg) translateY(${(i * 13) % 5 - 2}px)`;
    return svg;
}
function countUp2(el, to) { countUp(el, to, 1600); }
async function visitors(header) {
    if (!REALTIME) return;
    const base = REALTIME.replace(/\/$/, '');
    let first = false, laid = false;
    try {
        first = localStorage.getItem('visit-day') !== DAY; if (first) localStorage.setItem('visit-day', DAY);
        laid = localStorage.getItem('flower-day') === DAY;
    } catch (e) { /* storage unavailable */ }
    let data;
    try { data = await (await fetch(base + (first ? '/visit' : '/state'), { method: first ? 'POST' : 'GET' })).json(); } catch (e) { return; }
    const nav = header && header.querySelector('.gate');
    if (!nav || !TEXT) return;

    const foot = document.createElement('div'); foot.className = 'gate-foot';
    const bed = document.createElement('div'); bed.className = 'gate-flowers'; bed.setAttribute('aria-hidden', 'true');
    const line = document.createElement('p'); line.className = 'gate-count';
    const fNum = document.createElement('strong'), vNum = document.createElement('strong');
    const parts = TEXT.count.split(/(\{f\}|\{v\})/);
    for (const part of parts) line.append(part === '{f}' ? fNum : part === '{v}' ? vNum : part);
    if (data.here > 0) { const now = document.createElement('span'); now.className = 'm-now'; now.textContent = TEXT.now.replace('{n}', data.here); line.append(now); }
    const btn = document.createElement('button'); btn.className = 'gate-offer'; btn.type = 'button';
    foot.append(bed, line, btn);
    nav.after(foot);

    const MAX = 60;
    let shown = 0;
    const grow = (total, animate) => {
        const want = Math.min(MAX, total);
        for (; shown < want; shown++) {
            const f = flowerSvg(shown);
            bed.append(f);
            if (animate && !calm) f.animate([{ opacity: 0, transform: f.style.transform + ' translateY(-26px) scale(0.2)' }, { opacity: 1, transform: f.style.transform }],
                { duration: 1100, delay: animate === 'all' ? 1900 + shown * 28 : 0, easing: EASE, fill: 'backwards' });
        }
    };
    const setButton = () => { btn.disabled = laid; btn.textContent = laid ? TEXT.done : TEXT.offer; };
    setButton();
    grow(data.flowers, 'all');
    fNum.textContent = '0'; vNum.textContent = '0';
    setTimeout(() => { countUp2(fNum, data.flowers); countUp2(vNum, data.visits); }, calm ? 0 : 1800);
    if (!calm) foot.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 1200, delay: 1700, easing: EASE, fill: 'backwards' });

    btn.addEventListener('click', async () => {
        if (laid) return;
        btn.disabled = true;
        try {
            const r = await (await fetch(base + '/flower', { method: 'POST' })).json();
            laid = true;
            try { localStorage.setItem('flower-day', DAY); } catch (e) { /* storage unavailable */ }
            grow(r.flowers, 'one');
            fNum.textContent = r.flowers.toLocaleString();
        } catch (e) { btn.disabled = false; return; }
        setButton();
    });
}

/* ---------- start ---------- */
try {
    const header = document.querySelector('body > header');
    languageMenu();
    if (header) {
        splitTitle(header.querySelector('h1'));
        if (isHome) { hero(header); gate(header); }
    }
    gallery();
    cards();
    reveal([...document.querySelectorAll('main > section:not(.gallery), .timeline-item, footer')].filter(el => !el.closest('.popup')), { y: 34 });
    visitors(isHome ? header : null);
} catch (err) { console.error(err); }
