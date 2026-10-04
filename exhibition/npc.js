// Three small families who wander the hall and stop to look at the photographs.
// The figures were generated with Tripo AI; see npc/README.md.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as L from './layout.js';

const CAST = [
    { file: 'grandfather', height: 1.68, group: 0, speed: 0.8 },
    { file: 'grandmother', height: 1.55, group: 0, speed: 0.8 },
    { file: 'mother', height: 1.62, group: 1, speed: 1.0 },
    { file: 'girl', height: 1.16, group: 1, speed: 1.0 },
    { file: 'father', height: 1.74, group: 2, speed: 1.05 },
    { file: 'boy', height: 1.38, group: 2, speed: 1.05 },
];
const START = [40, 150, 215];          // where in the hanging order each family begins
const people = [], groups = [];
let works = [], scene = null, quiet = false, started = false;

const rnd = (a, b) => a + Math.random() * (b - a);
function wrapPi(d) { d %= Math.PI * 2; if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }

function spotFor(w, side) {
    // stand a little back from the work, members side by side
    const tx = w.nz, tz = -w.nx;
    for (const d of [2.1, 1.7, 1.4]) for (const s of [side, side * 0.5, 0]) {
        const x = w.x + w.nx * d + tx * s, z = w.z + w.nz * d + tz * s;
        if (L.walkable(x, z, 0.35)) return { x, z };
    }
    return { x: w.x + w.nx * 1.4, z: w.z + w.nz * 1.4 };
}
function send(group) {
    const candidates = works.length;
    group.index = (group.index + 1 + Math.floor(Math.random() * 3)) % candidates;
    const w = works[group.index];
    group.work = w; group.wait = 0; group.hold = rnd(9, 18);
    group.members.forEach((p, i) => {
        const spot = spotFor(w, (i - (group.members.length - 1) / 2) * 0.95);
        const pts = L.findPath(p.x, p.z, spot.x, spot.z);
        if (!pts) { p.x = spot.x; p.z = spot.z; p.path = null; p.arrived = true; return; }
        const lens = [];
        for (let k = 1; k < pts.length; k++) lens.push(Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
        p.path = { pts, lens, i: 0, s: 0, delay: i * 0.6 };
        p.arrived = false;
        p.face = Math.atan2(-w.nx, -w.nz);
    });
}
function play(p, name) {
    if (p.playing === name || !p.actions[name]) return;
    const next = p.actions[name], prev = p.actions[p.playing];
    next.reset().fadeIn(0.35).play();
    if (prev) prev.fadeOut(0.35);
    p.playing = name;
}

export function setQuiet(on) { quiet = on; }

export function start(ctx) {
    if (started) return;
    started = true;
    scene = ctx.scene;
    works = ctx.works.filter(w => w.kind !== 'finale');
    // the figures are lit; nothing else in the hall uses lights
    scene.add(new THREE.HemisphereLight(0xfff6ea, 0x6f6a62, 2.1));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(0.4, 1, 0.6);
    scene.add(sun);

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const shadowGeo = new THREE.CircleGeometry(0.32, 20);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
    for (let g = 0; g < 3; g++) groups.push({ members: [], index: START[g] % works.length, work: null, wait: 0, hold: 10, ready: false });

    CAST.forEach(c => {
        loader.load(`npc/${c.file}.glb`, gltf => {
            const root = gltf.scene;
            root.traverse(o => {
                if (!o.isMesh) return;
                o.frustumCulled = false;
                o.material.metalness = 0; o.material.roughness = 0.92;
            });
            const box = new THREE.Box3().setFromObject(root);
            root.scale.setScalar(c.height / Math.max(0.01, box.max.y - box.min.y));
            const mixer = new THREE.AnimationMixer(root), actions = {};
            for (const clip of gltf.animations) actions[clip.name.toLowerCase()] = mixer.clipAction(clip);
            if (actions.walk) actions.walk.timeScale = 0.9 + c.speed * 0.25;
            if (actions.idle) actions.idle.time = Math.random() * 10;
            const shadow = new THREE.Mesh(shadowGeo, shadowMat);
            shadow.rotation.x = -Math.PI / 2; shadow.renderOrder = 2;
            const group = groups[c.group];
            const w = works[group.index], i = group.members.length;
            const spot = spotFor(w, (i - 0.5) * 0.95);
            const p = { ...c, root, mixer, actions, shadow, x: spot.x, z: spot.z, yaw: Math.atan2(-w.nx, -w.nz), face: Math.atan2(-w.nx, -w.nz), path: null, arrived: true, playing: null };
            play(p, 'idle');
            scene.add(root, shadow);
            people.push(p); group.members.push(p);
            group.work = w; group.ready = true;
        }, undefined, () => { /* a missing figure is simply absent */ });
    });
}

export function update(dt, camPos) {
    for (const g of groups) {
        if (!g.ready || !g.members.length) continue;
        if (g.members.every(p => p.arrived)) {
            g.wait += dt;
            if (g.wait > g.hold) send(g);
        }
    }
    for (const p of people) {
        const far = Math.hypot(p.x - camPos.x, p.z - camPos.z) > 55;
        const path = p.path;
        if (path) {
            if (path.delay > 0) path.delay -= dt;
            else {
                play(p, 'walk');
                path.s += p.speed * dt;
                while (path.i < path.lens.length && path.s > path.lens[path.i]) { path.s -= path.lens[path.i]; path.i++; }
                if (path.i >= path.lens.length) {
                    const end = path.pts[path.pts.length - 1];
                    p.x = end[0]; p.z = end[1]; p.path = null; p.arrived = true;
                } else {
                    const a = path.pts[path.i], b = path.pts[path.i + 1], k = path.lens[path.i] ? path.s / path.lens[path.i] : 1;
                    p.x = a[0] + (b[0] - a[0]) * k; p.z = a[1] + (b[1] - a[1]) * k;
                    p.yaw += wrapPi(Math.atan2(b[0] - a[0], b[1] - a[1]) - p.yaw) * Math.min(1, dt * 6);
                }
            }
        } else {
            play(p, 'idle');
            p.yaw += wrapPi(p.face - p.yaw) * Math.min(1, dt * 4);
        }
        p.root.visible = !far && !quiet; p.shadow.visible = !far && !quiet;
        if (far || quiet) continue;
        p.root.position.set(p.x, 0, p.z);
        p.root.rotation.y = p.yaw;
        p.shadow.position.set(p.x, 0.011, p.z);
        p.mixer.update(dt);
    }
}
