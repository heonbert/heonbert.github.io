// Floor plan, hanging plan and path-finding for the exhibition. Pure functions, no rendering.
//
// Plan (north is -z). A dark vestibule opens onto a tall nave with a long pool under a skylight.
// Abstract fills the three west rooms; Reflection, Pattern and Landscape the three east rooms.
// The pool runs north to the end wall, where the photographer's self-portrait hangs alone.

export const TH = 0.5;          // wall thickness
export const RADIUS = 0.38;     // visitor radius
export const EYE = 1.6;         // eye height
export const CY = 1.55;         // hanging centre height
export const POOL = { x0: -2.2, x1: 2.2, z0: -66, z1: -6 };

const SINGLE = { w: 1.35, h: 0.9, pitch: 1.95 };
const GRID = { w: 0.96, h: 0.64, dx: 1.08, dy: 0.38, pitch: 3.8 };
const HERO = { w: 2.4, h: 1.6, zone: 4.2 };
const W0 = -22.5, W1 = -6.5, E0 = 6.5, E1 = 22.5, GH = 4.6;

export const ROOMS = [
    { id: 'vest', x0: -6, x1: 6, z0: 0.5, z1: 9.5, h: 3.6, style: 'vest' },
    { id: 'film', x0: -19, x1: -6.5, z0: 0.5, z1: 9.5, h: 4.2, style: 'vest' },   // his own film of the water
    { id: 'log', x0: 6.5, x1: 19, z0: 0.5, z1: 9.5, h: 4.2, style: 'vest' },      // the days he went out
    { id: 'nave', x0: -6, x1: 6, z0: -74, z1: 0, h: 9, style: 'nave' },
    { id: 'a1', album: 'abstract', x0: W0, x1: W1, z0: -24.5, z1: -0.5, h: GH, style: 'ink', part: 12 },
    { id: 'a2', album: 'abstract', x0: W0, x1: W1, z0: -49, z1: -25, h: GH, style: 'ink', part: 12 },
    { id: 'a3', album: 'abstract', x0: W0, x1: W1, z0: -73.5, z1: -49.5, h: GH, style: 'ink', part: 12 },
    { id: 'refl', album: 'reflection', x0: E0, x1: E1, z0: -25.5, z1: -0.5, h: GH, style: 'moss', part: 12 },
    { id: 'patt', album: 'pattern', x0: E0, x1: E1, z0: -39, z1: -26, h: GH, style: 'clay', allGrid: true },
    { id: 'land', album: 'landscape', x0: E0, x1: E1, z0: -73.5, z1: -39.5, h: GH, style: 'stone', part: 16 },
];
const AXW = W1 - 4, AXE = E0 + 4; // enfilade axes of the two wings

// type 'x': you walk through along x (wall slab spans x0..x1); type 'z': along z.
export const DOORS = [
    { id: 'vest-nave', type: 'z', z0: 0, z1: 0.5, c: 0, w: 4.4, h: 3.2 },
    { id: 'vest-film', type: 'x', x0: -6.5, x1: -6, c: 5, w: 3, h: 3 },
    { id: 'vest-log', type: 'x', x0: 6, x1: 6.5, c: 5, w: 3, h: 3 },
    { id: 'nave-a1', type: 'x', x0: W1, x1: -6, c: -12.5, w: 4, h: 3.4 },
    { id: 'nave-a2', type: 'x', x0: W1, x1: -6, c: -37, w: 4, h: 3.4 },
    { id: 'nave-a3', type: 'x', x0: W1, x1: -6, c: -61.5, w: 4, h: 3.4 },
    { id: 'nave-refl', type: 'x', x0: 6, x1: E0, c: -13, w: 4, h: 3.4 },
    { id: 'nave-patt', type: 'x', x0: 6, x1: E0, c: -32.5, w: 4, h: 3.4 },
    { id: 'nave-land', type: 'x', x0: 6, x1: E0, c: -56.5, w: 4, h: 3.4 },
    { id: 'a1-a2', type: 'z', z0: -25, z1: -24.5, c: AXW, w: 3, h: 3.2 },
    { id: 'a2-a3', type: 'z', z0: -49.5, z1: -49, c: AXW, w: 3, h: 3.2 },
    { id: 'refl-patt', type: 'z', z0: -26, z1: -25.5, c: AXE, w: 3, h: 3.2 },
    { id: 'patt-land', type: 'z', z0: -39.5, z1: -39, c: AXE, w: 3, h: 3.2 },
];

// Works given a wall of their own. Chosen on the photographer's own record where there is one:
// 9, 11, 12 are his three contest pictures of 2019; 147 he showed at the 2020 club exhibition.
// 1, 143, 155, 245, 247 close the long views through the wings. 274 is his self-portrait.
export const HEROES = {
    a1: { part: 9, end: 1 }, a2: { part: 11 }, a3: { part: 12, end: 143 },
    refl: { part: 147, end: 155 }, land: { part: 245, end: 247 },
};
export const FINALE = 274;

const near = (a, b) => Math.abs(a - b) < 1e-6;

/* ---------- walls ---------- */
// Sides in loop order; t runs along the side from its start corner.
function sides(r) {
    return [
        { name: 'N', sx: r.x0, sz: r.z0, dx: 1, dz: 0, nx: 0, nz: 1, len: r.x1 - r.x0 },
        { name: 'E', sx: r.x1, sz: r.z0, dx: 0, dz: 1, nx: -1, nz: 0, len: r.z1 - r.z0 },
        { name: 'S', sx: r.x1, sz: r.z1, dx: -1, dz: 0, nx: 0, nz: -1, len: r.x1 - r.x0 },
        { name: 'W', sx: r.x0, sz: r.z1, dx: 0, dz: -1, nx: 1, nz: 0, len: r.z1 - r.z0 },
    ];
}
function doorOn(r, s, d) {
    if (d.type === 'x' && (s.name === 'E' || s.name === 'W')) {
        const wallX = s.name === 'E' ? r.x1 : r.x0;
        if (!(near(wallX, d.x0) || near(wallX, d.x1)) || d.c < r.z0 || d.c > r.z1) return null;
        const t = s.name === 'E' ? d.c - r.z0 : r.z1 - d.c;
        return { t0: t - d.w / 2, t1: t + d.w / 2, door: d };
    }
    if (d.type === 'z' && (s.name === 'N' || s.name === 'S')) {
        const wallZ = s.name === 'N' ? r.z0 : r.z1;
        if (!(near(wallZ, d.z0) || near(wallZ, d.z1)) || d.c < r.x0 || d.c > r.x1) return null;
        const t = s.name === 'N' ? d.c - r.x0 : r.x1 - d.c;
        return { t0: t - d.w / 2, t1: t + d.w / 2, door: d };
    }
    return null;
}
/** Wall faces of a room: solid segments and the openings cut by doors. */
export function roomWalls(r) {
    return sides(r).map(s => {
        const open = DOORS.map(d => doorOn(r, s, d)).filter(Boolean).sort((a, b) => a.t0 - b.t0);
        const solid = [];
        let t = 0;
        for (const o of open) { if (o.t0 > t) solid.push({ t0: t, t1: o.t0 }); t = o.t1; }
        if (t < s.len) solid.push({ t0: t, t1: s.len });
        return { ...s, open, solid };
    });
}

/* ---------- obstacles and walking ---------- */
function partitionOf(r) {
    if (!r.part) return null;
    const west = r.x1 <= 0;
    const x = west ? r.x1 - 7.5 : r.x0 + 7.5, cz = (r.z0 + r.z1) / 2;
    return { x0: x - 0.2, x1: x + 0.2, z0: cz - r.part / 2, z1: cz + r.part / 2, room: r.id, kind: 'partition', toNave: west ? 1 : -1 };
}
function benchOf(r) {
    if (!r.album) return null;
    const p = partitionOf(r), cz = (r.z0 + r.z1) / 2;
    const x = p ? (p.x0 + p.x1) / 2 - p.toNave * 3.5 : (r.x0 + r.x1) / 2;
    return { x0: x - 0.26, x1: x + 0.26, z0: cz - 1.1, z1: cz + 1.1, room: r.id, kind: 'bench' };
}
export const OBSTACLES = [
    { ...POOL, kind: 'pool' },
    ...ROOMS.map(partitionOf).filter(Boolean),
    ...ROOMS.map(benchOf).filter(Boolean),
    { x0: -12.3, x1: -11.78, z0: 3.6, z1: 6.4, room: 'film', kind: 'bench' },
];
export const SCREEN = { x: -19, z: 5, y: 1.95, w: 5.6, h: 3.15, nx: 1, nz: 0 };

export function walkable(x, z, r = RADIUS) {
    let ok = false;
    for (const m of ROOMS) if (x >= m.x0 + r && x <= m.x1 - r && z >= m.z0 + r && z <= m.z1 - r) { ok = true; break; }
    if (!ok) for (const d of DOORS) {
        if (d.type === 'x' ? (x >= d.x0 - 0.6 && x <= d.x1 + 0.6 && z >= d.c - d.w / 2 + r && z <= d.c + d.w / 2 - r)
            : (z >= d.z0 - 0.6 && z <= d.z1 + 0.6 && x >= d.c - d.w / 2 + r && x <= d.c + d.w / 2 - r)) { ok = true; break; }
    }
    if (!ok) return false;
    for (const o of OBSTACLES) if (x > o.x0 - r && x < o.x1 + r && z > o.z0 - r && z < o.z1 + r) return false;
    return true;
}
export function clearPath(ax, az, bx, bz, r = 0.3) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / 0.25));
    for (let i = 0; i <= n; i++) {
        const k = i / n;
        if (!walkable(ax + (bx - ax) * k, az + (bz - az) * k, r)) return false;
    }
    return true;
}
export function roomAt(x, z) {
    return ROOMS.find(m => x >= m.x0 - TH / 2 && x <= m.x1 + TH / 2 && z >= m.z0 - TH / 2 && z <= m.z1 + TH / 2) || null;
}

/* ---------- way-finding: a small visibility graph ---------- */
const NODES = [];
for (const d of DOORS) {
    if (d.type === 'x') { NODES.push([d.x0 - 1.3, d.c], [d.x1 + 1.3, d.c]); }
    else { NODES.push([d.c, d.z0 - 1.3], [d.c, d.z1 + 1.3]); }
}
for (const o of OBSTACLES) {
    const m = 0.95;
    NODES.push([o.x0 - m, o.z0 - m], [o.x1 + m, o.z0 - m], [o.x0 - m, o.z1 + m], [o.x1 + m, o.z1 + m]);
    if (o.kind === 'pool') for (let z = o.z0 + 8; z < o.z1; z += 8) NODES.push([o.x0 - m, z], [o.x1 + m, z]);
}
const GOOD = NODES.filter(([x, z]) => walkable(x, z));
let EDGES = null;
function edges() {
    if (EDGES) return EDGES;
    EDGES = GOOD.map(() => []);
    for (let i = 0; i < GOOD.length; i++) for (let j = i + 1; j < GOOD.length; j++) {
        const [ax, az] = GOOD[i], [bx, bz] = GOOD[j], d = Math.hypot(ax - bx, az - bz);
        if (d < 40 && clearPath(ax, az, bx, bz)) { EDGES[i].push([j, d]); EDGES[j].push([i, d]); }
    }
    return EDGES;
}
/** Shortest walking route as a list of [x, z] points, or null. */
export function findPath(ax, az, bx, bz) {
    if (clearPath(ax, az, bx, bz)) return [[ax, az], [bx, bz]];
    const E = edges(), n = GOOD.length, S = n, G = n + 1;
    const pts = [...GOOD, [ax, az], [bx, bz]];
    const adj = E.map(l => l.slice());
    adj.push([], []);
    for (let i = 0; i < n; i++) {
        const [x, z] = GOOD[i];
        if (clearPath(ax, az, x, z)) adj[S].push([i, Math.hypot(ax - x, az - z)]);
        if (clearPath(x, z, bx, bz)) adj[i].push([G, Math.hypot(bx - x, bz - z)]);
    }
    const dist = new Array(n + 2).fill(Infinity), prev = new Array(n + 2).fill(-1), done = new Array(n + 2).fill(false);
    dist[S] = 0;
    for (;;) {
        let u = -1;
        for (let i = 0; i < n + 2; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
        if (u < 0 || dist[u] === Infinity) return null;
        if (u === G) break;
        done[u] = true;
        for (const [v, w] of adj[u]) if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; }
    }
    const out = [];
    for (let u = G; u >= 0; u = prev[u]) out.unshift(pts[u]);
    return out;
}

/* ---------- hanging ---------- */
function pack(units, usable, f) {
    const out = usable.map(() => []);
    let i = 0;
    for (let j = 0; j < usable.length && i < units.length; j++) {
        let used = 0;
        while (i < units.length && used + units[i].pitch * f <= usable[j] + 1e-6) { used += units[i].pitch * f; out[j].push(units[i++]); }
    }
    return i < units.length ? null : out;
}
function sequence(s, g) {
    const u = s + g, isGrid = new Array(u).fill(false);
    for (let k = 0; k < g; k++) isGrid[Math.min(u - 1, Math.round((k + 0.5) * u / g - 0.5))] = true;
    // rounding can collide; top up from the left
    let have = isGrid.filter(Boolean).length;
    for (let i = 0; have < g && i < u; i++) if (!isGrid[i]) { isGrid[i] = true; have++; }
    return isGrid.map(gr => gr ? { kind: 'grid', pitch: GRID.pitch, n: 6 } : { kind: 'single', pitch: SINGLE.pitch, n: 1 });
}

function hangRoom(r, list, byN) {
    const works = [];
    const hero = HEROES[r.id] || {};
    const part = partitionOf(r);
    const cz = (r.z0 + r.z1) / 2;
    const add = (p, kind, x, z, nx, nz, w, h, y = CY) => works.push({ p, kind, x, z, nx, nz, w, h, y, room: r.id });

    // hero zone at the end of the wing's long view
    const endSide = r.id === 'a1' || r.id === 'refl' ? 'S' : r.id === 'a3' || r.id === 'land' ? 'N' : null;
    const axis = r.x1 <= 0 ? AXW : AXE;
    const walls = roomWalls(r);
    let runs = [], loop = 0, navePos = 0;
    for (const s of walls) {
        for (const o of s.open) if (o.door.id.startsWith('nave-')) navePos = loop + o.t1;
        for (const seg of s.solid) {
            let parts = [seg];
            if (hero.end && s.name === endSide) {
                const t = s.name === 'N' ? axis - r.x0 : r.x1 - axis;
                parts = [{ t0: seg.t0, t1: t - HERO.zone / 2 }, { t0: t + HERO.zone / 2, t1: seg.t1 }];
                add(byN[hero.end], 'hero', s.sx + s.dx * t, s.sz + s.dz * t, s.nx, s.nz, HERO.w, HERO.h);
            }
            for (const q of parts) if (q.t1 - q.t0 >= 2.6) runs.push({ ...s, t0: q.t0, t1: q.t1, pos: loop + q.t0 });
        }
        loop += s.len;
    }
    runs.sort((a, b) => ((a.pos - navePos + loop) % loop) - ((b.pos - navePos + loop) % loop));
    if (part) {
        const px = part.toNave > 0 ? part.x1 : part.x0;
        if (hero.part) add(byN[hero.part], 'hero', px, cz, part.toNave, 0, HERO.w, HERO.h);
        const bx = part.toNave > 0 ? part.x0 : part.x1;
        // back face, hung in the same walking direction as the far wall
        runs.push(part.toNave > 0
            ? { sx: bx, sz: part.z1, dx: 0, dz: -1, nx: -1, nz: 0, t0: 0, t1: part.z1 - part.z0 }
            : { sx: bx, sz: part.z0, dx: 0, dz: 1, nx: 1, nz: 0, t0: 0, t1: part.z1 - part.z0 });
    }

    const usable = runs.map(q => Math.max(0, q.t1 - q.t0 - 1.0));
    let plan = null;
    search: for (const minF of [1.15, 1.0]) {
        const maxG = Math.floor(list.length / 6);
        for (let g = r.allGrid ? maxG : 0; g <= maxG; g++) {
            const units = sequence(list.length - 6 * g, g);
            for (const f of [1.6, 1.5, 1.4, 1.3, 1.2, 1.15, 1.1, 1.05, 1.0]) {
                if (f < minF) break;
                const res = pack(units, usable, f);
                if (res) { plan = res; break search; }
            }
        }
    }
    if (!plan) throw new Error(`room ${r.id}: ${list.length} works do not fit`);

    let k = 0;
    plan.forEach((items, j) => {
        const q = runs[j], total = items.reduce((s, u) => s + u.pitch, 0);
        let cum = 0;
        for (const u of items) {
            const t = q.t0 + 0.5 + usable[j] * (cum + u.pitch / 2) / total;
            cum += u.pitch;
            const x = q.sx + q.dx * t, z = q.sz + q.dz * t;
            if (u.kind === 'single') add(list[k++], 'single', x, z, q.nx, q.nz, SINGLE.w, SINGLE.h);
            else for (let row = 0; row < 2; row++) for (let col = -1; col <= 1; col++) {
                add(list[k++], 'grid', x + q.dx * col * GRID.dx, z + q.dz * col * GRID.dx, q.nx, q.nz, GRID.w, GRID.h, CY + (row ? -GRID.dy : GRID.dy));
            }
        }
    });
    return works;
}

/** Decide where every photograph hangs. Returns works in visiting order. */
export function hang(photos) {
    const byN = {};
    for (const p of photos) byN[p.n] = p;
    const special = new Set([FINALE]);
    for (const h of Object.values(HEROES)) { if (h.part) special.add(h.part); if (h.end) special.add(h.end); }
    const works = [];
    for (const album of ['abstract', 'reflection', 'pattern', 'landscape']) {
        const rooms = ROOMS.filter(r => r.album === album);
        const list = photos.filter(p => p.album === album && !special.has(p.n));
        const share = Math.ceil(list.length / rooms.length);
        rooms.forEach((r, i) => works.push(...hangRoom(r, list.slice(i * share, (i + 1) * share), byN)));
    }
    const nave = ROOMS.find(r => r.id === 'nave');
    works.push({ p: byN[FINALE], kind: 'finale', x: 0, z: nave.z0, nx: 0, nz: 1, w: 2.7, h: 1.8, y: 2.0, room: 'nave' });
    return works;
}
export const partitions = () => OBSTACLES.filter(o => o.kind === 'partition');
export const benches = () => OBSTACLES.filter(o => o.kind === 'bench');
