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

    /* a game object exists from the lobby on, so the board has something to show */
    this.newGame("You");
    MM.screens.show("home");
  },

  newGame(nickname) {
    const s = MM.createGame({
      nickname: nickname || "You",
      settings: {
        players: +document.getElementById("set-players").value,
        startingCash: +document.getElementById("set-cash").value,
        volatility: document.getElementById("set-vol").value,
        botDelay: { casual: 1400, normal: 900, ruthless: 550 }[document.getElementById("set-skill").value]
      }
    });
    document.getElementById("room-link").value = "https://monomoney.io/" + s.room;
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

  /* ── table ──────────────────────────────── */
  bindTable() {
    ["set-players", "set-cash", "set-skill", "set-vol"].forEach((id) => {
      document.getElementById(id).addEventListener("change", () => {
        if (MM.state.phase !== MM.PHASES.LOBBY) return;
        this.newGame(MM.state.players[0].name);
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
      const s = MM.state;
      if (s.phase === MM.PHASES.LOBBY) return;
      MM.bankrupt(s, s.players[0], null, "resigned");
      MM.bus.emit("state", s);
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
      MM.chat(MM.state, MM.state.players[0].name, text, MM.state.players[0].hex);
      input.value = "";
      const bot = MM.state.players.filter((p) => p.bot && p.alive)[0];
      if (bot && MM.state.rng.chance(0.5)) {
        setTimeout(() => MM.chat(MM.state, bot.name, MM.state.rng.pick(MM.BOT_LINES.bigMoney), bot.hex), 900);
      }
    });
  },

  primary() {
    const s = MM.state;
    if (s.phase === MM.PHASES.LOBBY) return this.startGame();
    if (s.phase === MM.PHASES.GAME_OVER) return this.rematch();
    if (s.phase === MM.PHASES.AWAIT_ROLL && !MM.currentPlayer(s).bot) MM.turn.roll(s);
  },

  rematch() {
    this.newGame(MM.state.players[0].name);
    MM.screens.mode("lobby");
    this.syncAction();
  },

  startGame() {
    const s = MM.state;
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
    if (!s || s.phase === MM.PHASES.LOBBY) {
      btn.textContent = "Start Game";
      btn.disabled = false;
      return;
    }
    if (s.phase === MM.PHASES.GAME_OVER) {
      btn.textContent = "Play again";
      btn.disabled = false;
      return;
    }
    const p = MM.currentPlayer(s);
    if (s.phase === MM.PHASES.AWAIT_ROLL) {
      btn.textContent = p.bot ? `${p.name} is thinking…` : p.jailed ? "Roll for doubles" : "Roll the dice";
      btn.disabled = !!p.bot;
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
    MM.bus.on("dice", () => MM.sfx.dice());
    MM.bus.on("jailed", () => MM.sfx.jail());
    MM.bus.on("moved", () => MM.sfx.step());
    MM.bus.on("cash", (e) => MM.sfx.cash(e.amount > 0));

    MM.bus.on("pass-go", (p) => {
      if (p.bot && MM.state.rng.chance(0.35)) {
        MM.chat(MM.state, p.name, MM.state.rng.pick(MM.BOT_LINES.passGo), p.hex);
      }
    });

    MM.bus.on("turn", (p) => {
      if (p.bot && p.jailed && MM.state.rng.chance(0.4)) {
        MM.chat(MM.state, p.name, MM.state.rng.pick(MM.BOT_LINES.jail), p.hex);
      }
    });

    MM.bus.on("game-over", (winner) => {
      setTimeout(() => MM.screens.gameOverModal(winner), 500);
    });
  }
};

document.addEventListener("DOMContentLoaded", () => MM.app.boot());
