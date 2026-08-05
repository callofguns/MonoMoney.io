# MonoMoney relay

The piece that makes **Play with friends** actually work across separate
devices. It is deliberately dumb: it tracks which WebSocket connection is
which seat in which room and forwards messages between them, and never once
reads a rule of the game. The whole simulation — state, turn engine, bots,
market — still runs entirely in the host player's browser, exactly like a
solo game always has; every other connected browser is a thin view that
sends the host its intent (roll, buy, bid, trade) and renders whatever the
host broadcasts back. That split is why this file is ~150 lines: it has
nothing to validate, because it has no idea what a "rent" or a "share" is.

## Why this exists at all

MonoMoney.io ships as a single static HTML file with no server. That's fine
for a solo game against bots, but two browsers on two different networks
have no way to find each other without *something* in the middle to
introduce them. This is that something — the smallest thing that could
plausibly do the job.

## Run it locally

```bash
cd server
npm install
npm start                 # listens on :8787 by default
```

Point the game at `ws://localhost:8787` in the **Play with friends** panel
and you can open two browser tabs and play against yourself to see it work.

## Deploy it for real

Any host that runs a long-lived Node process works — this needs a real
process, not a serverless function, since it holds a WebSocket open per
player. Render, Railway, Fly.io and Glitch all have free tiers that are
enough for a few rooms of four:

1. Push this `server/` folder (or the whole repo) to the host of your choice.
2. Set the start command to `npm install && npm start`, root directory `server/`.
3. It reads `PORT` from the environment — most platforms set this for you.
4. Once it's live you'll have a `wss://your-app.onrender.com`-style URL.
   Paste that into the game's **Play with friends** panel (it's remembered
   in your browser after that) and share the room code it gives you.

## A note on the game's own shareable link

If you're trying this through the `Artifact` preview link Claude Code
publishes, or any other sandboxed preview host, outbound WebSocket
connections are blocked for security — **Play with friends** won't be able
to reach any relay from there, including one you've deployed yourself. It
works once `dist/monomoney.html` (or `index.html` + `src/`) is hosted
somewhere you control, same as the rest of the game.

## Protocol, such as it is

Every message is JSON. `hello` (host or guest, with a name and a persisted
`clientId`) gets a `hello-ack` back with your room code and seat number.
After that, anything you send is relayed to the rest of the room verbatim,
stamped with `from: <your seat>` — or to one specific seat if you set `to`.
A disconnected seat can reclaim itself by reconnecting with the same
`clientId`, which is how a refreshed tab gets its seat back mid-game.
