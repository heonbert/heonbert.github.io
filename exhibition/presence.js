// Other visitors, the lanterns of those who came before, and the flowers at the last wall.
// Talks to the small server in ../realtime. Without a server address the exhibition simply runs alone.
import * as THREE from 'three';
import { REALTIME } from './config.js';
import * as L from './layout.js';

const override = new URLSearchParams(location.search).get('rt');
const isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
export const BASE = ((isLocal && override) || REALTIME || '').replace(/\/$/, '');
export const enabled = !!BASE;
const DAY = new Date().toISOString().slice(0, 10);
let laidToday = false;
try { laidToday = localStorage.getItem('flower-day') === DAY; } catch (e) { /* storage unavailable */ }
export const shared = { visits: 0, flowers: 0, here: 1, laid: laidToday };

const peers = new Map();
let scene = null, onChange = () => {}, ws = null, retry = 0, wantOpen = false;
let figureTex = null, lanterns = null, flowers = null;
const sent = { x: 1e9, z: 0, yaw: 0, at: 0, beat: 0 };
const NAVE = L.ROOMS.find(r => r.id === 'nave');
const MAX_LANTERNS = 180, MAX_FLOWERS = 600;

function rand(i, salt) { const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return s - Math.floor(s); }

function makeFigureTexture() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 384;
    const g = c.getContext('2d');
    g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 14;
    g.fillStyle = 'rgba(236,241,250,0.6)';
    g.beginPath(); g.arc(64, 50, 27, 0, Math.PI * 2); g.fill();
    g.beginPath();
    g.moveTo(26, 118); g.quadraticCurveTo(64, 78, 102, 118);
    g.lineTo(94, 366); g.quadraticCurveTo(64, 378, 34, 366); g.closePath(); g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
function makeFlowerTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const g = c.getContext('2d');
    g.translate(48, 48);
    for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 14; i++) {
        g.save(); g.rotate((i + ring * 0.5) * Math.PI / 7);
        g.fillStyle = ring ? 'rgba(255,255,255,0.95)' : 'rgba(232,234,230,0.9)';
        g.beginPath(); g.ellipse(0, ring ? -17 : -26, ring ? 5 : 6, ring ? 13 : 17, 0, 0, Math.PI * 2); g.fill();
        g.restore();
    }
    g.fillStyle = '#e9d27a'; g.beginPath(); g.arc(0, 0, 7, 0, Math.PI * 2); g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
function makeGlowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 1, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,220,170,0.7)'); gr.addColorStop(1, 'rgba(255,200,140,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
}

function build() {
    figureTex = makeFigureTexture();
    // one small light on the water for everyone who has visited
    const pos = new Float32Array(MAX_LANTERNS * 3), P = L.POOL;
    for (let i = 0; i < MAX_LANTERNS; i++) {
        pos[i * 3] = P.x0 + 0.35 + rand(i, 1) * (P.x1 - P.x0 - 0.7);
        pos[i * 3 + 1] = 0.0;
        pos[i * 3 + 2] = P.z1 - 1 - rand(i, 2) * (P.z1 - P.z0 - 2);
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    lg.setDrawRange(0, 0);
    lanterns = new THREE.Points(lg, new THREE.PointsMaterial({
        map: makeGlowTexture(), size: 0.42, sizeAttenuation: true, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, color: 0xffd9a8,
    }));
    lanterns.frustumCulled = false; lanterns.renderOrder = 4;
    scene.add(lanterns);
    // flowers laid at the foot of the last wall
    flowers = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.3, 0.3),
        new THREE.MeshBasicMaterial({ map: makeFlowerTexture(), transparent: true, depthWrite: false }), MAX_FLOWERS);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < MAX_FLOWERS; i++) {
        q.setFromEuler(e.set(-Math.PI / 2, 0, rand(i, 3) * Math.PI * 2));
        const r = 0.27 * Math.sqrt(i + 0.6), a = i * 2.399963;
        const size = 0.75 + rand(i, 4) * 0.6;
        flowers.setMatrixAt(i, m.compose(v.set(Math.cos(a) * r * 1.25, 0.014 + i * 0.00004, NAVE.z0 + 0.28 + Math.abs(Math.sin(a)) * r * 0.62), q, one.set(size, size, 1)));
    }
    flowers.count = 0; flowers.frustumCulled = false; flowers.renderOrder = 4;
    scene.add(flowers);
}
function refresh() {
    if (lanterns) lanterns.geometry.setDrawRange(0, Math.min(MAX_LANTERNS, shared.visits));
    if (flowers) flowers.count = Math.min(MAX_FLOWERS, shared.flowers);
    onChange();
}

// Everyone arrives at the same spot. A visitor still standing there is not drawn, or newcomers would walk into them.
const atDoor = p => Math.abs(p.x) < 0.05 && Math.abs(p.z - 8.9) < 0.05;
function addPeer(p) {
    if (peers.has(p.id)) return peers.get(p.id);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: figureTex, transparent: true, depthWrite: false }));
    sprite.center.set(0.5, 0); sprite.scale.set(0.6, 1.8, 1); sprite.renderOrder = 5;
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.renderOrder = 2;
    const peer = { id: p.id, x: p.x, z: p.z, tx: p.x, tz: p.z, sprite, shadow, bow: 0 };
    sprite.position.set(p.x, 0, p.z); shadow.position.set(p.x, 0.01, p.z);
    scene.add(sprite, shadow);
    peers.set(p.id, peer);
    return peer;
}
function dropPeer(id) {
    const p = peers.get(id);
    if (!p) return;
    scene.remove(p.sprite, p.shadow);
    p.sprite.material.dispose(); p.shadow.geometry.dispose(); p.shadow.material.dispose();
    peers.delete(id);
}

function open(first) {
    if (!enabled || ws) return;
    const url = BASE.replace(/^http/, 'ws') + '/ws' + (first ? '?new=1' : '');
    try { ws = new WebSocket(url); } catch (e) { ws = null; return; }
    ws.onmessage = ev => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'hi') {
            retry = 0;
            for (const id of [...peers.keys()]) dropPeer(id);
            for (const p of m.peers) if (!atDoor(p)) addPeer(p);
            Object.assign(shared, { visits: m.visits, flowers: m.flowers, here: peers.size + 1 });
            sent.x = 1e9;
            refresh();
        } else if (m.t === 'p') {
            if (atDoor(m) && !peers.has(m.id)) return;   // has only just arrived and not moved yet
            const p = addPeer(m); p.tx = m.x; p.tz = m.z;
            if (shared.here !== peers.size + 1) { shared.here = peers.size + 1; onChange(); }
        } else if (m.t === 'bye') {
            dropPeer(m.id); shared.here = peers.size + 1; onChange();
        } else if (m.t === 'g') {
            const p = peers.get(m.id);
            if (m.g === 'bow' && p) p.bow = 1.6;
        } else if (m.t === 'f') {
            shared.flowers = m.flowers; refresh();
        } else if (m.t === 'laid') {                   // the server's answer to our own flower
            shared.flowers = m.flowers; shared.laid = true;
            try { localStorage.setItem('flower-day', DAY); } catch (e) { /* storage unavailable */ }
            refresh();
        }
    };
    ws.onclose = () => {
        ws = null;
        for (const id of [...peers.keys()]) dropPeer(id);
        shared.here = 1; onChange();
        if (wantOpen) setTimeout(() => open(false), Math.min(30000, 1500 * 2 ** retry++));
    };
    ws.onerror = () => { try { ws && ws.close(); } catch (e) { /* already closed */ } };
}

export function start(ctx) {
    scene = ctx.scene; onChange = ctx.onChange || onChange;
    if (!enabled) return;
    build();
    fetch(BASE + '/state').then(r => r.json()).then(d => {
        Object.assign(shared, { visits: d.visits, flowers: d.flowers });
        refresh();
    }).catch(() => { /* server unreachable: stay alone */ });
}
export function enter() {
    if (!enabled) return;
    let first = false;
    const day = new Date().toISOString().slice(0, 10);
    try { first = localStorage.getItem('visit-day') !== day; localStorage.setItem('visit-day', day); } catch (e) { /* storage unavailable */ }
    wantOpen = true;
    open(first);
}
export function gesture(g) {
    if (!ws || ws.readyState !== 1) return false;
    if (g === 'flower') { if (shared.laid) return false; shared.laid = true; }
    ws.send(JSON.stringify({ t: 'g', g }));
    return true;
}
export function update(real, state) {
    if (!enabled) return;
    const now = performance.now();
    if (ws && ws.readyState === 1 && now - sent.at > 160) {
        const { x, z } = state.pos;
        if (Math.hypot(x - sent.x, z - sent.z) > 0.04 || Math.abs(state.yaw - sent.yaw) > 0.06) {
            Object.assign(sent, { x, z, yaw: state.yaw, at: now });
            ws.send(JSON.stringify({ t: 'p', x: +x.toFixed(2), z: +z.toFixed(2), yaw: +state.yaw.toFixed(2) }));
        }
    }
    if (ws && ws.readyState === 1 && now - sent.beat > 45000) { sent.beat = now; ws.send('{"t":"h"}'); }
    const k = 1 - Math.exp(-real * 7);
    for (const p of peers.values()) {
        p.x += (p.tx - p.x) * k; p.z += (p.tz - p.z) * k;
        let sy = 1.8;
        if (p.bow > 0) { p.bow -= real; sy = 1.8 - 0.3 * Math.sin(Math.PI * Math.max(0, 1 - p.bow / 1.6)); }
        p.sprite.position.set(p.x, 0, p.z); p.sprite.scale.y = sy;
        p.shadow.position.set(p.x, 0.01, p.z);
        // step aside visually when someone stands exactly where you are
        const near = Math.hypot(p.x - state.pos.x, p.z - state.pos.z);
        p.sprite.material.opacity = Math.min(1, Math.max(0, (near - 1.1) / 1.4));
        p.shadow.material.opacity = 0.28 * p.sprite.material.opacity;
    }
}
