// 유목의 물빛사진 - shared presence for the site.
// One Durable Object holds three things: who is in the 3D hall right now, how many people have
// visited, and how many flowers have been laid. Visitors can send only their position and two
// fixed gestures. There is no free text anywhere, so there is nothing to moderate.
import { DurableObject } from 'cloudflare:workers';

const ORIGINS = ['https://seungheon.com', 'https://www.seungheon.com', 'https://heonbert.github.io'];
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const MAX_PEERS = 80;
const BOUNDS = { x: 24, z0: -76, z1: 11 };

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
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(req) } });
const today = () => new Date().toISOString().slice(0, 10);
// A short hash standing in for the visitor's address. The address itself is never stored.
async function who(req) {
    const ip = req.headers.get('CF-Connecting-IP') || 'local';
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('yumok|' + ip));
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
            CREATE TABLE IF NOT EXISTS rate (k TEXT PRIMARY KEY, n INTEGER NOT NULL);`);
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

    // Allow `limit` actions of one kind per visitor per day. Rows older than today are deleted.
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
    // One flower per visitor per day, from the 3D hall or from the front page.
    layFlower(id) {
        if (!this.within(id, 'flower', 1)) return false;
        this.broadcast({ t: 'f', flowers: this.bump('flowers') });
        return true;
    }

    async fetch(req) {
        const url = new URL(req.url);
        const ok = allowed(req.headers.get('Origin') || '');
        if (url.pathname === '/ws') return this.connect(req, url);
        if (url.pathname === '/state' && req.method === 'GET') return json(req, this.summary());
        if (url.pathname === '/visit' && req.method === 'POST') {       // one visit, from any page of the site
            if (ok && this.within(await who(req), 'visit', 3)) this.bump('visits');
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
        if (this.ctx.getWebSockets().length >= MAX_PEERS) return new Response('full', { status: 503 });
        const visitor = await who(req);
        if (url.searchParams.get('new') === '1' && this.within(visitor, 'visit', 3)) this.bump('visits');
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
            const laid = this.layFlower(me.who);
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
