/* ═══════════════════════════════════════════════════════════
   MM.net — the only place the game knows it might not be alone.

   Everything else in the engine (turn.js, auction.js, trades.js)
   and every UI click handler was written as if there's always
   exactly one local human at seat 0. Rather than teach every one
   of those files about networking, this module is the seam: the
   host's browser is the ONE place the simulation actually runs —
   same as a solo game always has — and every other connected
   browser is a thin view that sends its intent here and renders
   whatever the host broadcasts back. Solo play never touches this
   file at all (`enabled` stays false and every call below falls
   straight through to the plain local call it's wrapping).

   Three shapes of message do all the work:
     · bus event replication — the host's MM.bus already announces
       every mutation; forwarding those verbatim means the
       renderer, panels and sound effects need zero networking
       awareness of their own, on either side of the wire.
     · ask() — an awaited decision (buy this deed? bid this much?)
       that today just shows a modal and resolves a promise on
       click. Networked, the SAME call shows the SAME modal, just
       on the deciding player's own screen, with the click sent
       back over the wire instead of resolved on the spot.
     · act() — a fire-and-forget intent (roll, build, chat) a
       guest can't apply to its own mirrored state, so it's sent
       to the host to apply for real.
   ═══════════════════════════════════════════════════════════ */
window.MM = window.MM || {};

MM.net = {
  enabled: false,
  isHost: false,
  locked: false,
  mySeat: 0,
  roomCode: null,
  roster: [],
  connectionLost: false,

  _rosterListeners: [],
  _pending: {},
  _promptSeq: 0,

  /* ── identity that survives a refresh ─────── */
  init() {
    try {
      this.clientId = localStorage.getItem("mm-client-id");
      if (!this.clientId) {
        this.clientId = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
        localStorage.setItem("mm-client-id", this.clientId);
      }
      this.relayUrl = localStorage.getItem("mm-relay-url") || "";
    } catch (e) {
      /* localStorage blocked (private mode, sandboxed frame) — a fresh id every time still works */
      this.clientId = Math.random().toString(36).slice(2);
      this.relayUrl = "";
    }
  },

  saveRelayUrl(url) {
    this.relayUrl = url;
    try { localStorage.setItem("mm-relay-url", url); } catch (e) { /* fine, just won't persist */ }
  },

  onRoster(fn) { this._rosterListeners.push(fn); },
  _fireRoster() { this._rosterListeners.forEach((fn) => fn(this.roster)); },

  /* ── connecting ─────────────────────────── */
  _connect(url) {
    return new Promise((resolve, reject) => {
      if (!url) return reject(new Error("Set a relay server address first."));
      let ws;
      try { ws = new WebSocket(url); } catch (e) { return reject(new Error("That doesn't look like a relay address.")); }
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("Couldn't reach that relay server."));
      ws.onmessage = (ev) => this._onMessage(ev);
      ws.onclose = () => this._onClose();
    });
  },

  async hostRoom(name, relayUrl) {
    this.saveRelayUrl(relayUrl);
    await this._connect(relayUrl);
    this._role = "host";
    this._lastConnect = { role: "host", name, relayUrl };
    return new Promise((resolve, reject) => {
      this._pendingHello = { resolve, reject };
      this.ws.send(JSON.stringify({ type: "hello", role: "host", name, clientId: this.clientId }));
    });
  },

  async joinRoom(code, name, relayUrl) {
    this.saveRelayUrl(relayUrl);
    await this._connect(relayUrl);
    this._role = "guest";
    this._lastConnect = { role: "guest", name, relayUrl, room: (code || "").toUpperCase() };
    return new Promise((resolve, reject) => {
      this._pendingHello = { resolve, reject };
      this.ws.send(JSON.stringify({ type: "hello", role: "guest", room: (code || "").toUpperCase(), name, clientId: this.clientId }));
    });
  },

  leave() {
    this._lastConnect = null;
    clearTimeout(this._reconnectTimer);
    this._reconnecting = false;
    if (this.ws) { try { this.ws.close(); } catch (e) { /* already gone */ } }
    this.enabled = false;
    this.isHost = false;
    this.locked = false;
    this.mySeat = 0;
    this.roomCode = null;
    this.roster = [];
    this.connectionLost = false;
  },

  lockRoom() {
    this.locked = true;
    if (this.enabled && this.isHost) this.send({ type: "lock" });
  },

  send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  },

  /* A dropped socket doesn't mean the game is over — it usually just
     means a phone browser got backgrounded (iOS is aggressive about
     killing background WebSockets) and came back a few seconds later.
     Retry with backoff, and retry immediately the moment the tab is
     visible again rather than waiting out whatever delay is pending. */
  _onClose() {
    if (!this.enabled || !this._lastConnect) return; /* a deliberate leave() already reset everything */
    this.connectionLost = true;
    this._fireRoster();
    this._scheduleReconnect(1000);
  },

  _scheduleReconnect(delayMs) {
    if (this._reconnecting) return;
    this._reconnecting = true;
    clearTimeout(this._reconnectTimer);
    this._reconnectTimer = setTimeout(() => this._attemptReconnect(delayMs), delayMs);
  },

  async _attemptReconnect(prevDelay) {
    this._reconnecting = false;
    if (!this.enabled || !this._lastConnect) return;
    const { role, name, relayUrl, room } = this._lastConnect;
    try {
      await this._connect(relayUrl);
      await new Promise((resolve, reject) => {
        this._pendingHello = { resolve, reject };
        this.ws.send(JSON.stringify({
          type: "hello", role, name, clientId: this.clientId,
          room: role === "guest" ? room : undefined
        }));
      });
      this.connectionLost = false;
      this._fireRoster();
    } catch (e) {
      this._scheduleReconnect(Math.min((prevDelay || 1000) * 1.6, 8000));
    }
  },

  /* ── the wire protocol ──────────────────── */
  _onMessage(ev) {
    let msg;
    try { msg = JSON.parse(ev.data); } catch (e) { return; }

    if (msg.type === "hello-ack") {
      this.enabled = true;
      this.isHost = this._role === "host";
      this.roomCode = msg.room;
      this.mySeat = msg.seat;
      this.roster = msg.roster;
      this.connectionLost = false;
      if (this._pendingHello) { this._pendingHello.resolve({ room: msg.room, seat: msg.seat }); this._pendingHello = null; }
      this._fireRoster();
      return;
    }

    if (msg.type === "error") {
      if (this._pendingHello) { this._pendingHello.reject(new Error(msg.reason)); this._pendingHello = null; }
      return;
    }

    if (msg.type === "roster") {
      const prev = this.roster || [];
      this.roster = msg.roster;
      /* someone reconnected mid-game — they missed every event since they
         dropped, so the fix is simple: just send them the whole world again */
      if (this.isHost && this.locked) {
        msg.roster.forEach((r) => {
          const before = prev.find((x) => x.seat === r.seat);
          if (r.seat !== 0 && r.connected && before && !before.connected) {
            this.send({ type: "bus", event: "state", payload: this.serializeState(MM.state), to: r.seat });
          }
        });
      }
      this._fireRoster();
      return;
    }

    /* replicated bus event — only a guest ever receives these, straight
       from the host's own MM.bus.emit calls */
    if (msg.type === "bus") {
      if (this.isHost) return;
      if (msg.event === "state") this.applyState(msg.payload);
      MM.bus.emit(msg.event, msg.payload);
      return;
    }

    /* a guest's intent, arriving at the host for real application */
    if (msg.type === "action") {
      if (this.isHost) this.applyRemoteAction(msg.from, msg.kind, msg.payload);
      return;
    }

    /* the host asking THIS seat to decide something */
    if (msg.type === "prompt") {
      const fn = this.PROMPTS[msg.kind];
      if (!fn) return;
      Promise.resolve(fn(MM.state, msg.payload)).then((value) =>
        this.send({ type: "decision", promptId: msg.promptId, value, to: 0 }));
      return;
    }

    /* a decision coming back from whichever seat we asked */
    if (msg.type === "decision") {
      const resolve = this._pending[msg.promptId];
      if (resolve) { delete this._pending[msg.promptId]; resolve(msg.value); }
      return;
    }

    /* a one-way heads-up — show something, no reply expected */
    if (msg.type === "tell") {
      const fn = this.ON_TELL[msg.kind];
      if (fn) fn(MM.state, msg.payload);
      return;
    }
  },

  /* ── state replication ──────────────────── */
  serializeState(s) {
    const { rng, ...rest } = s;
    return JSON.parse(JSON.stringify(rest));
  },

  applyState(payload) {
    const rng = (MM.state && MM.state.rng) || MM.createRng();
    MM.state = Object.assign({ rng }, payload);
  },

  scheduleStateSync() {
    if (this._stateTimer) return;
    this._stateTimer = setTimeout(() => {
      this._stateTimer = null;
      this.send({ type: "bus", event: "state", payload: this.serializeState(MM.state) });
    }, 30);
  },

  /* ── seat helpers used everywhere else ──── */
  myPlayer(s) { return (s && s.players.find((p) => p.id === this.mySeat)) || (s && s.players[0]); },
  isMine(p) { return !!p && p.id === this.mySeat; },

  /* ── an awaited decision, wherever the deciding seat actually is ── */
  ask(player, kind, payload, localFn) {
    if (this.isMine(player)) return localFn();
    return new Promise((resolve) => {
      const id = "p" + (++this._promptSeq);
      this._pending[id] = resolve;
      this.send({ type: "prompt", kind, payload, promptId: id, to: player.id });
    });
  },

  /* a one-way notice — a card face to show, an auction to watch */
  tell(kind, payload, opts) {
    if (!this.enabled) return;
    opts = opts || {};
    if (opts.to != null) { if (opts.to !== 0) this.send({ type: "tell", kind, payload, to: opts.to }); return; }
    this.roster.forEach((r) => {
      if (!r.connected || r.seat === 0) return;
      if (opts.exceptSeat != null && r.seat === opts.exceptSeat) return;
      this.send({ type: "tell", kind, payload, to: r.seat });
    });
  },

  /* ── a local UI intent: mine to apply, or the host's to hear about ── */
  act(kind, payload) {
    if (!this.enabled || this.isHost) {
      const s = MM.state;
      const me = this.myPlayer(s);
      const fn = this.HANDLERS[kind];
      return fn && fn(s, me, payload);
    }
    this.send({ type: "action", kind, payload, to: 0 });
    return undefined;
  },

  applyRemoteAction(fromSeat, kind, payload) {
    const s = MM.state;
    const player = MM.playerById(s, fromSeat);
    const fn = this.HANDLERS[kind];
    if (player && fn) fn(s, player, payload);
  },

  /* ── host-side: apply the intent behind an act() call ───────────
     every one of these is the exact call a local click already made
     before networking existed — this table is the only place that
     had to learn a seat might not be sitting at this keyboard */
  HANDLERS: {
    roll: (s, p) => { if (MM.currentPlayer(s) === p && s.phase === MM.PHASES.AWAIT_ROLL) MM.turn.roll(s); },
    skipTurn: (s, p) => { if (MM.currentPlayer(s) === p && s.phase === MM.PHASES.AWAIT_ROLL) MM.turn.skipTurn(s); },
    chat: (s, p, { text } = {}) => { if (text) MM.chat(s, p.name, String(text).slice(0, 120), p.hex); },
    resign: (s, p) => { if (s.phase !== MM.PHASES.LOBBY) MM.bankrupt(s, p, null, "resigned"); },
    build: (s, p, { i } = {}) => MM.prop.build(s, p, MM.BOARD[i]),
    sellHouse: (s, p, { i } = {}) => MM.prop.sellHouse(s, p, MM.BOARD[i]),
    mortgage: (s, p, { i } = {}) => MM.prop.mortgage(s, p, MM.BOARD[i]),
    unmortgage: (s, p, { i } = {}) => MM.prop.unmortgage(s, p, MM.BOARD[i]),
    buyStock: (s, p, { sym, qty } = {}) => MM.market.buy(s, p, sym, qty),
    sellStock: (s, p, { sym, qty } = {}) => MM.market.sell(s, p, sym, qty),
    /* a bot decides on the spot (returns a result act() can hand straight
       back to the composer); a human has to be asked, which takes a
       moment — that leg runs in the background and the outcome shows up
       in the log instead of resolving synchronously here */
    proposeTrade: (s, p, { partnerId, give, take } = {}) => {
      const partner = MM.playerById(s, partnerId);
      if (!partner) return { accept: false, reason: "they're not at the table anymore" };
      if (partner.bot) return MM.trades.proposeToBot(s, p, partner, give, take);
      MM.trades.proposeToHuman(s, p, partner, give, take);
      return undefined;
    }
  },

  /* ── guest-side: recreate the exact modal the host would've shown,
     just locally, and hand the click back over the wire ─────────── */
  PROMPTS: {
    buyOffer: (s, { tile }) => MM.deal.offer(s, MM.BOARD[tile], MM.net.myPlayer(s)),
    auctionBid: (s, { tile, bid, leaderId }) =>
      MM.deal.auctionBid(s, MM.BOARD[tile], bid, leaderId != null ? MM.playerById(s, leaderId) : null),
    tradeOffer: (s, { botId, tile, cash }) =>
      MM.deal.tradeOffer(s, MM.playerById(s, botId), MM.BOARD[tile], cash),
    humanTradeOffer: (s, { proposerId, give, take }) =>
      MM.deal.humanTradeOffer(s, MM.playerById(s, proposerId), give, take)
  },

  /* ── guest-side: cosmetic-only, nothing to send back ────────────── */
  ON_TELL: {
    showCard: (s, { kind, card }) => MM.deal.showCard(s, kind, card, MM.net.myPlayer(s)),
    auctionWatch: (s, { tile, price, leaderId }) =>
      MM.deal.auctionWatch(s, MM.BOARD[tile], price, leaderId != null ? MM.playerById(s, leaderId) : null)
  }
};

/* the host's half of bus replication: every mutation the engine makes
   already announces itself here, so this is the only hook needed to
   keep every connected guest's screen honest. `state` is coalesced —
   it fires after nearly every mutation, and a guest only ever needs
   the latest one, not a blow-by-blow of every intermediate value */
MM.bus.on("*", ({ type, payload }) => {
  if (!MM.net.enabled || !MM.net.isHost) return;
  if (type === "state") { MM.net.scheduleStateSync(); return; }
  MM.net.send({ type: "bus", event: type, payload });
});

/* a phone browser coming back to the foreground is exactly the moment
   worth reconnecting immediately, rather than waiting out whatever
   backoff delay happened to be pending when it was backgrounded */
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (!MM.net.enabled || !MM.net.connectionLost) return;
    clearTimeout(MM.net._reconnectTimer);
    MM.net._reconnecting = false;
    MM.net._scheduleReconnect(0);
  });
}
