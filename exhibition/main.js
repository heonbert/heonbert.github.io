// 유목의 물빛사진 - 3D 전시관
// A dark vestibule, a tall nave with a pool under a skylight, six galleries, and one last wall.
// Photographs are shown unlit, in their true colours. Everything else is painted with light by hand.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import * as L from './layout.js';
import * as Presence from './presence.js';
import * as Npc from './npc.js';

const $ = id => document.getElementById(id);
// Languages are plain JSON files: i18n/langs.json lists them, i18n/<code>.json holds the words and the 282 titles.
const LANG_LIST = await fetch('i18n/langs.json').then(r => r.json());
const qLang = new URLSearchParams(location.search).get('lang');
let stored = null;
try { stored = localStorage.getItem('lang'); } catch (e) { /* storage unavailable */ }
const nav = (navigator.language || 'ko').toLowerCase();
const navGuess = /^zh-(tw|hk|mo|hant)/.test(nav) ? 'zh-tw' : nav.slice(0, 2);
let lang = [qLang, stored, navGuess].find(l => LANG_LIST.some(x => x.code === l)) || 'en';
let TX = null;
const loadLang = async code => (await fetch(`i18n/${code}.json`)).json();
TX = await loadLang(lang).catch(() => null) || await loadLang(lang = 'en');
const t = k => TX.ui[k];
const titleOf = p => TX.titles[p.n - 1] || p.title.en;
const isRtl = () => (LANG_LIST.find(x => x.code === lang) || {}).dir === 'rtl';
const tip = (id, text) => { const el = document.getElementById(id); el.setAttribute('aria-label', text); el.dataset.tip = text; };

// Fonts follow the language: exhibition.css sets --serif and --sans for each one. Only Korean downloads a font.
let SERIF = 'Georgia,serif', SANS = 'system-ui,sans-serif';
function readFonts() {
    const cs = getComputedStyle(document.documentElement);
    SERIF = cs.getPropertyValue('--serif').trim() || SERIF;
    SANS = cs.getPropertyValue('--sans').trim() || SANS;
}
// Words drawn on walls need their font before they are drawn. Only Korean has one to wait for.
function fontReady() {
    if (lang !== 'ko' || !document.fonts) return Promise.resolve();
    const sample = JSON.stringify(TX.ui) + TX.titles.join('') + (state.shoots || []).map(d => d[1]).join('');
    return Promise.race([document.fonts.load("40px 'Yumok Batang'", sample).catch(() => null), new Promise(r => setTimeout(r, 3000))]);
}
const EYE = L.EYE;
const small = Math.min(window.innerWidth || 800, window.innerHeight || 800) < 600;

const state = {
    works: [], pos: new THREE.Vector3(0, EYE, 8.9), yaw: 0, pitch: 0, keys: new Set(),
    path: null, settle: null, focus: null, entered: false, ready: false, tour: false, tourClock: 0, time: 0,
};
window.__exhibition = state;

/* ---------- renderer ---------- */
const canvas = $('stage');
let renderer;
try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) { fail(); throw e; }
renderer.outputColorSpace = THREE.SRGBColorSpace;
// Sharpness gives way to smoothness on a device that cannot keep up (see the loop).
let dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
const fps = { t: 0, n: 0, low: 0, since: 1e9 };
renderer.setPixelRatio(dpr);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050608);
const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.08, 200);
camera.rotation.order = 'YXZ';
const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
Object.assign(state, { camera, scene, renderer });   // handles for inspection from the console
camera.position.copy(state.pos);                      // never draw a frame from the origin

function fail() {
    document.documentElement.dataset.hall = 'failed';
    $('enter').hidden = true;
    document.querySelector('#welcome .lead').textContent = t('fail');
}
function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 1 ? 74 : 58;
    camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

/* ---------- materials: light painted in the shader ---------- */
const uTime = { value: 0 };
const NOISE = `
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1.,0.)), f.x), mix(hash(i+vec2(0.,1.)), hash(i+vec2(1.,1.)), f.x), f.y); }`;
const VS = `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const WALL_FS = `
uniform vec3 uColor; uniform float uH, uConcrete, uCaustic, uTime; varying vec3 vW;
${NOISE}
float caus(vec2 p, float t){ vec2 q = p; float a = 0.0;
  for (int i = 0; i < 3; i++){ float fi = float(i);
    q += 0.6 * vec2(sin(q.y*1.7 + t*0.7 + fi), cos(q.x*1.3 - t*0.5 + fi*1.7)); a += abs(sin(q.x + q.y*0.7)); }
  return pow(1.0 - a/3.0, 4.0); }
void main(){
  float y = abs(vW.y);                      // the wall continues below the floor as its own reflection
  vec2 p = vec2(vW.x + vW.z, y);
  vec3 c;
  if (uConcrete > 0.5) {                    // cast concrete: panel joints, tie holes, light from above
    float l = mix(0.58, 1.03, smoothstep(0.0, uH, y)) * mix(0.72, 1.0, smoothstep(0.0, 0.9, y));
    float m = vnoise(p*0.7)*0.06 + vnoise(p*3.0)*0.03 + (hash(floor(p*400.0)) - 0.5)*0.02;
    vec2 q = vec2(fract(p.x/2.4)*2.4, fract(p.y/1.2)*1.2);
    float jd = min(min(q.x, 2.4-q.x), min(q.y, 1.2-q.y));
    float joint = 1.0 - 0.16*(1.0 - smoothstep(0.004, 0.014, jd));
    vec2 hd = abs(q - vec2(1.2, 0.6)) - vec2(0.8, 0.3);
    float hole = 1.0 - 0.3*(1.0 - smoothstep(0.016, 0.026, length(hd)));
    c = uColor * (l + m - 0.045) * joint * hole;
    float cz = caus(p*vec2(2.1, 2.4), uTime*0.8) * uCaustic * (1.0 - smoothstep(0.2, 4.8, y));
    c += vec3(1.0, 0.97, 0.9) * cz * 0.13;
  } else {                                  // painted plaster under wall-washers
    float band = smoothstep(0.1, 1.4, y) * (1.0 - 0.5*smoothstep(2.4, uH, y));
    float ao = mix(0.5, 1.0, smoothstep(0.0, 0.8, y)) * mix(0.55, 1.0, smoothstep(0.0, 1.0, uH - y));
    float g = (hash(floor(p*300.0)) - 0.5)*0.03 + (vnoise(p*1.3) - 0.5)*0.05;
    c = uColor * (0.45 + 0.8*band) * ao * (1.0 + g);
    c *= 0.55 + 0.45*smoothstep(0.0, 0.03, y);
  }
  gl_FragColor = vec4(pow(max(c, 0.0), vec3(2.2)), 1.0);
  #include <colorspace_fragment>
}`;
const FLOOR_FS = `
uniform vec3 uColor; uniform float uA0, uA1, uSlab; varying vec3 vW;
${NOISE}
void main(){
  vec3 v = normalize(cameraPosition - vW);
  float f = pow(1.0 - abs(v.y), 3.0);       // polished: mirrors more at a glancing angle
  vec3 c = uColor * (0.9 + 0.2*vnoise(vW.xz*0.6) + (hash(floor(vW.xz*250.0)) - 0.5)*0.04);
  if (uSlab > 0.0) { vec2 q = fract(vW.xz/uSlab)*uSlab; float jd = min(min(q.x, uSlab-q.x), min(q.y, uSlab-q.y));
    c *= 1.0 - 0.22*(1.0 - smoothstep(0.003, 0.012, jd)); }
  gl_FragColor = vec4(pow(c, vec3(2.2)), mix(uA0, uA1, f));
  #include <colorspace_fragment>
}`;
const STYLE = {
    vest: { wall: [0.10, 0.105, 0.115], floor: [0.035, 0.036, 0.04], ceil: 0x060709, glow: 0, a: [0.95, 0.8] },
    nave: { wall: [0.74, 0.72, 0.69], concrete: 1, caustic: 1, floor: [0.2, 0.2, 0.21], slab: 1.5, ceil: 0x5a5854, a: [0.9, 0.56] },
    ink: { wall: [0.125, 0.135, 0.155], floor: [0.045, 0.046, 0.05], ceil: 0x0a0b0d, glow: 0.2, a: [0.9, 0.58] },
    moss: { wall: [0.15, 0.185, 0.165], floor: [0.05, 0.052, 0.048], ceil: 0x0a0c0b, glow: 0.19, a: [0.9, 0.58] },
    clay: { wall: [0.235, 0.17, 0.135], floor: [0.055, 0.047, 0.042], ceil: 0x0d0b0a, glow: 0.2, a: [0.9, 0.58] },
    dusk: { wall: [0.165, 0.15, 0.172], floor: [0.05, 0.047, 0.052], ceil: 0x0b0a0c, glow: 0.2, a: [0.9, 0.58] },
    stone: { wall: [0.60, 0.585, 0.55], floor: [0.2, 0.19, 0.175], ceil: 0x2c2b28, glow: 0.03, a: [0.93, 0.7] },
    reveal: { wall: [0.60, 0.585, 0.56], concrete: 1, caustic: 0, floor: [0.2, 0.2, 0.21], a: [0.9, 0.56] },
};
function wallMat(s, h) {
    return new THREE.ShaderMaterial({
        vertexShader: VS, fragmentShader: WALL_FS, side: THREE.DoubleSide,
        uniforms: { uColor: { value: new THREE.Vector3(...s.wall) }, uH: { value: h }, uConcrete: { value: s.concrete || 0 }, uCaustic: { value: s.caustic || 0 }, uTime },
    });
}
function floorMat(s) {
    return new THREE.ShaderMaterial({
        vertexShader: VS, fragmentShader: FLOOR_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { uColor: { value: new THREE.Vector3(...s.floor) }, uA0: { value: s.a[0] }, uA1: { value: s.a[1] }, uSlab: { value: s.slab || 0 } },
    });
}

/* ---------- geometry batching ---------- */
class Batch {
    constructor() { this.p = []; }
    quad(a, b, c, d) { this.p.push(...a, ...b, ...c, ...a, ...c, ...d); return this; }
    mesh(material) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
        g.computeBoundingSphere();
        return new THREE.Mesh(g, material);
    }
}
const batches = new Map();
const B = key => { if (!batches.has(key)) batches.set(key, new Batch()); return batches.get(key); };
const solids = []; // meshes that block a click

function buildArchitecture() {
    const P = L.POOL;
    for (const r of L.ROOMS) {
        const h = r.h;
        for (const s of L.roomWalls(r)) {
            const pt = (tt, y) => [s.sx + s.dx * tt, y, s.sz + s.dz * tt];
            const w = B(`wall:${r.style}:${h}`);
            for (const g of s.solid) w.quad(pt(g.t0, -h), pt(g.t1, -h), pt(g.t1, h), pt(g.t0, h));
            for (const o of s.open) {
                const dh = o.door.h;
                w.quad(pt(o.t0, dh), pt(o.t1, dh), pt(o.t1, h), pt(o.t0, h));
                w.quad(pt(o.t0, -h), pt(o.t1, -h), pt(o.t1, -dh), pt(o.t0, -dh));
            }
        }
        const fl = B(`floor:${r.style}`), ce = B(`ceil:${r.style}`);
        const rect = (b, x0, x1, z0, z1, y) => b.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]);
        if (r.id === 'nave') {
            rect(fl, r.x0, P.x0, r.z0, r.z1, 0); rect(fl, P.x1, r.x1, r.z0, r.z1, 0);
            rect(fl, P.x0, P.x1, P.z1, r.z1, 0); rect(fl, P.x0, P.x1, r.z0, P.z0, 0);
            rect(ce, r.x0, P.x0, r.z0, r.z1, h); rect(ce, P.x1, r.x1, r.z0, r.z1, h);
            rect(ce, P.x0, P.x1, P.z1, r.z1, h); rect(ce, P.x0, P.x1, r.z0, P.z0, h);
            // the skylight: a slot over the water
            const sk = B('sky'), sh = B('shaft'), top = h + 1.8;
            rect(sk, P.x0, P.x1, P.z0, P.z1, top);
            sh.quad([P.x0, h, P.z0], [P.x0, h, P.z1], [P.x0, top, P.z1], [P.x0, top, P.z0]);
            sh.quad([P.x1, h, P.z0], [P.x1, h, P.z1], [P.x1, top, P.z1], [P.x1, top, P.z0]);
            sh.quad([P.x0, h, P.z0], [P.x1, h, P.z0], [P.x1, top, P.z0], [P.x0, top, P.z0]);
            sh.quad([P.x0, h, P.z1], [P.x1, h, P.z1], [P.x1, top, P.z1], [P.x0, top, P.z1]);
            // pool rim
            const rim = B('rim'), d = -0.07;
            rim.quad([P.x0, d, P.z0], [P.x0, d, P.z1], [P.x0, 0, P.z1], [P.x0, 0, P.z0]);
            rim.quad([P.x1, d, P.z0], [P.x1, d, P.z1], [P.x1, 0, P.z1], [P.x1, 0, P.z0]);
            rim.quad([P.x0, d, P.z0], [P.x1, d, P.z0], [P.x1, 0, P.z0], [P.x0, 0, P.z0]);
            rim.quad([P.x0, d, P.z1], [P.x1, d, P.z1], [P.x1, 0, P.z1], [P.x0, 0, P.z1]);
        } else { rect(fl, r.x0, r.x1, r.z0, r.z1, 0); rect(ce, r.x0, r.x1, r.z0, r.z1, h); }
    }
    for (const d of L.DOORS) {
        const w = B(`wall:reveal:${d.h}`), fl = B('floor:reveal'), a = d.c - d.w / 2, b = d.c + d.w / 2, h = d.h;
        if (d.type === 'x') {
            for (const z of [a, b]) w.quad([d.x0, -h, z], [d.x1, -h, z], [d.x1, h, z], [d.x0, h, z]);
            for (const y of [h, -h]) w.quad([d.x0, y, a], [d.x1, y, a], [d.x1, y, b], [d.x0, y, b]);
            fl.quad([d.x0, 0, b], [d.x1, 0, b], [d.x1, 0, a], [d.x0, 0, a]);
        } else {
            for (const x of [a, b]) w.quad([x, -h, d.z0], [x, -h, d.z1], [x, h, d.z1], [x, h, d.z0]);
            for (const y of [h, -h]) w.quad([a, y, d.z0], [b, y, d.z0], [b, y, d.z1], [a, y, d.z1]);
            fl.quad([a, 0, d.z1], [b, 0, d.z1], [b, 0, d.z0], [a, 0, d.z0]);
        }
    }
    for (const o of L.partitions()) {
        const r = L.ROOMS.find(m => m.id === o.room), h = r.h, w = B(`wall:${r.style}:${h}`);
        w.quad([o.x0, -h, o.z0], [o.x0, -h, o.z1], [o.x0, h, o.z1], [o.x0, h, o.z0]);
        w.quad([o.x1, -h, o.z0], [o.x1, -h, o.z1], [o.x1, h, o.z1], [o.x1, h, o.z0]);
        w.quad([o.x0, -h, o.z0], [o.x1, -h, o.z0], [o.x1, h, o.z0], [o.x0, h, o.z0]);
        w.quad([o.x0, -h, o.z1], [o.x1, -h, o.z1], [o.x1, h, o.z1], [o.x0, h, o.z1]);
    }
    for (const [key, b] of batches) {
        const [kind, style, h] = key.split(':');
        let m;
        if (kind === 'wall') { m = b.mesh(wallMat(STYLE[style], Number(h))); solids.push(m); }
        else if (kind === 'floor') { m = b.mesh(floorMat(STYLE[style])); m.renderOrder = 0; }
        else if (kind === 'ceil') m = b.mesh(new THREE.MeshBasicMaterial({ color: STYLE[style].ceil, side: THREE.DoubleSide }));
        else if (kind === 'sky') m = b.mesh(new THREE.MeshBasicMaterial({ color: 0xf6f9ff, side: THREE.DoubleSide }));
        else if (kind === 'shaft') m = b.mesh(new THREE.MeshBasicMaterial({ color: 0xd4d8dc, side: THREE.DoubleSide }));
        else if (kind === 'rim') m = b.mesh(new THREE.MeshBasicMaterial({ color: 0x23262a, side: THREE.DoubleSide }));
        m.frustumCulled = false;
        scene.add(m);
    }
    // benches
    const oak = [0x54452f, 0x54452f, 0x6e5b40, 0x3a2f20, 0x4a3c29, 0x4a3c29].map(c => new THREE.MeshBasicMaterial({ color: c }));
    for (const o of L.benches()) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(o.x1 - o.x0, 0.42, o.z1 - o.z0), oak);
        m.position.set((o.x0 + o.x1) / 2, 0.21, (o.z0 + o.z1) / 2);
        scene.add(m); solids.push(m);
    }
}

/* ---------- the pool ---------- */
let pool = null;
function buildPool() {
    const P = L.POOL, w = P.x1 - P.x0, d = P.z1 - P.z0;
    const res = small ? 512 : 1024;
    pool = new Reflector(new THREE.PlaneGeometry(w, d), {
        textureWidth: res, textureHeight: res, clipBias: 0.003,
        shader: {
            name: 'PoolShader',
            uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, time: { value: 0 } },
            vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
                void main(){ vUv = textureMatrix * vec4(position, 1.0); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
                gl_Position = projectionMatrix * viewMatrix * w; }`,
            fragmentShader: `uniform sampler2D tDiffuse; uniform float time; varying vec4 vUv; varying vec3 vW;
                void main(){
                  vec2 p = vW.xz; float tt = time;
                  vec2 n = 0.50 * vec2(cos(p.x*1.3 + tt*0.8 + sin(p.y*0.7)), sin(p.y*1.1 - tt*0.6 + cos(p.x*0.9)));
                  n += 0.25 * vec2(cos(p.x*3.1 - tt*1.1 + p.y*1.7), sin(p.y*2.7 + tt*0.9 - p.x*1.3));
                  n += 0.12 * vec2(cos(p.x*7.3 + tt*1.7 + p.y*2.1), sin(p.y*6.1 - tt*1.3 + p.x*3.3));
                  vec3 v = cameraPosition - vW; float dist = length(v); v /= dist;
                  vec4 uv = vUv; uv.xy += n * 0.016 * uv.w * clamp(10.0/dist, 0.25, 1.0);
                  vec3 refl = texture2DProj(tDiffuse, uv).rgb;
                  float fres = pow(1.0 - max(v.y, 0.0), 2.5);
                  vec3 deep = vec3(0.004, 0.012, 0.018);
                  vec3 col = mix(deep, refl, 0.42 + 0.56*fres);
                  gl_FragColor = vec4(col, 1.0);
                  #include <colorspace_fragment>
                }`,
        },
    });
    pool.rotation.x = -Math.PI / 2;
    pool.position.set((P.x0 + P.x1) / 2, -0.07, (P.z0 + P.z1) / 2);
    scene.add(pool);
}

/* ---------- his film, and the sound of that day ---------- */
const media = { video: null, audio: null, screen: null, mat: null, vtex: null, soundOn: false, vol: 0 };
const ROOM_VOLUME = { nave: 0.55, film: 0.75, vest: 0.35, log: 0.3, awards: 0.25 };
function buildMedia() {
    const S = L.SCREEN, yaw = Math.atan2(S.nx, S.nz);
    const mat = new THREE.MeshBasicMaterial({ color: 0x0a0d12, side: THREE.DoubleSide });
    loader.load('media/simpo-2019.jpg', tex => {
        tex.colorSpace = THREE.SRGBColorSpace;
        if (media.vtex) { tex.dispose(); return; }
        mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true;
    });
    const geo = new THREE.PlaneGeometry(S.w, S.h);
    const screen = new THREE.Mesh(geo, mat);
    screen.position.set(S.x + S.nx * 0.03, S.y, S.z + S.nz * 0.03); screen.rotation.y = yaw;
    const mirror = new THREE.Mesh(geo, mat);
    mirror.position.set(S.x + S.nx * 0.03, -S.y, S.z + S.nz * 0.03); mirror.rotation.y = yaw; mirror.scale.y = -1;
    scene.add(screen, mirror);
    const v = document.createElement('video');
    v.src = small ? 'media/simpo-2019-s.mp4' : 'media/simpo-2019.mp4'; v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
    v.addEventListener('playing', () => {
        if (media.vtex) return;
        media.vtex = new THREE.VideoTexture(v); media.vtex.colorSpace = THREE.SRGBColorSpace;
        if (mat.map) mat.map.dispose();
        mat.map = media.vtex; mat.color.set(0xffffff); mat.needsUpdate = true;
    });
    const a = new Audio('media/simpo-2019.mp3');
    a.loop = true; a.preload = 'none'; a.volume = 0;
    Object.assign(media, { video: v, audio: a, screen, mat });
}
function updateMedia(here) {
    const v = media.video, a = media.audio;
    if (!v || !state.entered) return;
    // the film is fetched and played only in its own room, or at the door that looks into it
    const seen = !!here && (here.id === 'film' || (here.id === 'vest' && state.pos.x < -1.5));
    if (seen && v.paused) v.play().catch(() => { /* not allowed yet */ });
    else if (!seen && !v.paused) v.pause();
    const target = media.soundOn ? (here && ROOM_VOLUME[here.id]) || 0.2 : 0;
    media.vol += (target - media.vol) * 0.25;
    a.volume = Math.max(0, Math.min(1, media.vol));
    if (!media.soundOn && media.vol < 0.01 && !a.paused) a.pause();
}
function setSound(on, remember = true) {
    media.soundOn = on;
    if (remember) try { localStorage.setItem('sound', on ? 'on' : 'off'); } catch (e) { /* storage unavailable */ }
    const b = $('sound');
    b.setAttribute('aria-pressed', on);
    tip('sound', on ? t('soundOff') : t('soundOn'));
    if (on) media.audio.play().catch(() => setSound(false, false));   // the browser refused; not the visitor's choice
}
$('sound').addEventListener('click', () => setSound(!media.soundOn));

// every day he went out for water light, in his own words
function makeLog() {
    const days = state.shoots || [], W = 8.4, H = 3.3, ppm = 340;
    const c = document.createElement('canvas'); c.width = W * ppm; c.height = H * ppm;
    const g = c.getContext('2d');
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#e9ecf2'; g.font = `400 ${0.2 * ppm}px ${SERIF}`; g.fillText(t('logTitle'), 0, 0.24 * ppm, W * ppm);
    g.fillStyle = '#9aa8c0'; g.font = `400 ${0.075 * ppm}px ${SANS}`; g.fillText(t('logSub').replace('{n}', days.length), 0, 0.42 * ppm, W * ppm);
    const cols = 6, rows = Math.ceil(days.length / cols), cw = W / cols, rh = (H - 0.62) / rows;
    let year = '';
    days.forEach(([d, place], i) => {
        const x = Math.floor(i / rows) * cw * ppm, y = (0.62 + rh * (i % rows + 0.75)) * ppm;
        const first = d.slice(0, 4) !== year; year = d.slice(0, 4);
        g.font = `400 ${0.058 * ppm}px ${SANS}`; g.fillStyle = first ? '#6fb0e0' : '#7f8ba0'; g.fillText(d, x, y);
        g.font = `400 ${0.064 * ppm}px ${SERIF}`; g.fillStyle = '#e9ecf2'; g.fillText(place, x + 0.42 * ppm, y, (cw - 0.52) * ppm);
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = maxAniso;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.renderOrder = 3;
    return m;
}

// How he worked, counted from the camera records of the 282 photographs he chose.
function makeChart() {
    const P = (state.photos || []).filter(p => p.album !== 'awards' && p.taken);
    const W = 8.4, H = 3.0, ppm = 300;
    const c = document.createElement('canvas'); c.width = W * ppm; c.height = H * ppm;
    const g = c.getContext('2d');
    const rtl = isRtl();
    g.direction = rtl ? 'rtl' : 'ltr';
    g.textBaseline = 'alphabetic';
    const X = x => (rtl ? W - x : x) * ppm;                 // the whole sheet is mirrored for right-to-left scripts
    const text = (s, x, y, size, color, font = SANS, align = 'start', maxW) => {
        g.font = `400 ${size * ppm}px ${font}`; g.fillStyle = color;
        g.textAlign = align === 'center' ? 'center' : (align === 'end') !== rtl ? 'right' : 'left';
        g.fillText(s, X(x), y * ppm, maxW ? maxW * ppm : undefined);
    };
    const rect = (x, y, w, h) => g.fillRect(rtl ? X(x) - w * ppm : X(x), y * ppm, w * ppm, h * ppm);
    const days = new Set(P.map(p => p.taken.slice(0, 10))).size;
    text(t('howTitle'), 0, 0.24, 0.2, '#e9ecf2', SERIF);
    text(t('howSub').replace('{d}', days), 0, 0.42, 0.075, '#9aa8c0');
    const hours = new Array(24).fill(0), months = new Array(12).fill(0);
    for (const p of P) { hours[Number(p.taken.slice(11, 13))]++; months[Number(p.taken.slice(5, 7)) - 1]++; }
    const FB = [[0, 35, '≤35'], [36, 70, '36–70'], [71, 135, '71–135'], [136, 200, '136–200'], [201, 400, '201–400'], [401, 9999, '400+']];
    const focal = FB.map(([a, b]) => P.filter(p => p.focal_length_mm >= a && p.focal_length_mm <= b).length);
    const count = {};
    for (const p of P) if (p.place_en) count[p.place_en] = (count[p.place_en] || 0) + 1;
    const places = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 7);
    const pw = 1.86, gap = 0.32, top = 0.92, ph = 1.4;      // four panels side by side
    const bars = (i, title, values, labels, note, hot) => {
        const x0 = i * (pw + gap), max = Math.max(1, ...values), bw = pw / values.length;
        text(title, x0, top - 0.14, 0.085, '#e9ecf2', SERIF);
        values.forEach((v, k) => {
            const h = Math.max(0.004, (v / max) * ph);
            g.fillStyle = hot(k) ? '#6fb0e0' : 'rgba(233,236,242,0.4)';
            rect(x0 + k * bw + bw * 0.14, top + ph - h, bw * 0.72, h);
            if (labels[k] != null) text(String(labels[k]), x0 + k * bw + bw / 2, top + ph + 0.11, 0.048, '#7f8ba0', SANS, 'center');
        });
        text(note, x0, top + ph + 0.33, 0.062, '#9aa8c0', SANS, 'start', pw);
    };
    const hr = hours.slice(6, 21);
    bars(0, t('howHour'), hr, hr.map((_, k) => ((k + 6) % 3 === 0 ? k + 6 : null)), t('howHourNote').replace('{n}', hours[15] + hours[16]), k => k === 9 || k === 10);
    bars(1, t('howMonth'), months, months.map((_, k) => k + 1), t('howMonthNote').replace('{n}', months[9] + months[10]), k => k === 9 || k === 10);
    bars(2, t('howFocal'), focal, FB.map(b => b[2]), t('howFocalNote').replace('{n}', P.filter(p => p.focal_length_mm > 70).length), k => k >= 2);
    const x0 = 3 * (pw + gap), rowH = ph / 7, maxP = places.length ? places[0][1] : 1;
    text(t('howPlace'), x0, top - 0.14, 0.085, '#e9ecf2', SERIF);
    places.forEach(([name, n], k) => {
        const y = top + k * rowH;
        g.fillStyle = 'rgba(111,176,224,0.55)';
        rect(x0, y + rowH * 0.66, (n / maxP) * pw, rowH * 0.16);
        text(TX.places[name] || name, x0, y + rowH * 0.5, 0.06, '#e9ecf2', SANS, 'start', pw - 0.3);
        text(String(n), x0 + pw, y + rowH * 0.5, 0.06, '#9aa8c0', SANS, 'end');
    });
    text(t('howPlaceNote').replace('{n}', P.filter(p => p.place_en).length), x0, top + ph + 0.33, 0.062, '#9aa8c0', SANS, 'start', pw);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = maxAniso;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    mesh.renderOrder = 3;
    return mesh;
}

/* ---------- text on walls and floors ---------- */
function wrapLine(g, text, maxW) {
    const words = text.includes(' ') ? text.split(' ') : [...text], sep = text.includes(' ') ? ' ' : '';
    const out = []; let cur = '';
    for (const w of words) {
        const next = cur ? cur + sep + w : w;
        if (cur && g.measureText(next).width > maxW) { out.push(cur); cur = w; } else cur = next;
    }
    if (cur) out.push(cur);
    return out;
}
function makeText(lines, { width, ppm = 220, align = 'left', lineH = 1.45 } = {}) {
    const c = document.createElement('canvas'), g = c.getContext('2d');
    const rtl = isRtl();
    if (rtl && align !== 'center') align = align === 'left' ? 'right' : 'left';
    const W = Math.round(width * ppm);
    const rows = [];
    for (const l of lines) {
        const px = Math.round(l.size * ppm);
        const font = `${l.weight || 400} ${px}px ${l.sans ? SANS : SERIF}`;
        g.font = font;
        const parts = l.nowrap ? [l.text] : wrapLine(g, l.text, W);
        parts.forEach((text, i) => rows.push({ text, font, px, color: l.color, gap: i === 0 ? (l.gap || 0) * ppm : 0 }));
    }
    const H = Math.ceil(rows.reduce((s, r) => s + r.gap + r.px * lineH, 0));
    c.width = W; c.height = H;
    let y = 0;
    for (const r of rows) {
        y += r.gap;
        g.direction = rtl ? 'rtl' : 'ltr';
        g.font = r.font; g.fillStyle = r.color; g.textBaseline = 'middle'; g.textAlign = align;
        g.fillText(r.text, align === 'center' ? W / 2 : align === 'right' ? W : 0, y + r.px * lineH / 2, W);
        y += r.px * lineH;
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = maxAniso;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, H / ppm), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.renderOrder = 3;
    m.userData.h = H / ppm;
    return m;
}
const texts = new THREE.Group();
scene.add(texts);
// words that change while you are here: the visitor and flower counts set into the floor
const sharedTexts = new THREE.Group();
scene.add(sharedTexts);
function buildShared() {
    for (const m of [...sharedTexts.children]) { m.material.map.dispose(); m.material.dispose(); m.geometry.dispose(); sharedTexts.remove(m); }
    if (!Presence.enabled || !state.ready) return;
    const S = Presence.shared;
    if (S.visits > 0) {
        const m = makeText([{ text: t('lanterns').replace('{n}', S.visits), size: 0.1, color: 'rgba(232,234,238,0.72)', sans: true }], { width: 4.2, align: 'center' });
        m.position.set(0, 0.012, -4.5); m.rotation.x = -Math.PI / 2; sharedTexts.add(m);
    }
    if (S.flowers > 0) {
        const f = makeText([{ text: t('flowersLine').replace('{n}', S.flowers), size: 0.1, color: 'rgba(232,234,238,0.72)', sans: true }], { width: 4.2, align: 'center' });
        f.position.set(0, 0.012, -67.2); f.rotation.x = -Math.PI / 2; sharedTexts.add(f);
    }
}
function updateSocial(here) {
    const on = Presence.enabled;
    $('bow').hidden = !on;
    const n = Presence.shared.here;
    $('together').textContent = on && n > 1 && !state.quiet ? t('together').replace('{n}', n) : '';
    const atEnd = on && !!here && here.id === 'nave' && state.pos.z < -58;
    $('flower').hidden = !atEnd;
    $('flower').disabled = Presence.shared.laid;
    tip('flower', Presence.shared.laid ? t('flowerDone') : t('flower'));
}
$('bow').addEventListener('click', () => { state.bowT = 1.6; Presence.gesture('bow'); });
// alone with the pictures: other visitors, real and imagined, step out of sight
function setQuiet(on, remember = true) {
    state.quiet = on;
    if (remember) try { localStorage.setItem('quiet', on ? 'on' : 'off'); } catch (e) { /* storage unavailable */ }
    $('quiet').setAttribute('aria-pressed', on);
    tip('quiet', on ? t('quietOff') : t('quiet'));
    Presence.setQuiet(on); Npc.setQuiet(on);
    updateSocial(L.roomAt(state.pos.x, state.pos.z));
}
$('quiet').addEventListener('click', () => setQuiet(!state.quiet));
$('flower').addEventListener('click', () => { if (Presence.gesture('flower')) { state.bowT = 1.6; updateSocial(L.roomAt(state.pos.x, state.pos.z)); } });
function buildTexts() {
    for (const m of [...texts.children]) { m.material.map.dispose(); m.material.dispose(); m.geometry.dispose(); texts.remove(m); }
    const INK = '#26272a', INK2 = '#5d5e60', PALE = '#e9ecf2', PALE2 = '#9aa8c0', BLUE = '#6fb0e0';
    const put = (m, x, y, z, ry = 0, flat = false) => { m.position.set(x, y, z); if (flat) m.rotation.x = -Math.PI / 2; else m.rotation.y = ry; texts.add(m); return m; };

    // vestibule: title to the left of the portal, the introduction to the right
    put(makeText([
        { text: t('eyebrow'), size: 0.1, color: BLUE, sans: true },
        { text: t('title'), size: 0.44, color: PALE, gap: 0.1 },
        { text: t('name'), size: 0.14, color: PALE2, gap: 0.14 },
        { text: t('dates'), size: 0.14, color: PALE2 },
    ], { width: 3.5 }), -4.05, 1.95, 0.51);
    put(makeText([{ text: t('lead'), size: 0.135, color: PALE }], { width: 3.4, lineH: 1.75 }), 4.1, 1.85, 0.51);

    // two side rooms off the vestibule: his film, and his field log
    put(makeText([{ text: t('film'), size: 0.2, color: PALE }, { text: t('filmTitle'), size: 0.085, color: PALE2, gap: 0.04 }], { width: 1.5 }), -5.99, 1.9, 2.0, Math.PI / 2);
    put(makeText([{ text: t('log'), size: 0.2, color: PALE }, { text: t('logTitle'), size: 0.085, color: PALE2, gap: 0.04 }], { width: 1.5 }), 5.99, 1.9, 2.0, -Math.PI / 2);
    put(makeText([
        { text: t('filmTitle'), size: 0.2, color: PALE },
        { text: t('filmText'), size: 0.09, color: PALE2, gap: 0.1 },
        { text: t('soundNote'), size: 0.075, color: BLUE, sans: true, gap: 0.1 },
    ], { width: 3.4, lineH: 1.6 }), -15.6, 1.95, 0.51);
    put(makeLog(), 18.99, 1.95, 5, -Math.PI / 2);
    put(makeChart(), 12.75, 2.0, 0.51);
    // beside the door at the far side of the log room: the pictures he sent to contests
    put(makeText([
        { text: TX.ui.halls.awards, size: 0.2, color: PALE },
        { text: TX.ui.hallText.awards, size: 0.085, color: PALE2, gap: 0.06 },
    ], { width: 3.0, lineH: 1.6 }), 16.45, 1.9, 9.49, Math.PI);

    // nave: each gallery is named beside its portal
    const roman = [' I', ' II', ' III'];
    const seen = {};
    for (const d of L.DOORS) {
        if (!d.id.startsWith('nave-')) continue;
        const r = L.ROOMS.find(m => m.id === d.id.slice(5));
        const i = seen[r.album] = (seen[r.album] || 0) + 1;
        const lines = [{ text: TX.ui.halls[r.album] + (r.album === 'abstract' ? roman[i - 1] : ''), size: 0.36, color: INK }];
        if (i === 1) lines.push({ text: TX.ui.hallText[r.album], size: 0.092, color: INK2, gap: 0.1 });
        if (i === 1 && TX.ui.hallNote && TX.ui.hallNote[r.album]) lines.push({ text: TX.ui.hallNote[r.album], size: 0.068, color: INK2, sans: true, gap: 0.1 });
        const m = makeText(lines, { width: 3.4, lineH: 1.5 });
        const y = 2.55 - m.userData.h / 2;
        if (d.x0 < 0) put(m, -5.99, y, d.c - d.w / 2 - 2.4, Math.PI / 2);
        else put(m, 5.99, y, d.c + d.w / 2 + 2.4, -Math.PI / 2);
    }

    // the river of his years, set into the floor on both banks of the pool
    const tl = t('timeline'), z0 = -9.5, stepZ = (L.POOL.z0 + 3.5 - z0) / (tl.length - 1);
    tl.forEach(([year, text], i) => {
        for (const x of [-4.1, 4.1]) {
            const m = makeText([
                { text: year, size: 0.42, color: 'rgba(232,234,238,0.82)', nowrap: true },
                { text, size: 0.105, color: 'rgba(232,234,238,0.75)', sans: true },
            ], { width: 3.2, align: 'center', lineH: 1.3 });
            put(m, x, 0.012, z0 + stepZ * i, 0, true);
        }
    });
    put(makeText([{ text: t('river'), size: 0.12, color: 'rgba(232,234,238,0.8)' }], { width: 4.2, align: 'center' }), 0, 0.012, -3.4, 0, true);

    // the end wall: his name on one side of the self-portrait, his son's words on the other
    const nz = L.ROOMS.find(r => r.id === 'nave').z0 + 0.012;
    put(makeText([
        { text: t('name'), size: 0.17, color: INK },
        { text: t('dates'), size: 0.17, color: INK2, gap: 0.03 },
    ], { width: 3.0, align: 'right' }), -3.55, 2.0, nz);
    put(makeText(t('finale').map((text, i) => ({ text, size: 0.082, color: INK, gap: i ? 0.05 : 0 })), { width: 3.0, lineH: 1.65 }), 3.55, 2.0, nz);
}

/* ---------- the works ---------- */
const FR = { single: { mat: 0.07, frame: 0.02 }, grid: { mat: 0.035, frame: 0.015 }, hero: { mat: 0, frame: 0.02 }, finale: { mat: 0, frame: 0.02 } };
const labelPool = [];
function softTexture(draw) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    draw(c.getContext('2d'));
    return new THREE.CanvasTexture(c);
}
function buildWorks(photos) {
    const works = L.hang(photos);
    const n = works.length;
    const glowTex = softTexture(g => {
        const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
        gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    });
    const shadowTex = softTexture(g => {
        for (let i = 0; i < 22; i++) { g.fillStyle = 'rgba(0,0,0,0.075)'; const k = 6 + i; g.fillRect(k, k, 128 - 2 * k, 128 - 2 * k); }
    });
    const plane = new THREE.PlaneGeometry(1, 1);
    const glowMat = () => new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const glowUp = new THREE.InstancedMesh(plane, glowMat(), n); glowUp.renderOrder = 1;
    const glowDn = new THREE.InstancedMesh(plane, glowMat(), n); glowDn.renderOrder = -1;
    const pools = new THREE.InstancedMesh(plane, glowMat(), n); pools.renderOrder = 1;
    const shadows = new THREE.InstancedMesh(plane, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, color: 0x000000 }), n);
    shadows.renderOrder = 2;
    const box = new THREE.BoxGeometry(1, 1, 1);
    const frameMats = [0x1b1b1d, 0x1b1b1d, 0x2a2a2c, 0x0c0c0d, 0x101012, 0x101012].map(c => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    const frames = new THREE.InstancedMesh(box, frameMats, n * 2);
    const mats = new THREE.InstancedMesh(plane, new THREE.MeshBasicMaterial({ color: 0xdedbd4, side: THREE.DoubleSide }), n * 2);
    const cans = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.055, 0.17, 10), new THREE.MeshBasicMaterial({ color: 0x18181a }), n);
    const lens = new THREE.InstancedMesh(new THREE.CircleGeometry(0.036, 12), new THREE.MeshBasicMaterial({ color: 0xfff1d8, side: THREE.DoubleSide }), n);

    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qf = new THREE.Quaternion(), e = new THREE.Euler();
    const v = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
    const hide = new THREE.Matrix4().makeScale(0, 0, 0);
    works.forEach((w, i) => {
        const r = L.ROOMS.find(m => m.id === w.room), st = STYLE[r.style], f = FR[w.kind];
        const yaw = Math.atan2(w.nx, w.nz);
        q.setFromEuler(e.set(0, yaw, 0));
        const at = (d, y) => v.set(w.x + w.nx * d, y, w.z + w.nz * d);
        const ow = w.w + 2 * (f.mat + f.frame), oh = w.h + 2 * (f.mat + f.frame);
        const big = w.kind === 'hero' || w.kind === 'finale';
        // light on the wall and on the floor
        const gl = w.kind === 'finale' ? 0.1 : st.glow * (w.kind === 'grid' ? 0.75 : 1);
        col.setRGB(0.8 * gl, 0.88 * gl, 1.0 * gl);
        const gw = ow * (big ? 2.3 : 2.9), gh = oh * (big ? 2.5 : 3.6);
        glowUp.setMatrixAt(i, m4.compose(at(0.004, w.y + oh * 0.25), q, s.set(gw, gh, 1))); glowUp.setColorAt(i, col);
        glowDn.setMatrixAt(i, m4.compose(at(0.004, -w.y - oh * 0.25), q, s.set(gw, -gh, 1))); glowDn.setColorAt(i, col);
        if (w.kind !== 'grid' && w.kind !== 'finale') {
            qf.setFromEuler(e.set(-Math.PI / 2, 0, 0));
            col.setRGB(0.5 * gl, 0.55 * gl, 0.62 * gl);
            pools.setMatrixAt(i, m4.compose(at(1.25, 0.006), qf, s.set(ow * 2.2, 3.0, 1)));
        } else { pools.setMatrixAt(i, hide); col.setRGB(0, 0, 0); }
        pools.setColorAt(i, col);
        shadows.setMatrixAt(i, m4.compose(at(0.006, w.y - 0.035), q, s.set(ow + 0.34, oh + 0.34, 1)));
        // frame, mat, and their reflections in the floor
        frames.setMatrixAt(i * 2, m4.compose(at(0.02, w.y), q, s.set(ow, oh, 0.04)));
        frames.setMatrixAt(i * 2 + 1, m4.compose(at(0.02, -w.y), q, s.set(ow, -oh, 0.04)));
        mats.setMatrixAt(i * 2, m4.compose(at(0.0405, w.y), q, s.set(w.w + 2 * f.mat, w.h + 2 * f.mat, 1)));
        mats.setMatrixAt(i * 2 + 1, m4.compose(at(0.0405, -w.y), q, s.set(w.w + 2 * f.mat, -(w.h + 2 * f.mat), 1)));
        // a spotlight on the ceiling track for every work that hangs alone
        if (w.kind === 'single' || w.kind === 'hero') {
            qf.setFromEuler(e.set(0, 0, 0));
            cans.setMatrixAt(i, m4.compose(at(1.5, r.h - 0.1), qf, s.set(1, 1, 1)));
            qf.setFromEuler(e.set(Math.PI / 2, 0, 0));
            lens.setMatrixAt(i, m4.compose(at(1.5, r.h - 0.19), qf, s.set(1, 1, 1)));
        } else { cans.setMatrixAt(i, hide); lens.setMatrixAt(i, hide); }

        w.material = new THREE.MeshBasicMaterial({ color: 0x20262e, side: THREE.DoubleSide });
        w.mesh = new THREE.Mesh(plane, w.material);
        w.mesh.position.copy(at(0.042, w.y)); w.mesh.rotation.y = yaw; w.mesh.scale.set(w.w, w.h, 1);
        w.mesh.userData.work = w;
        w.mirror = new THREE.Mesh(plane, w.material);
        w.mirror.position.copy(at(0.042, -w.y)); w.mirror.rotation.y = yaw; w.mirror.scale.set(w.w, -w.h, 1);
        scene.add(w.mesh, w.mirror);
        w.index = i;
    });
    for (const im of [glowUp, glowDn, pools, shadows, frames, mats, cans, lens]) { im.frustumCulled = false; scene.add(im); }
    state.works = works;
    state.meshes = works.map(w => w.mesh);
    // two sequences: the 282 with the last wall, and the contest room. Each work knows its place in its own.
    state.main = works.filter(w => w.group !== 'awards');
    for (const list of [state.main, works.filter(w => w.group === 'awards')]) list.forEach((w, i) => { w.seq = i; w.list = list; });

    // a small pool of wall labels that follows the visitor
    for (let i = 0; i < 12; i++) {
        const c = document.createElement('canvas'); c.width = 512; c.height = 200;
        const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = maxAniso;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.156), new THREE.MeshBasicMaterial({ map: tex }));
        m.visible = false; scene.add(m);
        labelPool.push({ mesh: m, canvas: c, tex, work: null });
    }
}
function placeOf(p) { return p.place_en ? (TX.places[p.place_en] || p.place_en) : null; }
function noteOf(p) {
    if (p.self_portrait) return t('self');
    return TX.ui.prize[p.n] || null;
}
function drawLabel(l) {
    const w = l.work, p = w.p, g = l.canvas.getContext('2d');
    g.fillStyle = '#ebe8e1'; g.fillRect(0, 0, 512, 200);
    const rtl = isRtl(), X = rtl ? 486 : 26;
    g.direction = rtl ? 'rtl' : 'ltr';
    g.fillStyle = '#19191b'; g.textBaseline = 'alphabetic'; g.textAlign = rtl ? 'right' : 'left';
    g.font = `400 38px ${SERIF}`; g.fillText(titleOf(p), X, 66, 460);
    g.fillStyle = '#5a5a5c'; g.font = `400 23px ${SANS}`;
    g.fillText([placeOf(p), p.taken && p.taken.slice(0, 4)].filter(Boolean).join(' · '), X, 110, 460);
    const note = noteOf(p);
    g.fillStyle = note ? '#1f5f93' : '#8b8b8d'; g.font = `400 19px ${SANS}`;
    g.fillText(note || p.id.split('/')[1], X, 158, 460);
    l.tex.needsUpdate = true;
    const rx = w.nz, rz = -w.nx, f = FR[w.kind], off = w.w / 2 + f.mat + f.frame + 0.3;
    l.mesh.position.set(w.x + rx * off + w.nx * 0.012, w.y - w.h / 2 + 0.08, w.z + rz * off + w.nz * 0.012);
    l.mesh.rotation.y = Math.atan2(w.nx, w.nz);
    l.mesh.visible = true;
}
function updateLabels(force) {
    const want = state.works.filter(w => w.kind !== 'grid' && w.dist < 9).sort((a, b) => a.dist - b.dist).slice(0, labelPool.length);
    const wanted = new Set(want);
    for (const l of labelPool) if (l.work && (!wanted.has(l.work) || force)) { l.work = null; l.mesh.visible = false; }
    const shown = new Set(labelPool.filter(l => l.work).map(l => l.work));
    for (const w of want) {
        if (shown.has(w)) continue;
        const l = labelPool.find(x => !x.work);
        if (!l) break;
        l.work = w; drawLabel(l);
    }
}

/* ---------- lazy textures ---------- */
// Each picture comes in three sizes: 384 px for anything in sight, 768 px when you stand near, and the
// full picture when you stop in front of it. What is held in memory has a ceiling; beyond it the
// farthest pictures are let go, and for a while nothing that far is fetched again.
const loader = new THREE.TextureLoader();
let loading = 0, reach = 36;
const RANK = { small: 1, thumb: 2, full: 3 };
const EDGE = { small: 384, thumb: 768, full: 1200 };
const TEX_BUDGET = (small ? 90 : 200) * 1e6;
const texBytes = w => { const e = EDGE[w.loaded] || 0; return e * e * Math.min(1, w.p.height / w.p.width) * 4 * 1.34; };
const texUrl = (w, kind) => '../' + encodeURI(kind === 'full' ? w.p.view : kind === 'thumb' ? w.p.thumb : w.p.thumb_s);
function setTexture(w, kind) {
    loading++; w.loading = kind;
    loader.load(texUrl(w, kind), tex => {
        loading--;
        tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = maxAniso;
        if (w.material.map) w.material.map.dispose();
        w.material.map = tex; w.material.color.set(0xffffff); w.material.needsUpdate = true;
        w.loaded = kind; w.loading = null;
    }, undefined, () => { loading--; w.loading = null; w.failed = (w.failed || 0) + 1; });
}
function dropTexture(w) {
    if (!w.loaded) return;
    w.material.map.dispose(); w.material.map = null; w.material.color.set(0x20262e);
    w.material.needsUpdate = true; w.loaded = null;
}
function wanted(w) {
    const big = w.kind === 'hero' || w.kind === 'finale';
    if (w === state.focus || (big && w.dist < 22)) return 'full';
    if (big) return w.dist < 60 ? 'thumb' : 'small';
    return w.dist < (w.kind === 'grid' ? 4.5 : 9) ? 'thumb' : 'small';
}
function streamTextures() {
    const todo = [];
    let held = 0;
    for (const w of state.works) {
        const d = Math.hypot(w.x - state.pos.x, w.z - state.pos.z);
        w.dist = d;
        const big = w.kind === 'hero' || w.kind === 'finale';
        w.mesh.visible = d < (big ? 90 : 48);
        w.mirror.visible = d < 22;
        if (d > 70 && w.loaded && !big) dropTexture(w);
        held += texBytes(w);
        if (w.loading || (w.failed || 0) >= 3 || d > (big ? 80 : reach)) continue;
        const want = wanted(w);
        if (!w.loaded || RANK[w.loaded] < RANK[want]) todo.push([w, want]);
    }
    if (held > TEX_BUDGET) {
        const far = state.works.filter(w => w.loaded && w.dist > 14 && w !== state.focus).sort((a, b) => b.dist - a.dist);
        for (const w of far) {
            if (held <= TEX_BUDGET * 0.85) break;
            held -= texBytes(w); dropTexture(w);
            reach = Math.max(14, Math.min(reach, w.dist - 1));
        }
    } else if (held < TEX_BUDGET * 0.7) reach = Math.min(36, reach + 0.5);
    state.texMB = Math.round(held / 1e6);
    // nearest first; a picture with nothing on it yet goes before one that only wants sharpening
    todo.sort((a, b) => (a[0].loaded ? 1 : 0) - (b[0].loaded ? 1 : 0) || a[0].dist - b[0].dist);
    for (const [w, want] of todo) { if (loading >= (want === 'full' ? 8 : 6)) break; setTexture(w, want); }
}

/* ---------- moving ---------- */
function step(dx, dz) {
    const p = state.pos; let moved = false;
    if (dx && L.walkable(p.x + dx, p.z)) { p.x += dx; moved = true; }
    if (dz && L.walkable(p.x, p.z + dz)) { p.z += dz; moved = true; }
    return moved;
}
function wrapPi(d) { d %= Math.PI * 2; if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
const turnTo = (a, b, k) => a + wrapPi(b - a) * k;
function teleport(x, z, yaw, pitch) {
    const fade = $('fade');
    fade.classList.add('on');
    state.path = null; state.settle = null;
    setTimeout(() => {
        state.pos.set(x, EYE, z); state.yaw = yaw; state.pitch = pitch;
        streamTextures();
        setTimeout(() => fade.classList.remove('on'), 140);
    }, 300);
}
function goTo(x, z, yaw = null, pitch = 0, speed = null) {
    const pts = L.findPath(state.pos.x, state.pos.z, x, z);
    let total = 0;
    const lens = [];
    if (pts) for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); lens.push(d); total += d; }
    if (!pts || total > 62) { teleport(x, z, yaw === null ? state.yaw : yaw, pitch); return; }
    state.settle = null;
    state.path = { pts, lens, total, s: 0, yaw, pitch, speed: speed || Math.min(10, Math.max(3.2, total / 2.4)) };
}
function viewpoint(w) {
    const vf = camera.fov * Math.PI / 360, hf = Math.atan(Math.tan(vf) * camera.aspect);
    const air = w.kind === 'hero' || w.kind === 'finale' ? 1.4 : 1;   // large works are seen with wall around them
    const want = Math.min(6.5, air * Math.max(1.25, (w.w / 2 * 1.28) / Math.tan(hf), (w.h / 2 * 1.5) / Math.tan(vf)));
    let d = want;
    while (d > 0.9 && !L.walkable(w.x + w.nx * d, w.z + w.nz * d, 0.3)) d -= 0.1;
    return { x: w.x + w.nx * d, z: w.z + w.nz * d, yaw: Math.atan2(w.nx, w.nz), pitch: Math.atan2(w.y - EYE, d) };
}

/* ---------- focus and the information panel ---------- */
function fmtDate(s) { return s ? s.slice(0, 10).replace(/-/g, '.') : null; }
function renderPanel() {
    const w = state.focus;
    $('panel').hidden = !w || (!!state.tour && !!state.hidePanel);
    document.body.classList.toggle('focused', !!w);
    if (!w) return;
    const p = w.p;
    $('panel-count').textContent = `${TX.ui.halls[p.album]} · ${w.seq + 1} / ${w.list.length}`;
    $('panel-title').textContent = titleOf(p);
    const own = p.title_by === 'yumok';
    $('panel-titleby').textContent = [noteOf(p), own ? t('own') : t('ai')].filter(Boolean).join(' · ');
    $('panel-titleby').className = own || p.self_portrait ? 'own' : '';
    const exp = [p.focal_length_mm && `${Math.round(p.focal_length_mm)}mm`, p.f_number && `f/${p.f_number}`,
        p.exposure_s && `${p.exposure_s}s`, p.iso && `ISO ${p.iso}`].filter(Boolean).join(' · ');
    const rows = [[t('taken'), fmtDate(p.taken)], [t('place'), placeOf(p)], [t('camera'), p.camera], [t('lens'), p.lens], [t('settings'), exp]];
    const dl = $('panel-meta');
    dl.textContent = '';
    for (const [k, val] of rows) {
        if (!val) continue;
        const dt = document.createElement('dt'), dd = document.createElement('dd');
        dt.textContent = k; dd.textContent = val; dl.append(dt, dd);
    }
    $('panel-credit').textContent = p.people ? '' : t('credit');      // pictures of people are not offered for free reuse
    $('open').textContent = t('page');
    $('open').href = `../${lang === 'ko' ? '' : lang + '/'}works/${p.album}/${p.id.split('/')[1].replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')}.html`;
    $('share').textContent = t('share');
}
function focus(w, instant) {
    state.focus = w;
    const v = viewpoint(w);
    if (instant) { state.pos.set(v.x, EYE, v.z); state.yaw = v.yaw; state.pitch = v.pitch; state.path = null; }
    else goTo(v.x, v.z, v.yaw, v.pitch);
    history.replaceState(null, '', '#' + w.p.id);
    renderPanel();
    $('caption').hidden = true;
    state.tourClock = 0;
    if (state.tour && w.group !== 'awards') state.tourAt = w.seq;
}
function unfocus() {
    if (!state.focus) return;
    state.focus = null;
    history.replaceState(null, '', location.pathname + location.search);
    renderPanel();
}
function neighbour(d) {
    const list = state.focus ? state.focus.list : state.main, n = list.length, i = state.focus ? state.focus.seq : (d > 0 ? -1 : 0);
    focus(list[(i + d + n) % n]);
}
// The guided visit. state.tour is false, 'play' or 'pause'.
function tourUi() {
    const on = !!state.tour;
    document.body.classList.toggle('touring', on);
    $('transport').hidden = !on;
    $('t-play').setAttribute('aria-pressed', state.tour === 'play');
    tip('t-play', state.tour === 'play' ? t('pause') : t('resume'));
    $('t-info').setAttribute('aria-pressed', !state.hidePanel);
    $('tour').setAttribute('aria-pressed', on);
    if (on) $('t-count').textContent = `${state.tourAt + 1} / ${state.main.length}`;
    if (state.tour !== 'play') $('t-bar').firstElementChild.style.transform = `scaleX(${state.tour ? Math.min(1, state.tourClock / 7) : 0})`;
    renderPanel();
}
function tourStart() {
    // from the work in front of you, or the nearest one if you are inside a gallery; otherwise from the beginning
    const here = L.roomAt(state.pos.x, state.pos.z);
    const w = state.focus && state.focus.group !== 'awards' ? state.focus
        : here && here.album && here.album !== 'awards' ? state.main.reduce((a, b) => ((b.dist ?? 1e9) < (a.dist ?? 1e9) ? b : a)) : state.main[0];
    state.tour = 'play'; state.hidePanel = false; state.tourAt = w.seq;
    if (state.look) setLook(false);
    focus(w);
    tourUi();
}
function tourPause() { if (state.tour === 'play') { state.tour = 'pause'; tourUi(); } }
function tourResume() {
    if (!state.tour) return;
    state.tour = 'play';
    if (state.focus !== state.main[state.tourAt]) focus(state.main[state.tourAt]);
    tourUi();
}
function tourStep(d) {
    const n = state.main.length;
    state.tourAt = (state.tourAt + d + n) % n;
    focus(state.main[state.tourAt]);
    tourUi();
}
function tourStop() {
    if (!state.tour) return;
    state.tour = false; state.hidePanel = false;
    tourUi();
}
// Anything the visitor does by hand (looking around, walking, choosing a room) pauses the visit; it never ends it.
const setTour = on => { if (!on) tourPause(); };

$('panel-close').addEventListener('click', () => {
    if (state.tour) { state.hidePanel = true; tourUi(); }   // closing the label does not end the visit
    else unfocus();
});
$('prev').addEventListener('click', () => (state.tour ? tourStep(-1) : neighbour(-1)));
$('next').addEventListener('click', () => (state.tour ? tourStep(1) : neighbour(1)));
$('tour').addEventListener('click', () => (state.tour ? tourStop() : tourStart()));
$('t-prev').addEventListener('click', () => tourStep(-1));
$('t-next').addEventListener('click', () => tourStep(1));
$('t-play').addEventListener('click', () => (state.tour === 'play' ? tourPause() : tourResume()));
$('t-stop').addEventListener('click', tourStop);
$('t-info').addEventListener('click', () => { state.hidePanel = !state.hidePanel; tourUi(); });
$('share').addEventListener('click', async () => {
    const w = state.focus; if (!w) return;
    const data = { title: `${titleOf(w.p)} - ${t('title')}`, url: location.href };
    try {
        if (navigator.share) await navigator.share(data);
        else { await navigator.clipboard.writeText(data.url); $('share').textContent = t('copied'); }
    } catch (e) { /* cancelled */ }
});

/* ---------- places to jump to ---------- */
function entryOf(roomId) {
    const d = L.DOORS.find(x => x.id === 'nave-' + roomId);
    return d.x0 < 0 ? { x: d.x0 - 2.4, z: d.c, yaw: Math.PI / 2 } : { x: d.x1 + 2.4, z: d.c, yaw: -Math.PI / 2 };
}
const FILM_SEAT = { x: L.SCREEN.x + 5.9, z: L.SCREEN.z, yaw: Math.PI / 2 };
const STOPS = [['film', () => FILM_SEAT], ['court', () => ({ x: -4.1, z: -2.2, yaw: 0 })], ['abstract', () => entryOf('a1')], ['reflection', () => entryOf('refl')],
    ['pattern', () => entryOf('patt')], ['landscape', () => entryOf('land')], ['awards', () => ({ x: 12.75, z: 12.6, yaw: Math.PI })]];
function renderHalls() {
    const nav = $('halls');
    nav.textContent = '';
    for (const [key, where] of STOPS) {
        const b = document.createElement('button');
        b.dataset.hall = key;
        b.textContent = key === 'court' || key === 'film' ? t(key) : TX.ui.halls[key];
        b.addEventListener('click', () => { closePops(); setTour(false); unfocus(); const p = where(); goTo(p.x, p.z, p.yaw); });
        nav.append(b);
    }
}

/* ---------- plan ---------- */
const MAP = { s: 2.5, x0: -23.5, z0: -75 };
function drawMap() {
    const c = $('map'), dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(47 * MAP.s), H = Math.round(101.5 * MAP.s);
    if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px'; }
    const g = c.getContext('2d');
    g.setTransform(dpr * MAP.s, 0, 0, dpr * MAP.s, -MAP.x0 * dpr * MAP.s, -MAP.z0 * dpr * MAP.s);
    g.clearRect(MAP.x0, MAP.z0, 47, 101.5);
    const here = L.roomAt(state.pos.x, state.pos.z);
    const tint = { vest: '#2b3038', nave: '#8f8d88', ink: '#39404c', moss: '#3d4a42', clay: '#5b4336', stone: '#99958c', dusk: '#453f4a' };
    for (const r of L.ROOMS) {
        g.globalAlpha = here && here.id === r.id ? 1 : 0.62;
        g.fillStyle = tint[r.style]; g.fillRect(r.x0, r.z0, r.x1 - r.x0, r.z1 - r.z0);
    }
    g.globalAlpha = 1;
    g.fillStyle = '#2a5d86'; g.fillRect(L.POOL.x0, L.POOL.z0, L.POOL.x1 - L.POOL.x0, L.POOL.z1 - L.POOL.z0);
    g.fillStyle = '#8f8d88';
    for (const d of L.DOORS) { if (d.type === 'x') g.fillRect(d.x0, d.c - d.w / 2, d.x1 - d.x0, d.w); else g.fillRect(d.c - d.w / 2, d.z0, d.w, d.z1 - d.z0); }
    g.fillStyle = '#15171b';
    for (const o of L.partitions()) g.fillRect(o.x0 - 0.15, o.z0, 0.7, o.z1 - o.z0);
    const { x, z } = state.pos, fx = -Math.sin(state.yaw), fz = -Math.cos(state.yaw);
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.beginPath(); g.moveTo(x, z); g.arc(x, z, 6, Math.atan2(fz, fx) - 0.5, Math.atan2(fz, fx) + 0.5); g.closePath(); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, z, 0.95, 0, Math.PI * 2); g.fill();
}
$('map').addEventListener('click', ev => {
    const r = ev.currentTarget.getBoundingClientRect();
    const x = (ev.clientX - r.left) / MAP.s + MAP.x0, z = (ev.clientY - r.top) / MAP.s + MAP.z0;
    if (!L.walkable(x, z, 0.3)) return;
    setTour(false); unfocus(); goTo(x, z, null);
});

/* ---------- language ---------- */
function applyLang() {
    const info = LANG_LIST.find(x => x.code === lang) || {};
    document.documentElement.lang = info.html || lang;
    document.documentElement.dir = info.dir || 'ltr';
    readFonts();
    try { localStorage.setItem('lang', lang); } catch (e) { /* storage unavailable */ }
    document.title = `${t('eyebrow')} - ${t('title')}`;
    for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(el.dataset.t);
    // on touch screens the note about the keyboard is left out
    if (window.matchMedia('(pointer: coarse)').matches) for (const el of document.querySelectorAll('[data-touch-trim]')) {
        el.textContent = el.textContent.replace(/\s*[(（][^)）]*[)）]\s*[.。]?\s*$/, '');
    }
    $('welcome-lang').lastElementChild.textContent = info.name || lang;
    if (state.ready) $('enter').textContent = t('enter');
    for (const b of document.querySelectorAll('#langs button')) b.setAttribute('aria-pressed', b.dataset.lang === lang);
    $('home').href = lang === 'ko' ? '../index.html' : `../${lang}/index.html`;
    document.querySelector('.fallback a').href = $('home').href;
    tip('home', t('home')); tip('langBtn', t('language')); tip('roomsBtn', t('rooms')); tip('look', t('look'));
    tip('mapBtn', t('map')); tip('bow', t('bow')); tip('quiet', state.quiet ? t('quietOff') : t('quiet')); tip('tour', t('tour')); tip('t-prev', t('prevWork')); tip('t-next', t('nextWork')); tip('t-stop', t('tourStop')); tip('t-info', t('info'));
    tip('t-play', state.tour === 'play' ? t('pause') : t('resume'));
    tip('sound', media.soundOn ? t('soundOff') : t('soundOn'));
    $('map').setAttribute('aria-label', t('map'));
    $('panel-close').setAttribute('aria-label', t('close'));
    buildShared(); updateSocial(L.roomAt(state.pos.x, state.pos.z));
    if (state.ready) { renderHalls(); buildTexts(); renderPanel(); updateLabels(true); }
}
async function setLang(code) {
    if (code === lang) return;
    try { TX = await loadLang(code); lang = code; applyLang(); } catch (e) { return; /* keep the current language */ }
    // Korean words on the walls are drawn again once their font has arrived
    if (code === 'ko') fontReady().then(() => { if (state.ready && lang === 'ko') { buildTexts(); buildShared(); updateLabels(true); } });
}
for (const info of LANG_LIST) {
    const b = document.createElement('button');
    b.dataset.lang = info.code; b.textContent = info.name; b.lang = info.html || info.code;
    b.addEventListener('click', () => { closePops(); setLang(info.code); });
    $('langs').append(b);
}

/* ---------- menus, hints, and chrome that steps back ---------- */
function closePops() { $('langs').hidden = true; $('halls').hidden = true; }
function togglePop(id) { const el = $(id), open = el.hidden; closePops(); el.hidden = !open; }
$('langBtn').addEventListener('click', ev => { ev.stopPropagation(); togglePop('langs'); });
$('welcome-lang').addEventListener('click', ev => { ev.stopPropagation(); togglePop('langs'); });
$('roomsBtn').addEventListener('click', ev => { ev.stopPropagation(); togglePop('halls'); });
document.addEventListener('pointerdown', ev => { if (!ev.target.closest('.pop')) closePops(); });
$('mapBtn').addEventListener('click', () => {
    const off = document.body.classList.toggle('nomap');
    $('mapBtn').setAttribute('aria-pressed', !off);
});
let hintTimer = 0;
function hint(text, ms = 4500) {
    const el = $('hint');
    el.textContent = text; el.hidden = false;
    clearTimeout(hintTimer); hintTimer = setTimeout(() => { el.hidden = true; }, ms);
}
let idle = 0;
const wake = () => { idle = 0; document.body.classList.remove('idle'); };
for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart']) window.addEventListener(type, wake, { passive: true });
window.addEventListener('pointermove', () => { if (!state.look) wake(); }, { passive: true });

/* ---------- mouse look: for those who walk through games ---------- */
function setLook(on) {
    if (on) { if (canvas.requestPointerLock) canvas.requestPointerLock(); }
    else if (document.exitPointerLock) document.exitPointerLock();
}
document.addEventListener('pointerlockchange', () => {
    state.look = document.pointerLockElement === canvas;
    document.body.classList.toggle('looking', state.look);
    $('look').setAttribute('aria-pressed', state.look);
    if (state.look) { setTour(false); state.settle = null; hint(t('lookHint')); }
});
document.addEventListener('mousemove', ev => {
    if (!state.look) return;
    const k = 0.0021 * (camera.fov / 60);
    state.yaw -= ev.movementX * k;
    state.pitch = Math.max(-0.9, Math.min(0.9, state.pitch - ev.movementY * k));
});
$('look').addEventListener('click', () => setLook(!state.look));

/* ---------- touch: a thumb stick ---------- */
const joy = { x: 0, y: 0, id: null };
{
    const el = $('joy'), knob = el.firstElementChild;
    const move = ev => {
        const r = el.getBoundingClientRect();
        let x = (ev.clientX - r.left - r.width / 2) / (r.width / 2), y = (ev.clientY - r.top - r.height / 2) / (r.height / 2);
        const l = Math.hypot(x, y);
        if (l > 1) { x /= l; y /= l; }
        joy.x = x; joy.y = y;
        knob.style.transform = `translate(${x * 30}px, ${y * 30}px)`;
    };
    const end = ev => { if (ev.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; };
    el.addEventListener('pointerdown', ev => { joy.id = ev.pointerId; el.setPointerCapture(ev.pointerId); move(ev); ev.preventDefault(); });
    el.addEventListener('pointermove', ev => { if (ev.pointerId === joy.id) move(ev); });
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
}

/* ---------- input ---------- */
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let drag = null;
function pick(ev) {
    const r = canvas.getBoundingClientRect();
    if (state.look) ndc.set(0, 0);
    else ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const wall = ray.intersectObjects(solids, false)[0];
    const hit = ray.intersectObjects(state.meshes, false)[0];
    if (hit && (!wall || hit.distance < wall.distance + 0.15)) return { work: hit.object.userData.work };
    const film = media.screen && ray.intersectObject(media.screen, false)[0];
    if (film && (!wall || film.distance < wall.distance + 0.15)) return { film: true };
    const o = ray.ray.origin, d = ray.ray.direction;
    if (d.y < -0.02) {
        const k = -o.y / d.y, x = o.x + d.x * k, z = o.z + d.z * k;
        if ((!wall || k < wall.distance) && k < 45 && L.walkable(x, z, 0.3)) return { floor: { x, z } };
    }
    return {};
}
function userActs() { state.path = null; state.settle = null; setTour(false); }
canvas.addEventListener('pointerdown', ev => {
    if (!state.entered) return;
    if (!state.look) canvas.setPointerCapture(ev.pointerId);
    drag = { x: ev.clientX, y: ev.clientY, sx: ev.clientX, sy: ev.clientY, t: performance.now(), moved: false };
    canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove', ev => {
    if (!drag) {
        if (state.entered && ev.pointerType === 'mouse') { const h = pick(ev); canvas.classList.toggle('pointing', !!(h.work || h.film)); }
        return;
    }
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    drag.x = ev.clientX; drag.y = ev.clientY;
    if (Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) > 7) { if (!drag.moved) userActs(); drag.moved = true; }
    if (drag.moved && !state.look) {
        const k = 0.0042 * (camera.fov / 60);
        // the view follows the hand, as in a game: drag right to look right, drag up to look up
        state.yaw -= dx * k;
        state.pitch = Math.max(-0.75, Math.min(0.75, state.pitch - dy * k));
    }
});
function endDrag(ev) {
    if (!drag) return;
    const tap = !drag.moved && performance.now() - drag.t < 500;
    drag = null;
    canvas.classList.remove('dragging');
    if (!tap) return;
    const hit = pick(ev);
    if (hit.work) { setTour(false); focus(hit.work); }
    else if (hit.film) { setTour(false); unfocus(); goTo(FILM_SEAT.x, FILM_SEAT.z, FILM_SEAT.yaw, 0.05); }
    else if (hit.floor) { setTour(false); unfocus(); goTo(hit.floor.x, hit.floor.z, null, 0, 4.2); }
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', () => { drag = null; canvas.classList.remove('dragging'); });
canvas.addEventListener('wheel', ev => {
    if (!state.entered) return;
    ev.preventDefault();
    userActs();
    const d = Math.max(-1, Math.min(1, -ev.deltaY / 100)) * 0.7;
    step(-Math.sin(state.yaw) * d, 0); step(0, -Math.cos(state.yaw) * d);
}, { passive: false });

const MOVE = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], KeyD: [1, 0] };
window.addEventListener('keydown', ev => {
    if (!state.entered || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.code === 'Escape') { closePops(); if (state.tour) tourStop(); else unfocus(); return; }
    if (ev.code === 'Space' && state.tour) { ev.preventDefault(); if (state.tour === 'play') tourPause(); else tourResume(); return; }
    if (ev.code === 'KeyF') { setLook(!state.look); return; }
    if (state.focus && (ev.code === 'ArrowLeft' || ev.code === 'ArrowRight')) { const d = ev.code === 'ArrowLeft' ? -1 : 1; if (state.tour) tourStep(d); else neighbour(d); ev.preventDefault(); return; }
    if (MOVE[ev.code] || ev.code === 'ArrowLeft' || ev.code === 'ArrowRight' || ev.code.startsWith('Shift')) { state.keys.add(ev.code); ev.preventDefault(); }
});
window.addEventListener('keyup', ev => state.keys.delete(ev.code));
window.addEventListener('blur', () => state.keys.clear());

/* ---------- caption for the small works, which carry no label of their own ---------- */
function updateCaption() {
    const cap = $('caption');
    if (state.focus || !state.entered || state.path) { cap.hidden = true; return; }
    const fx = -Math.sin(state.yaw), fz = -Math.cos(state.yaw);
    let best = null, bestA = 0.22;
    for (const w of state.works) {
        if (w.dist > 6.5 || w.kind !== 'grid') continue;
        const dx = w.x - state.pos.x, dz = w.z - state.pos.z, d = Math.hypot(dx, dz) || 1;
        if (dx * w.nx + dz * w.nz > 0) continue;
        const a = Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / d)));
        if (a < bestA && L.clearPath(state.pos.x, state.pos.z, w.x + w.nx * 0.6, w.z + w.nz * 0.6, 0.1)) { bestA = a; best = w; }
    }
    if (!best) { cap.hidden = true; return; }
    cap.hidden = false;
    cap.textContent = titleOf(best.p);
    const sub = [placeOf(best.p), best.p.taken && best.p.taken.slice(0, 4)].filter(Boolean).join(' · ');
    if (sub) { const s = document.createElement('small'); s.textContent = sub; cap.append(s); }
}

/* ---------- loop ---------- */
const clock = new THREE.Clock();
let slow = 0;
function frame() {
    const real = Math.min(clock.getDelta(), 0.5), dt = Math.min(real, 0.05);
    state.time += real;
    uTime.value = state.time;
    // a device that cannot hold 38 frames a second for three seconds running gets a softer picture, down to 0.75
    if (state.entered && real < 0.25 && state.time > fps.since) {
        fps.t += real; fps.n++;
        if (fps.t >= 1) {
            fps.low = fps.n / fps.t < 38 ? fps.low + 1 : 0;
            fps.t = 0; fps.n = 0;
            if (fps.low >= 3 && dpr > 0.75) { dpr = Math.max(0.75, dpr - 0.25); renderer.setPixelRatio(dpr); resize(); fps.low = 0; }
        }
    }
    if (pool) pool.material.uniforms.time.value = state.time;
    const p = state.path;
    if (p) {
        const rem = p.total - p.s;
        const v = p.speed * Math.min(1, 0.22 + p.s / 1.6, 0.22 + rem / 1.6);
        p.s = Math.min(p.total, p.s + v * Math.min(real, 0.1));
        let s = p.s, i = 0;
        while (i < p.lens.length - 1 && s > p.lens[i]) { s -= p.lens[i]; i++; }
        const a = p.pts[i], b = p.pts[i + 1], k = p.lens[i] ? Math.min(1, s / p.lens[i]) : 1;
        state.pos.set(a[0] + (b[0] - a[0]) * k, EYE, a[1] + (b[1] - a[1]) * k);
        const along = Math.atan2(-(b[0] - a[0]), -(b[1] - a[1]));
        const late = p.total - p.s < 2.0 || p.total < 2.5;
        const wantYaw = late && p.yaw !== null ? p.yaw : (p.total < 0.3 ? state.yaw : along);
        const kk = 1 - Math.exp(-real * (late ? 5.5 : 3.2));
        if (!state.look) {
            state.yaw = turnTo(state.yaw, wantYaw, kk);
            state.pitch += ((late ? p.pitch : 0) - state.pitch) * kk;
        }
        if (p.s >= p.total) { state.path = null; if (p.yaw !== null && !state.look) state.settle = { yaw: p.yaw, pitch: p.pitch }; }
    } else if (state.settle) {
        const k = 1 - Math.exp(-real * 6);
        state.yaw = turnTo(state.yaw, state.settle.yaw, k);
        state.pitch += (state.settle.pitch - state.pitch) * k;
        if (Math.abs(wrapPi(state.settle.yaw - state.yaw)) < 0.002) state.settle = null;
    }
    if (state.entered && !state.path) {
        let mx = 0, mz = 0;
        for (const c of state.keys) if (MOVE[c]) { mx += MOVE[c][0]; mz += MOVE[c][1]; }
        mx += joy.x; mz -= joy.y;
        const turn = (state.keys.has('ArrowLeft') ? 1 : 0) - (state.keys.has('ArrowRight') ? 1 : 0);
        if (turn) { state.settle = null; state.yaw += turn * 1.7 * dt; }
        if (Math.hypot(mx, mz) > 0.12) {
            userActs();
            if (state.focus) unfocus();
            const l = Math.hypot(mx, mz);
            const speed = (state.keys.has('ShiftLeft') || state.keys.has('ShiftRight') ? 6.5 : 3.2) * dt * Math.min(1, l), sn = Math.sin(state.yaw), cs = Math.cos(state.yaw);
            step(((mx / l) * cs - (mz / l) * sn) * speed, 0); step(0, (-(mx / l) * sn - (mz / l) * cs) * speed);
        }
    }
    if (state.tour === 'play' && state.focus && !state.path) {
        state.tourClock += real;
        const dwell = state.focus.kind === 'hero' || state.focus.kind === 'finale' ? 11 : 7;
        $('t-bar').firstElementChild.style.transform = `scaleX(${Math.min(1, state.tourClock / dwell)})`;
        if (state.tourClock > dwell) tourStep(1);
    }
    camera.position.copy(state.pos);             // the eye is where the visitor stands
    let dip = 0;                                 // your own bow: the view lowers and returns
    if (state.bowT > 0) { state.bowT -= real; dip = -0.36 * Math.sin(Math.PI * Math.max(0, 1 - state.bowT / 1.6)); }
    camera.rotation.set(state.pitch + dip, state.yaw, 0);
    Presence.update(real, state);
    Npc.update(Math.min(real, 0.1), state.pos);
    slow += real;
    if (slow > 0.2) {
        slow = 0;
        if (renderer.domElement.width !== Math.round(window.innerWidth * renderer.getPixelRatio())) resize();
        streamTextures();
        updateLabels(false);
        updateCaption();
        if (state.entered) drawMap();
        const here = L.roomAt(state.pos.x, state.pos.z);
        const key = here ? (here.album || (here.id === 'nave' ? 'court' : here.id === 'film' ? 'film' : null)) : null;
        updateMedia(here);
        updateSocial(here);
        $('where').textContent = !here ? '' : here.album ? TX.ui.halls[here.album] : here.id === 'nave' ? t('court') : here.id === 'film' ? t('film') : here.id === 'log' ? t('log') : '';
        idle += 0.2;
        if (idle > 6 && state.entered && $('langs').hidden && $('halls').hidden) document.body.classList.add('idle');
        for (const b of document.querySelectorAll('#halls button')) b.setAttribute('aria-current', b.dataset.hall === key);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
}

/* ---------- start ---------- */
applyLang();
const shoots = fetch('../data/shoots.json').then(r => r.json()).then(d => d.days).catch(() => []);
Promise.all([fetch('../data/photos.json').then(r => r.json()), shoots]).then(async ([data, days]) => {
    state.shoots = days;
    state.photos = data.photos;
    await fontReady();
    buildArchitecture();
    buildPool();
    buildMedia();
    buildWorks(data.photos);
    Presence.start({ scene, onChange: () => { buildShared(); updateSocial(L.roomAt(state.pos.x, state.pos.z)); } });
    state.ready = true;
    document.documentElement.dataset.hall = 'ready';
    buildTexts();
    renderHalls();
    streamTextures();
    const btn = $('enter');
    btn.disabled = false;
    btn.textContent = t('enter');
    btn.addEventListener('click', () => {
        state.entered = true;
        $('welcome').classList.add('gone');
        document.body.classList.add('inside');
        const target = state.works.find(w => '#' + w.p.id === decodeURIComponent(location.hash));
        if (target) focus(target, true);
        else goTo((Math.random() - 0.5) * 2.4, 6.4 + Math.random() * 0.6, 0, 0, 1.1);   // a slow walk towards the portal, each visitor to a slightly different spot
        Presence.enter(lang);
        fps.since = state.time + 6;                                      // judge smoothness once the first pictures are in
        setTimeout(() => Npc.start({ scene, works: state.works }), 1500);  // the families come in after you
        let alone = false;
        try { alone = localStorage.getItem('quiet') === 'on'; } catch (e) { /* storage unavailable */ }
        if (alone) setQuiet(true, false);
        // sound is on unless this visitor turned it off before
        let quiet = false;
        try { quiet = localStorage.getItem('sound') === 'off'; } catch (e) { /* storage unavailable */ }
        if (!quiet) setSound(true, false);
        canvas.focus();
    });
    requestAnimationFrame(frame);
}).catch(err => { console.error(err); fail(); });
