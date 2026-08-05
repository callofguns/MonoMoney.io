/* ═══ side rails, log, chat and the market tape ═══ */
window.MM = window.MM || {};

const el = (sel) => document.querySelector(sel);

MM.panels = {
  init() {
    this.refs = {
      players: el("#player-list"),
      host: el("#host-card"),
      bots: el("#bot-list"),
      rules: el("#rules-list"),
      market: el("#market-list"),
      props: el("#prop-list"),
      ticker: el("#ticker-track"),
      log: el("#log-feed"),
      chat: el("#chat-feed"),
      room: el("#room-link")
    };

    MM.bus.on("state", () => this.renderAll());
    MM.bus.on("turn", () => this.renderPlayers());
    MM.bus.on("market", () => { this.renderMarket(); this.renderTicker(); });
    MM.bus.on("log", (e) => this.pushLog(e));
    MM.bus.on("chat", (e) => this.pushChat(e));
    MM.bus.on("cash", (e) => this.cashPop(e));
  },

  renderAll() {
    this.renderPlayers();
    this.renderHost();
    this.renderMarket();
    this.renderProps();
  },

  /* ── players ────────────────────────────── */
  renderPlayers() {
    const s = MM.state;
    if (!s || !this.refs.players) return;
    this.refs.players.innerHTML = s.players.map((p) => {
      const turn = MM.currentPlayer(s) === p && s.phase !== MM.PHASES.LOBBY;
      const delta = p.lastDelta
        ? `<span class="player-delta ${p.lastDelta > 0 ? "up" : "down"}">${p.lastDelta > 0 ? "+" : "−"}${MM.money(Math.abs(p.lastDelta))}</span>`
        : "";
      const sub = p.jailed ? "In prison"
        : !p.alive ? "Bankrupt"
        : p.bot ? MM.PERSONALITIES.find((x) => x.id === p.personality).tag
        : "That's you";
      return `<div class="player-row ${turn ? "is-turn" : ""} ${p.alive ? "" : "is-out"}" style="--pcolor:${p.hex}">
        <div class="avatar" style="--pcolor:${p.hex}">${p.avatar}</div>
        <div>
          <div class="player-name">${p.name}${p.jailed ? ' <span class="player-tag">jail</span>' : ""}</div>
          <div class="player-sub">${sub}</div>
        </div>
        <div class="player-cash"><b>${MM.money(p.cash)}</b>${delta}</div>
      </div>`;
    }).join("");
  },

  renderHost() {
    const s = MM.state;
    if (!s || !this.refs.host) return;
    const p = s.players[0];
    this.refs.host.innerHTML = `
      <div class="avatar avatar--lg" style="--pcolor:${p.hex}">${p.avatar}</div>
      <div><div class="player-name">${p.name}</div><div class="player-sub">Ready to play</div></div>
      <span class="host-badge">HOST</span>`;
  },

  renderBots() {
    const s = MM.state;
    if (!this.refs.bots) return;
    this.refs.bots.innerHTML = MM.PERSONALITIES.map((b, n) => {
      const seated = n < s.settings.players - 1;
      return `<div class="bot-row" style="${seated ? "" : "opacity:.4"}">
        <div class="avatar" style="--pcolor:${b.color}">${b.avatar}</div>
        <div><b>${b.name}</b><i>${seated ? b.blurb : "Not seated this game"}</i></div>
      </div>`;
    }).join("");
  },

  renderRules() {
    const s = MM.state;
    if (!this.refs.rules) return;
    this.refs.rules.innerHTML = MM.RULE_DEFS.map((r) => `
      <div class="setting">
        <span class="setting-ico">${r.ico}</span>
        <div class="setting-body"><b>${r.name}</b><i>${r.desc}${r.phase > 1 ? " · phase " + r.phase : ""}</i></div>
        <button class="switch" role="switch" data-rule="${r.id}" aria-checked="${s.rules[r.id]}" aria-label="${r.name}"></button>
      </div>`).join("");

    this.refs.rules.querySelectorAll(".switch").forEach((sw) => {
      sw.addEventListener("click", () => {
        const on = sw.getAttribute("aria-checked") !== "true";
        sw.setAttribute("aria-checked", on);
        MM.state.rules[sw.dataset.rule] = on;
      });
    });
  },

  /* ── market ─────────────────────────────── */
  renderMarket() {
    const s = MM.state;
    if (!s || !this.refs.market) return;
    this.refs.market.innerHTML = s.stocks.map((st) => {
      const chg = ((st.price - st.open) / st.open) * 100;
      const dir = chg >= 0 ? "up" : "down";
      return `<div class="stock-row">
        <div class="stock-sym" style="--scolor:${st.color}">${st.sym}</div>
        <div>
          <div class="stock-name">${st.name}</div>
          <div class="stock-meta">${st.sector} · ${(st.yield * 100).toFixed(0)}% yield</div>
        </div>
        <div class="stock-price">
          <b>$${st.price.toFixed(2)}</b>
          <span class="stock-chg ${dir}">${chg >= 0 ? "▲" : "▼"} ${Math.abs(chg).toFixed(1)}%</span>
        </div>
      </div>`;
    }).join("");
  },

  renderTicker() {
    const s = MM.state;
    if (!s || !this.refs.ticker) return;
    const loop = s.stocks.concat(s.stocks, s.stocks, s.stocks);
    const items = loop.map((st) => {
      const chg = ((st.price - st.open) / st.open) * 100;
      return `<span class="tape-item">
        <span class="sym">${st.sym}</span>
        <span class="px">$${st.price.toFixed(2)}</span>
        <span class="chg ${chg >= 0 ? "up" : "down"}">${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%</span>
      </span>`;
    }).join("");
    this.refs.ticker.innerHTML = items;
  },

  renderProps() {
    const s = MM.state;
    if (!s || !this.refs.props) return;
    const mine = MM.tilesOf(s, 0);
    if (!mine.length) {
      this.refs.props.innerHTML = `<p class="empty-note">You don't own anything yet. Land on an unclaimed tile to buy it — purchases open in Phase 2.</p>`;
      return;
    }
    this.refs.props.innerHTML = mine.map((t) => {
      const color = t.group ? MM.GROUPS[t.group].color : "#7c4dff";
      return `<div class="prop-row" style="--gcolor:${color}">
        <div class="prop-swatch"></div>
        <div>${t.name}</div>
        <div class="prop-rent">${MM.money(t.price)}</div>
      </div>`;
    }).join("");
  },

  /* ── feeds ──────────────────────────────── */
  pushLog(entry) {
    const box = this.refs.log;
    if (!box) return;
    const line = document.createElement("div");
    line.className = "log-line";
    if (entry.hex) line.style.setProperty("--pcolor", entry.hex);
    else line.classList.add("log-line--sys");
    line.innerHTML = entry.html;
    box.prepend(line);
    while (box.children.length > 14) box.lastChild.remove();
  },

  pushChat(entry) {
    const box = this.refs.chat;
    if (!box) return;
    const empty = box.querySelector(".chat-empty");
    if (empty) empty.remove();
    const msg = document.createElement("p");
    msg.className = "chat-msg";
    msg.style.setProperty("--pcolor", entry.hex);
    msg.innerHTML = `<b>${entry.name}</b> ${entry.text.replace(/[<>]/g, "")}`;
    box.append(msg);
    box.scrollTop = box.scrollHeight;
  },

  /* floating +$/-$ over the player's token */
  cashPop({ player, amount }) {
    if (!amount || !MM.renderer.L) return;
    const wrap = document.getElementById("board-wrap");
    const canvas = document.getElementById("board");
    const cb = canvas.getBoundingClientRect();
    const wb = wrap.getBoundingClientRect();
    const a = MM.geom.anchor(player.pos, MM.renderer.L, player.jailed);

    const pop = document.createElement("div");
    pop.className = "cash-pop " + (amount > 0 ? "up" : "down");
    pop.textContent = (amount > 0 ? "+" : "−") + MM.money(Math.abs(amount));
    pop.style.left = cb.left - wb.left + a.x + "px";
    pop.style.top = cb.top - wb.top + a.y - 18 + "px";
    wrap.appendChild(pop);
    setTimeout(() => pop.remove(), 1200);

    clearTimeout(this._deltaTimer);
    this._deltaTimer = setTimeout(() => {
      MM.state.players.forEach((p) => (p.lastDelta = 0));
      this.renderPlayers();
    }, 2600);
  }
};
