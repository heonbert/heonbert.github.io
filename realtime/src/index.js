// 유목의 물빛사진 - shared presence and counting for the site.
// One Durable Object holds four things: who is in the 3D hall right now, how many people have
// visited, how many flowers have been laid, and daily totals of which kind of page was read in
// which language. Visitors can send only their position and two fixed gestures. There is no free
// text anywhere, so there is nothing to moderate, and nothing here identifies a visitor.
import { DurableObject } from 'cloudflare:workers';

const ORIGINS = ['https://seungheon.com', 'https://www.seungheon.com', 'https://heonbert.github.io'];
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const MAX_PEERS = 80;
const MAX_PER_ADDRESS = 6;                       // sockets from one network address at a time
const BOUNDS = { x: 24, z0: -76, z1: 28 };
// What one network address may add in a day. Schools, offices and phone networks share addresses,
// so these are generous; each browser also limits itself to one visit and one flower a day.
const LIMIT = { visit: 100, flower: 30, hit: 600 };
const PAGES = new Set(['home', 'about', 'license', 'work', 'hall', 'album-abstract', 'album-reflection', 'album-pattern', 'album-landscape', 'album-awards']);
const LANGS = new Set(['ko', 'en', 'ja', 'de', 'zh', 'zh-tw', 'es', 'fr', 'pt', 'it', 'ru', 'ar', 'hi', 'id', 'vi', 'tr']);

const allowed = origin => ORIGINS.includes(origin) || LOCAL.test(origin);
function cors(req) {
    const o = req.headers.get('Origin') || '';
    return {
        'Access-Control-Allow-Origin': allowed(o) ? o : ORIGINS[0],
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Vary': 'Origin',
    };
}
const json = (req, data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(req) } });
const today = () => new Date().toISOString().slice(0, 10);
// A short hash standing in for the visitor's address, different every day. The address itself is
// never stored, and yesterday's hashes are deleted, so nobody can be followed from day to day.
async function who(req) {
    const ip = req.headers.get('CF-Connecting-IP') || 'local';
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('yumok|' + today() + '|' + ip));
    return [...new Uint8Array(buf)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
    async fetch(req, env) {
        if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
        return env.HALL.get(env.HALL.idFromName('main')).fetch(req);
    },
};

export class Hall extends DurableObject {
    constructor(ctx, env) {
        super(ctx, env);
        this.sql = ctx.storage.sql;
        this.sql.exec(`CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS rate (k TEXT PRIMARY KEY, n INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS stat (day TEXT NOT NULL, page TEXT NOT NULL, lang TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, page, lang));`);
        // Counting starts afresh at each epoch. Epoch 3: public opening, after the guestbook was removed and tests were done.
        if (this.get('epoch') < 3) {
            this.sql.exec("DELETE FROM kv WHERE k IN ('visits', 'flowers', 'pending')");
            this.sql.exec('DROP TABLE IF EXISTS guest');
            this.sql.exec('DELETE FROM rate');
            this.sql.exec("INSERT INTO kv (k, v) VALUES ('epoch', 3) ON CONFLICT(k) DO UPDATE SET v = 3");
        }
    }

    get(k) { return this.sql.exec('SELECT v FROM kv WHERE k = ?', k).toArray()[0]?.v ?? 0; }
    bump(k) { this.sql.exec('INSERT INTO kv (k, v) VALUES (?, 1) ON CONFLICT(k) DO UPDATE SET v = v + 1', k); return this.get(k); }
    // Daily totals: (day, kind of page, language). '_visit' and '_flower' rows carry the day's visits and flowers.
    tally(page, lang) {
        this.sql.exec('INSERT INTO stat (day, page, lang, n) VALUES (?, ?, ?, 1) ON CONFLICT(day, page, lang) DO UPDATE SET n = n + 1', today(), page, lang);
    }

    // Allow `limit` actions of one kind per address per day. Rows older than today are deleted.
    within(id, kind, limit) {
        const day = today(), key = `${day}|${kind}|${id}`;
        this.sql.exec('DELETE FROM rate WHERE k < ?', day);
        const n = this.sql.exec('SELECT n FROM rate WHERE k = ?', key).toArray()[0]?.n ?? 0;
        if (n >= limit) return false;
        this.sql.exec('INSERT INTO rate (k, n) VALUES (?, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1', key);
        return true;
    }

    // Visitors heard from in the last few minutes. A browser that vanished without closing is not counted.
    live() {
        const since = Date.now() - 150000;
        return this.ctx.getWebSockets().map(ws => ws.deserializeAttachment()).filter(p => p && p.seen > since);
    }
    summary() {
        return { visits: this.get('visits'), flowers: this.get('flowers'), here: this.live().length };
    }
    visit(id) {
        if (!this.within(id, 'visit', LIMIT.visit)) return;
        this.bump('visits'); this.tally('_visit', '');
    }
    hit(id, page, lang) {
        if (!PAGES.has(page) || !LANGS.has(lang) || !this.within(id, 'hit', LIMIT.hit)) return;
        this.tally(page, lang);
    }
    layFlower(id) {
        if (!this.within(id, 'flower', LIMIT.flower)) return false;
        this.tally('_flower', '');
        this.broadcast({ t: 'f', flowers: this.bump('flowers') });
        return true;
    }
    // Totals for the last `days` days. Open to read: these are sums, with nothing about any one visitor.
    stats(days) {
        const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
        const rows = this.sql.exec('SELECT day, page, lang, n FROM stat WHERE day >= ? ORDER BY day', since).toArray();
        const byDay = {}, pages = {}, langs = {};
        for (const r of rows) {
            const d = byDay[r.day] ||= { day: r.day, visits: 0, flowers: 0, pages: 0 };
            if (r.page === '_visit') d.visits += r.n;
            else if (r.page === '_flower') d.flowers += r.n;
            else { d.pages += r.n; pages[r.page] = (pages[r.page] || 0) + r.n; langs[r.lang] = (langs[r.lang] || 0) + r.n; }
        }
        return { ...this.summary(), since, days: Object.values(byDay), pages, langs };
    }

    async fetch(req) {
        const url = new URL(req.url);
        const ok = allowed(req.headers.get('Origin') || '');
        if (url.pathname === '/ws') return this.connect(req, url);
        if (url.pathname === '/state' && req.method === 'GET') return json(req, this.summary());
        if (url.pathname === '/stats' && req.method === 'GET') return json(req, this.stats(Math.min(400, Math.max(1, Number(url.searchParams.get('days')) || 90))));
        if (url.pathname === '/hit' && req.method === 'POST') {         // one page read: {p: kind of page, l: language, v: 1 if the first today}
            if (ok) {
                let m = {};
                try { m = JSON.parse((await req.text()).slice(0, 200)); } catch { /* counted as nothing */ }
                const id = await who(req);
                if (m.v === 1) this.visit(id);
                this.hit(id, String(m.p || ''), String(m.l || ''));
            }
            return json(req, this.summary());
        }
        if (url.pathname === '/visit' && req.method === 'POST') {       // kept for pages cached before /hit existed
            if (ok) this.visit(await who(req));
            return json(req, this.summary());
        }
        if (url.pathname === '/flower' && req.method === 'POST') {
            const laid = ok && this.layFlower(await who(req));
            return json(req, { ...this.summary(), laid });
        }
        return json(req, { error: 'not found' }, 404);
    }

    async connect(req, url) {
        if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
        if (!allowed(req.headers.get('Origin') || '')) return new Response('forbidden', { status: 403 });
        const sockets = this.ctx.getWebSockets();
        if (sockets.length >= MAX_PEERS) return new Response('full', { status: 503 });
        const visitor = await who(req);
        if (sockets.filter(ws => ws.deserializeAttachment()?.who === visitor).length >= MAX_PER_ADDRESS) return new Response('too many', { status: 429 });
        if (url.searchParams.get('new') === '1') this.visit(visitor);
        this.hit(visitor, 'hall', url.searchParams.get('l') || '');
        const pair = new WebSocketPair();
        const id = (this.get('seq') % 1e6) + 1;
        this.bump('seq');
        const me = { id, x: 0, z: 8.9, yaw: 0, at: 0, bow: 0, seen: Date.now(), who: visitor };
        this.ctx.acceptWebSocket(pair[1]);
        pair[1].serializeAttachment(me);
        const peers = this.live().filter(p => p.id !== id).map(p => ({ id: p.id, x: p.x, z: p.z, yaw: p.yaw }));
        pair[1].send(JSON.stringify({ t: 'hi', id, peers, ...this.summary() }));
        this.broadcast({ t: 'p', id, x: me.x, z: me.z, yaw: me.yaw }, pair[1]);
        return new Response(null, { status: 101, webSocket: pair[0] });
    }

    broadcast(msg, except) {
        const text = JSON.stringify(msg);
        for (const ws of this.ctx.getWebSockets()) {
            if (ws === except) continue;
            try { ws.send(text); } catch { /* socket is closing */ }
        }
    }

    webSocketMessage(ws, raw) {
        if (typeof raw !== 'string' || raw.length > 200) return;
        let m;
        try { m = JSON.parse(raw); } catch { return; }
        const me = ws.deserializeAttachment();
        if (!me) return;
        const now = Date.now();
        if (now - me.seen > 30000) { me.seen = now; ws.serializeAttachment(me); }
        if (m.t === 'h') return;                       // heartbeat
        if (m.t === 'p') {
            const { x, z, yaw } = m;
            if (![x, z, yaw].every(Number.isFinite) || Math.abs(x) > BOUNDS.x || z < BOUNDS.z0 || z > BOUNDS.z1) return;
            if (now - me.at < 90) return;
            Object.assign(me, { seen: now, x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, yaw: Math.round(yaw * 100) / 100, at: now });
            ws.serializeAttachment(me);
            this.broadcast({ t: 'p', id: me.id, x: me.x, z: me.z, yaw: me.yaw }, ws);
        } else if (m.t === 'g' && m.g === 'bow') {
            if (now - me.bow < 2500) return;
            me.bow = now;
            ws.serializeAttachment(me);
            this.broadcast({ t: 'g', id: me.id, g: 'bow' }, ws);
        } else if (m.t === 'g' && m.g === 'flower') {
            if (me.laid === today()) { try { ws.send(JSON.stringify({ t: 'laid', laid: false, flowers: this.get('flowers') })); } catch { /* closing */ } return; }
            const laid = this.layFlower(me.who);
            if (laid) { me.laid = today(); ws.serializeAttachment(me); }
            try { ws.send(JSON.stringify({ t: 'laid', laid, flowers: this.get('flowers') })); } catch { /* closing */ }
            if (laid) this.broadcast({ t: 'g', id: me.id, g: 'flower' }, ws);
        }
    }

    webSocketClose(ws) {
        const me = ws.deserializeAttachment();
        if (me) this.broadcast({ t: 'bye', id: me.id }, ws);
    }
    webSocketError(ws) { this.webSocketClose(ws); }
}
