/* ═══════════════════════════════════════════════════════════
   MonoMoney relay — a dumb pipe, not a second copy of the game.

   The host's browser runs the entire simulation (state, turn
   engine, bots, market) exactly like a solo game always has.
   This server never reads a message's contents or knows a rule
   of Monopoly; it only tracks which connection is which seat in
   which room and forwards bytes between them. That keeps the
   game's rules living in exactly one place — the client bundle
   both the host and every guest already downloaded — instead of
   duplicating them here and risking the two copies drifting
   apart.

   Message shape (all JSON): every inbound message may carry a
   `to` (a seat index) to target one connection, otherwise it's
   broadcast to the rest of the room. The relay stamps `from`
   (the sender's seat) on the way out so nobody can spoof another
   seat — that's the one piece of protocol logic here, and it's
   about *routing*, not gameplay.
   ═══════════════════════════════════════════════════════════ */
import { WebSocketServer } from "ws";
import { createServer } from "node:http";

const PORT = process.env.PORT || 8787;
const MAX_SEATS = 4;
const ROOM_TTL_MS = 30 * 60 * 1000; /* garbage-collect an empty/abandoned room after 30 min */
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; /* no 0/O/1/I — easier to read aloud */

const rooms = new Map(); /* code -> { seats: Map<seatId, {ws, name, clientId, connected}>, locked, lastSeen } */

function makeCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function roster(room) {
  return [...room.seats.entries()]
    .map(([seat, m]) => ({ seat, name: m.name, connected: m.connected }))
    .sort((a, b) => a.seat - b.seat);
}

function broadcast(room, msg, exceptSeat) {
  const payload = JSON.stringify(msg);
  for (const [seat, m] of room.seats) {
    if (seat === exceptSeat || !m.connected) continue;
    try { m.ws.send(payload); } catch { /* dead socket, disconnect handler will clean it up */ }
  }
}

function sweepRooms() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const anyoneConnected = [...room.seats.values()].some((m) => m.connected);
    if (!anyoneConnected && now - room.lastSeen > ROOM_TTL_MS) rooms.delete(code);
  }
}
setInterval(sweepRooms, 60_000).unref();

const http = createServer((req, res) => {
  if (req.url === "/health") { res.writeHead(200); res.end("ok"); return; }
  res.writeHead(404); res.end();
});

const wss = new WebSocketServer({ server: http });

wss.on("connection", (ws) => {
  let room = null;
  let seat = null;

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    /* ── join a room (host creates one, guest joins by code) ── */
    if (msg.type === "hello") {
      if (msg.role === "host") {
        /* a dropped connection reconnecting (same clientId) reclaims its
           OWN room instead of spinning up a fresh, empty one — without
           this, a host's socket dying (e.g. iOS backgrounding the tab)
           would silently orphan everyone already in the room */
        if (msg.clientId) {
          for (const [existingCode, existingRoom] of rooms) {
            const m = existingRoom.seats.get(0);
            if (m && m.clientId === msg.clientId) {
              m.ws = ws; m.connected = true; m.name = msg.name || m.name;
              room = existingRoom; seat = 0;
              ws.send(JSON.stringify({ type: "hello-ack", room: existingCode, seat: 0, roster: roster(existingRoom), rejoin: true }));
              broadcast(existingRoom, { type: "roster", roster: roster(existingRoom) }, 0);
              return;
            }
          }
        }

        const code = makeCode();
        room = { seats: new Map(), locked: false, lastSeen: Date.now() };
        rooms.set(code, room);
        seat = 0;
        room.seats.set(0, { ws, name: msg.name || "Host", clientId: msg.clientId, connected: true });
        ws.send(JSON.stringify({ type: "hello-ack", room: code, seat: 0, roster: roster(room) }));
        return;
      }

      const code = (msg.room || "").toUpperCase();
      const target = rooms.get(code);
      if (!target) { ws.send(JSON.stringify({ type: "error", reason: "room-not-found" })); return; }

      /* reconnect: same clientId reclaims its old seat even after the game started */
      const existing = [...target.seats.entries()].find(([, m]) => m.clientId && m.clientId === msg.clientId);
      if (existing) {
        const [existingSeat, m] = existing;
        m.ws = ws; m.connected = true; m.name = msg.name || m.name;
        room = target; seat = existingSeat;
        ws.send(JSON.stringify({ type: "hello-ack", room: code, seat: existingSeat, roster: roster(target), rejoin: true }));
        broadcast(target, { type: "roster", roster: roster(target) }, existingSeat);
        return;
      }

      if (target.locked) { ws.send(JSON.stringify({ type: "error", reason: "already-started" })); return; }
      if (target.seats.size >= MAX_SEATS) { ws.send(JSON.stringify({ type: "error", reason: "room-full" })); return; }

      let next = 0;
      while (target.seats.has(next)) next += 1;
      room = target; seat = next;
      room.seats.set(next, { ws, name: msg.name || `Player ${next + 1}`, clientId: msg.clientId, connected: true });
      room.lastSeen = Date.now();
      ws.send(JSON.stringify({ type: "hello-ack", room: code, seat: next, roster: roster(room) }));
      broadcast(room, { type: "roster", roster: roster(room) }, next);
      return;
    }

    if (!room || seat === null) return; /* nothing else makes sense before hello */
    room.lastSeen = Date.now();

    /* the host locks the room the moment it starts the game — no late joins */
    if (msg.type === "lock" && seat === 0) { room.locked = true; return; }

    /* plain relay: stamp the sender, forward to one seat or the whole room */
    const out = { ...msg, from: seat };
    if (msg.to !== undefined) {
      const m = room.seats.get(msg.to);
      if (m && m.connected) { try { m.ws.send(JSON.stringify(out)); } catch { /* ignore */ } }
    } else {
      broadcast(room, out, seat);
    }
  });

  ws.on("close", () => {
    if (!room || seat === null) return;
    const m = room.seats.get(seat);
    if (m) m.connected = false;
    broadcast(room, { type: "roster", roster: roster(room) }, seat);
  });
});

http.listen(PORT, () => console.log(`MonoMoney relay listening on :${PORT}`));
