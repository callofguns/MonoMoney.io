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
      market: el("#market-panel"),
      props: el("#prop-list"),
      status: el("#status-card"),
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
    MM.marketUI.mount(this.refs.market);
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
      const deeds = MM.tilesOf(s, p.id).length;
      const sets = MM.prop.setsOwned(s, p.id).length;
      const shares = s.stocks.reduce((n, st) => n + MM.market.held(p, st.sym), 0);
      const holdings = deeds || shares
        ? [deeds ? `${deeds} deed${deeds > 1 ? "s" : ""}` : null,
           sets ? `${sets} set${sets > 1 ? "s" : ""}` : null,
           shares ? `${shares} share${shares > 1 ? "s" : ""}` : null].filter(Boolean).join(" · ")
        : null;

      const sub = !p.alive ? "Bankrupt"
        : p.jailed ? "In prison"
        : holdings ? holdings
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

  /* one row per release — green = playable, blue = being built */
  renderStatus() {
    if (!this.refs.status) return;

    const log = MM.changelog();
    const row = (r) => `
      <div class="status-row ${r.v === MM.VERSION ? "is-now" : ""}">
        <span class="status-dot ${r.status}"></span>
        <div>
          <span class="status-v">${r.v}</span>
          <span class="status-name">${r.name}</span>
        </div>
        <span class="status-tag">${r.v === MM.VERSION ? "you're here" : MM.STATUS_LABEL[r.status]}</span>
      </div>`;

    this.refs.status.innerHTML = `
      <h2 class="card-title card-title--center">Build status</h2>
      <div class="status-list">
        ${log.shipped.map(row).join("")}
        <div class="status-split">On the way</div>
        ${log.upcoming.map(row).join("")}
      </div>
      <button class="btn btn--muted btn--sm status-more" data-action="show-status">See the full list</button>`;

    this.refs.status.querySelector(".status-more")
      .addEventListener("click", () => MM.screens.statusModal());
  },

  renderRules() {
    const s = MM.state;
    if (!this.refs.rules) return;
    this.refs.rules.innerHTML = MM.RULE_DEFS.map((r) => `
      <div class="setting">
        <span class="setting-ico">${r.ico}</span>
        <div class="setting-body"><b>${r.name}</b><i>${r.desc}${r.since ? " · " + r.since : ""}</i></div>
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
  renderMarket() { MM.marketUI.render(); },

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

  /* your deeds, with the controls to develop them */
  renderProps() {
    const s = MM.state;
    if (!s || !this.refs.props) return;

    const you = s.players[0];
    const mine = MM.tilesOf(s, 0).sort((a, b) => a.i - b.i);

    if (!mine.length) {
      this.refs.props.innerHTML = `<p class="empty-note">You don't own anything yet. Land on an unclaimed tile and the deed is offered to you.</p>`;
      return;
    }

    const canAct = MM.currentPlayer(s) === you && you.alive &&
      !MM.turn.busy && s.phase === MM.PHASES.AWAIT_ROLL;
    const sets = MM.prop.setsOwned(s, you.id);

    const rows = mine.map((t) => {
      const color = t.group ? MM.GROUPS[t.group].color : "#2f7df6";
      const houses = s.houses[t.i] || 0;
      const mortgaged = !!s.mortgaged[t.i];

      let status;
      if (mortgaged) status = "Mortgaged";
      else if (houses === 5) status = "Hotel";
      else if (houses) status = `${houses} house${houses > 1 ? "s" : ""}`;
      else if (t.group && MM.prop.ownsFullSet(s, you.id, t.group)) status = "Set complete";
      else status = MM.money(MM.prop.rent(s, t, 7)) + " rent";

      const btn = (act, label, ok, title) =>
        `<button class="mini-btn" data-act="${act}" data-i="${t.i}" title="${title}" ${canAct && ok ? "" : "disabled"}>${label}</button>`;

      const controls = [
        t.type === "property"
          ? btn("build", "＋", MM.prop.canBuild(s, you, t), `Build for ${MM.money(MM.prop.houseCost(t))}`)
          : "",
        t.type === "property" && houses
          ? btn("sell", "－", MM.prop.canSellHouse(s, you, t), "Sell a building back to the bank")
          : "",
        mortgaged
          ? btn("unmortgage", "↺", MM.prop.canUnmortgage(s, you, t), `Lift for ${MM.money(MM.prop.unmortgageCost(t))}`)
          : btn("mortgage", "🏦", MM.prop.canMortgage(s, you, t), `Raise ${MM.money(t.price / 2)}`)
      ].join("");

      return `<div class="prop-row ${mortgaged ? "is-mortgaged" : ""}" style="--gcolor:${color}">
        <div class="prop-swatch"></div>
        <div class="prop-body">
          <b>${t.name}</b>
          <i>${status}</i>
        </div>
        <div class="prop-controls">${controls}</div>
      </div>`;
    }).join("");

    this.refs.props.innerHTML = `
      <div class="prop-summary">
        <span>${mine.length} deed${mine.length > 1 ? "s" : ""}</span>
        <span>${sets.length} set${sets.length === 1 ? "" : "s"}</span>
        <span>Net worth <b>${MM.money(MM.netWorth(s, you))}</b></span>
      </div>
      ${rows}
      ${canAct ? "" : `<p class="panel-note">Build, sell and mortgage on your own turn, before you roll.</p>`}`;

    this.refs.props.querySelectorAll(".mini-btn").forEach((b) => {
      b.addEventListener("click", () => {
        const tile = MM.BOARD[+b.dataset.i];
        const act = b.dataset.act;
        if (act === "build") MM.prop.build(s, you, tile);
        if (act === "sell") MM.prop.sellHouse(s, you, tile);
        if (act === "mortgage") MM.prop.mortgage(s, you, tile);
        if (act === "unmortgage") MM.prop.unmortgage(s, you, tile);
        this.renderProps();
      });
    });
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
