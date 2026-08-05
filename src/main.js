/* ═══════════════════════════════════════════
   Bootstrap · wires the DOM to the engine
   ═══════════════════════════════════════════ */
window.MM = window.MM || {};

/* ── tiny synth so the table isn't silent (no asset files) ── */
MM.sfx = {
  on: true,
  ctx: null,
  ensure() {
    if (!this.ctx && window.AudioContext) this.ctx = new AudioContext();
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  },
  blip(freq, dur, type, vol) {
    if (!this.on) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || "triangle";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol || 0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  },
  dice() { for (let n = 0; n < 4; n++) setTimeout(() => this.blip(180 + Math.random() * 220, 0.07, "square", 0.03), n * 90); },
  step() { this.blip(520, 0.05, "sine", 0.025); },
  cash(up) { this.blip(up ? 780 : 220, 0.16, "triangle", 0.05); },
  jail() { this.blip(140, 0.4, "sawtooth", 0.05); }
};

MM.app = {
  boot() {
    MM.net.init();
    MM.screens.init();
    MM.panels.init();
    MM.diceUI.init(document.getElementById("dice-tray"));
    MM.deal.init();
    MM.renderer.init(
      document.getElementById("board"),
      document.getElementById("board-wrap"),
      document.getElementById("board-center")
    );

    this.action = document.getElementById("primary-action");
    document.querySelectorAll(".ver-chip").forEach((c) => (c.textContent = MM.VERSION));
    this.bindHome();
    this.bindTable();
    this.bindBus();
    this.bindFriends();

    const relayField = document.getElementById("relay-url");
    if (relayField) relayField.value = MM.net.relayUrl || "";

    /* a game object exists from the lobby on, so the board has something to show */
    this.newGame("You");
    MM.screens.show("home");

    /* an invite link carries ?room=CODE — hand it straight to the join form */
    const invited = new URLSearchParams(location.search).get("room");
    if (invited) {
      document.getElementById("friends-panel").hidden = false;
      this.setFriendsTab("join");
      document.getElementById("join-code").value = invited.toUpperCase();
    }
  },

  /* re-run whenever a setting changes in the lobby, or a guest's roster
     changes — `humans` is undefined (solo, seat 0 = the nickname you
     typed) unless a room is live, in which case it's every connected
     seat, host included */
  newGame(nickname) {
    const humans = MM.net.enabled
      ? MM.net.roster.filter((r) => r.connected).map((r) => ({ seat: r.seat, name: r.name }))
      : undefined;
    const wantPlayers = +document.getElementById("set-players").value;
    const settingsPlayers = humans ? Math.max(wantPlayers, humans.length) : wantPlayers;

    const s = MM.createGame({
      nickname: nickname || "You",
      humans,
      settings: {
        players: settingsPlayers,
        startingCash: +document.getElementById("set-cash").value,
        volatility: document.getElementById("set-vol").value,
        botDelay: { casual: 1900, normal: 1300, ruthless: 800 }[document.getElementById("set-skill").value]
      }
    });
    document.getElementById("room-link").value = MM.net.enabled
      ? location.origin + location.pathname + "?room=" + MM.net.roomCode
      : "https://monomoney.io/" + s.room;
    MM.panels.renderRules();
    MM.panels.renderBots();
    MM.panels.renderStatus();
    MM.panels.renderAll();
    MM.panels.renderTicker();
    MM.renderer.invalidate();
    this.syncAction();
    return s;
  },

  /* ── home ───────────────────────────────── */
  bindHome() {
    document.getElementById("join-form").addEventListener("submit", (e) => {
      e.preventDefault();
      this.enterLobby();
    });

    document.querySelector('[data-action="quick-3"]').addEventListener("click", () => {
      document.getElementById("set-players").value = "4";
      this.enterLobby();
    });
    document.querySelector('[data-action="quick-1"]').addEventListener("click", () => {
      document.getElementById("set-players").value = "2";
      this.enterLobby();
    });

    document.querySelectorAll('[data-action="show-rules"]').forEach((b) =>
      b.addEventListener("click", () => MM.screens.rulesModal()));
    document.querySelectorAll('[data-action="show-market-intro"]').forEach((b) =>
      b.addEventListener("click", () => MM.screens.marketModal()));
    document.querySelectorAll('[data-action="show-status"]').forEach((b) =>
      b.addEventListener("click", () => MM.screens.statusModal()));
    document.querySelectorAll('[data-action="toggle-sound"]').forEach((b) =>
      b.addEventListener("click", () => {
        MM.sfx.on = !MM.sfx.on;
        document.querySelectorAll('[data-action="toggle-sound"]').forEach((x) => {
          x.textContent = MM.sfx.on ? "🔊" : "🔇";
        });
        if (MM.sfx.on) MM.sfx.blip(660, 0.1);
      }));
  },

  enterLobby() {
    const nick = (document.getElementById("nickname").value || "").trim().slice(0, 14);
    this.newGame(nick || "You");
    MM.screens.mode("lobby");
    MM.screens.show("table");
    MM.sfx.ensure();

    clearInterval(this.lobbyTape);
    this.lobbyTape = setInterval(() => {
      if (MM.state.phase === MM.PHASES.LOBBY) MM.driftMarket(MM.state);
      else clearInterval(this.lobbyTape);
    }, 4500);
  },

  /* ── play with friends ──────────────────── */
  bindFriends() {
    const panel = document.getElementById("friends-panel");

    document.getElementById("friends-toggle").addEventListener("click", () => {
      panel.hidden = !panel.hidden;
    });

    panel.querySelectorAll("[data-friends-tab]").forEach((t) =>
      t.addEventListener("click", () => this.setFriendsTab(t.dataset.friendsTab)));

    document.querySelector('[data-action="create-room"]').addEventListener("click", () => this.createRoom());
    document.querySelector('[data-action="join-room"]').addEventListener("click", () => this.joinRoomFlow());
    document.querySelector('[data-action="leave-room"]').addEventListener("click", () => this.leaveRoom());

    MM.net.onRoster(() => {
      /* the host's own placeholder game reflects the live headcount —
         a joined 4th seat should never sit dim as "not seated" because
         the dropdown still says 2 */
      if (MM.net.enabled && MM.net.isHost && MM.state && MM.state.phase === MM.PHASES.LOBBY) {
        this.newGame(MM.net.myPlayer(MM.state).name);
      }
      this.renderWaitRoom();
    });
  },

  setFriendsTab(name) {
    document.querySelectorAll("[data-friends-tab]").forEach((t) => t.classList.toggle("is-active", t.dataset.friendsTab === name));
    document.querySelectorAll("[data-friends-pane]").forEach((p) => (p.hidden = p.dataset.friendsPane !== name));
  },

  showFriendsError(msg) {
    const el = document.getElementById("friends-error");
    el.textContent = msg;
    el.hidden = false;
  },
  clearFriendsError() {
    document.getElementById("friends-error").hidden = true;
  },

  async createRoom() {
    const nick = (document.getElementById("nickname").value || "").trim().slice(0, 14) || "Host";
    const relay = document.getElementById("relay-url").value.trim();
    this.clearFriendsError();
    try {
      await MM.net.hostRoom(nick, relay);
    } catch (e) {
      this.showFriendsError(e.message);
      return;
    }
    this.enterLobby();
  },

  async joinRoomFlow() {
    const nick = (document.getElementById("nickname").value || "").trim().slice(0, 14) || "Player";
    const relay = document.getElementById("relay-url").value.trim();
    const code = (document.getElementById("join-code").value || "").trim().toUpperCase();
    this.clearFriendsError();
    if (!code) return this.showFriendsError("Enter the room code you were sent.");
    try {
      await MM.net.joinRoom(code, nick, relay);
    } catch (e) {
      this.showFriendsError(
        e.message === "room-not-found" ? "No room with that code — check it and try again."
        : e.message === "already-started" ? "That game already started."
        : e.message === "room-full" ? "That room is full."
        : e.message
      );
      return;
    }
    this.enterGuestWait();
  },

  leaveRoom() {
    MM.net.leave();
    clearInterval(this.lobbyTape);
    this.newGame("You");
    MM.screens.show("home");
  },

  /* a guest sits here from the moment they join until the host actually
     starts the game — no settings to see or touch, just who's at the
     table so far */
  enterGuestWait() {
    MM.screens.mode("guest-wait");
    MM.screens.show("table");
    MM.sfx.ensure();
    this.renderWaitRoom();
    this.syncAction();

    if (this._offWaitWatch) this._offWaitWatch();
    this._offWaitWatch = MM.bus.on("state", () => {
      if (!MM.state || MM.state.phase === MM.PHASES.LOBBY) return;
      this._offWaitWatch();
      this._offWaitWatch = null;
      MM.screens.mode("game");
      MM.renderer.resize();
      MM.panels.renderAll();
      MM.panels.renderTicker();
    });
  },

  renderWaitRoom() {
    if (!MM.net.enabled || MM.net.isHost) return;
    const codeEl = document.getElementById("wait-room-code");
    if (codeEl) codeEl.textContent = MM.net.roomCode || "—";

    const box = document.getElementById("wait-roster");
    if (!box) return;
    box.innerHTML = MM.net.roster.map((r) => `
      <div class="bot-row">
        <div class="avatar" style="--pcolor:${(MM.SEAT_META[r.seat] || MM.SEAT_META[0]).hex}">
          ${r.seat === MM.net.mySeat ? "😀" : (MM.SEAT_META[r.seat] || MM.SEAT_META[0]).avatar}
        </div>
        <div><b>${r.name}${r.seat === MM.net.mySeat ? " (you)" : ""}</b><i>${r.connected ? (r.seat === 0 ? "Host" : "Joined") : "Reconnecting…"}</i></div>
      </div>`).join("");
  },

  /* ── table ──────────────────────────────── */
  bindTable() {
    ["set-players", "set-cash", "set-skill", "set-vol"].forEach((id) => {
      document.getElementById(id).addEventListener("change", () => {
        if (MM.state.phase !== MM.PHASES.LOBBY) return;
        if (MM.net.enabled && !MM.net.isHost) return;
        this.newGame(MM.net.myPlayer(MM.state).name);
      });
    });

    this.action.addEventListener("click", () => this.primary());

    document.addEventListener("keydown", (e) => {
      if (e.target.matches("input, select, textarea")) return;
      if (e.code === "Space" || e.code === "Enter") {
        if (!this.action.disabled && MM.state && MM.state.phase !== MM.PHASES.LOBBY) {
          e.preventDefault();
          this.primary();
        }
      }
    });

    document.querySelector('[data-action="copy-link"]').addEventListener("click", (e) => {
      const field = document.getElementById("room-link");
      navigator.clipboard && navigator.clipboard.writeText(field.value);
      e.target.textContent = "Copied";
      setTimeout(() => (e.target.textContent = "Copy"), 1400);
    });

    document.querySelector('[data-action="bankrupt"]').addEventListener("click", () => {
      if (MM.state.phase === MM.PHASES.LOBBY) return;
      MM.net.act("resign");
    });

    document.querySelector('[data-action="show-dashboard"]').addEventListener("click", () => MM.dashboardUI.open());

    /* the game-over modal's own button is content, not a fixed control —
       catch it by delegation since the modal body is rebuilt each time */
    document.addEventListener("click", (e) => {
      if (e.target.closest('[data-action="rematch"]')) {
        this.rematch();
        MM.screens.closeModal();
      }
    });

    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("is-active", t === tab));
        document.querySelectorAll(".tab-panel").forEach((p) =>
          p.classList.toggle("is-active", p.dataset.panel === tab.dataset.tab));
      });
    });

    document.getElementById("chat-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById("chat-input");
      const text = input.value.trim();
      if (!text) return;
      MM.net.act("chat", { text });
      input.value = "";
      if (!MM.net.enabled || MM.net.isHost) {
        const bot = MM.state.players.filter((p) => p.bot && p.alive)[0];
        if (bot && MM.state.rng.chance(0.5)) {
          setTimeout(() => MM.chat(MM.state, bot.name, MM.state.rng.pick(MM.BOT_LINES.bigMoney), bot.hex), 900);
        }
      }
    });
  },

  primary() {
    const s = MM.state;
    if (s.phase === MM.PHASES.LOBBY) return this.startGame();
    if (s.phase === MM.PHASES.GAME_OVER) return this.rematch();
    if (s.phase === MM.PHASES.AWAIT_ROLL && MM.net.isMine(MM.currentPlayer(s))) MM.net.act("roll");
  },

  rematch() {
    if (MM.net.enabled && !MM.net.isHost) return; /* only the host restarts the table */
    this.newGame(MM.net.myPlayer(MM.state).name);
    MM.screens.mode("lobby");
    this.syncAction();
  },

  startGame() {
    if (MM.net.enabled && !MM.net.isHost) return;
    const s = MM.state;
    MM.net.lockRoom();
    MM.screens.mode("game");
    MM.renderer.resize();
    s.players.filter((p) => p.bot).forEach((p, n) => {
      setTimeout(() => MM.chat(s, p.name, s.rng.pick(MM.BOT_LINES.greet), p.hex), 500 + n * 700);
    });
    MM.turn.begin(s);
  },

  /* ── button label follows the machine ───── */
  syncAction() {
    const s = MM.state;
    const btn = this.action;
    const waitingForHost = MM.net.enabled && !MM.net.isHost;

    if (!s || s.phase === MM.PHASES.LOBBY) {
      btn.textContent = waitingForHost ? "Waiting for host to start…" : "Start Game";
      btn.disabled = waitingForHost;
      return;
    }
    if (s.phase === MM.PHASES.GAME_OVER) {
      btn.textContent = waitingForHost ? "Waiting for host…" : "Play again";
      btn.disabled = waitingForHost;
      return;
    }
    const p = MM.currentPlayer(s);
    if (s.phase === MM.PHASES.AWAIT_ROLL) {
      const mine = MM.net.isMine(p);
      btn.textContent = p.bot ? `${p.name} is thinking…` : mine ? (p.jailed ? "Roll for doubles" : "Roll the dice") : `Waiting for ${p.name}…`;
      btn.disabled = !mine;
    } else {
      btn.textContent = s.phase === MM.PHASES.ROLLING ? "Rolling…"
        : s.phase === MM.PHASES.MOVING ? "Moving…"
        : s.phase === MM.PHASES.DECIDING ? "Your move…"
        : "…";
      btn.disabled = true;
    }
  },

  bindBus() {
    MM.bus.on("phase", () => this.syncAction());
    MM.bus.on("turn", () => this.syncAction());
    /* on a guest, "turn"/"phase" can arrive slightly before the debounced
       "state" sync that actually replaces MM.state — this is the backstop
       that leaves the button reading correctly no matter the order */
    MM.bus.on("state", () => this.syncAction());
    MM.bus.on("dice", () => MM.sfx.dice());
    MM.bus.on("jailed", () => MM.sfx.jail());
    MM.bus.on("moved", () => MM.sfx.step());
    MM.bus.on("cash", (e) => MM.sfx.cash(e.amount > 0));

    /* these two mutate state.chat directly, so only the browser actually
       running the engine may act on them — on a guest they'd just be a
       chat line nobody else's screen ever sees */
    MM.bus.on("pass-go", (p) => {
      if ((MM.net.enabled && !MM.net.isHost) || !p.bot) return;
      if (MM.state.rng.chance(0.35)) MM.chat(MM.state, p.name, MM.state.rng.pick(MM.BOT_LINES.passGo), p.hex);
    });

    MM.bus.on("turn", (p) => {
      if ((MM.net.enabled && !MM.net.isHost) || !p.bot || !p.jailed) return;
      if (MM.state.rng.chance(0.4)) MM.chat(MM.state, p.name, MM.state.rng.pick(MM.BOT_LINES.jail), p.hex);
    });

    MM.bus.on("game-over", (winner) => {
      setTimeout(() => MM.screens.gameOverModal(winner), 500);
    });
  }
};

document.addEventListener("DOMContentLoaded", () => MM.app.boot());
