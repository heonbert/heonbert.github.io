# Shared presence server

A small Cloudflare Worker for the site. It keeps three things: who is in the 3D hall right now, how many people have visited, and how many flowers have been laid.

Visitors can send only their position and two fixed gestures (bow, lay a flower). There is no chat, no guestbook and no free text, so nothing needs moderating and there is no admin password.
No personal data is stored. A short hash of the visitor's address is kept until the end of the day, to allow one flower and a few counted visits per person per day.

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

Open `http://localhost:8765/exhibition/?rt=http://127.0.0.1:8787`.
