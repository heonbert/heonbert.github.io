# Shared presence and counting server

A small Cloudflare Worker for the site. It keeps four things: who is in the 3D hall right now, how many people have visited, how many flowers have been laid, and daily totals of which kind of page was read in which language.

Visitors can send only their position and two fixed gestures (bow, lay a flower). There is no chat, no guestbook and no free text, so nothing needs moderating and there is no admin password.

## What it knows about a visitor

Nothing that lasts. To keep one address from being counted again and again, the Worker keeps a short hash of the visitor's network address, mixed with the date, until the end of that day. The address itself is never stored, the hash is different every day, and yesterday's hashes are deleted. No cookies are set.

## Endpoints

| | |
|---|---|
| `GET /state` | visits, flowers, how many are in the hall now |
| `POST /hit` | body `{"p": "<kind of page>", "l": "<language>", "v": 1 or 0}`; counts one page read, and a visit when `v` is 1 |
| `POST /flower` | lays a flower |
| `GET /stats?days=90` | daily totals, totals by kind of page and by language. Sums only; shown at `/stats.html` |
| `GET /ws` | the 3D hall: positions and gestures over a WebSocket |
| `POST /visit` | the older way of counting a visit; kept for pages cached before `/hit` existed |

Limits per network address per day: 100 visits, 30 flowers, 600 page reads, and six sockets at a time. Each browser also limits itself to one visit and one flower a day.

## Deploy

```
cd realtime
npx wrangler login
npx wrangler deploy
```

The address that `deploy` prints goes into `exhibition/config.js`.

## Try it locally

```
cd realtime
npx wrangler dev --port 8787
```

Open `http://localhost:8765/exhibition/?rt=http://127.0.0.1:8787` or `http://localhost:8765/?rt=http://127.0.0.1:8787`.
