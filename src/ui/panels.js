/* ═══ side rails, chat and the market bar ═══ */
window.MM = window.MM || {};

const el = (sel) => document.querySelector(sel);

MM.panels = {
  init() {
    this.refs = {
      players: el("#player-list"),
      host: el("#host-card"),
      bots: el("#bot-list"),
      rules: el("#rules-list"),
      props: el("#prop-list"),
      status: el("#status-card"),
      ticker: el("#ticker-bar"),
      chat: el("#chat-feed"),
      room: el("#room-link")
    };

    MM.bus.on("state", () => this.renderAll());
    MM.bus.on("turn", () => this.renderPlayers());
    MM.bus.on("market", () => { this.renderMarket(); this.renderTicker(); });
    MM.bus.on("chat", (e) => this.pushChat(e));
    MM.bus.on("cash", (e) => this.cashPop(e));
    MM.net.onRoster(() => { this.renderBots(); this.renderPlayers(); MM.app.renderWaitRoom && MM.app.renderWaitRoom(); });
    /* MM.marketUI and MM.tradeUI mount themselves into #modal-body when
       they open — see their own openPopup()/open() — neither has a
       persistent panel anymore */
  },

  renderAll() {
    this.renderPlayers();
    this.renderHost();
    this.renderMarket();
    this.renderProps();
    this.renderTrades();
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

      /* a disconnected human seat isn't ignoring their turn — their
         browser just isn't reachable right now (a backgrounded phone
         tab is the common case) — say so instead of just going quiet */
      const netRow = MM.net.enabled && !p.bot ? MM.net.roster.find((r) => r.seat === p.id) : null;
      const offline = !!netRow && !netRow.connected;

      const sub = !p.alive ? "Bankrupt"
        : offline ? "Reconnecting…"
        : p.jailed ? "In prison"
        : holdings ? holdings
        : p.bot ? MM.PERSONALITIES.find((x) => x.id === p.personality).tag
        : MM.net.isMine(p) ? "That's you"
        : "A player";
      return `<div class="player-row ${turn ? "is-turn" : ""} ${p.alive ? "" : "is-out"} ${offline ? "is-offline" : ""}" style="--pcolor:${p.hex}">
        <div class="avatar" style="--pcolor:${p.hex}">${p.avatar}</div>
        <div>
          <div class="player-name">${p.name}${p.jailed ? ' <span class="player-tag">jail</span>' : ""}${offline ? ' <span class="player-tag player-tag--offline">offline</span>' : ""}</div>
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

  /* one row per seat 1-3 — a joined human replaces that seat's bot
     without touching its colour, so "seat 2 is teal" stays true whether
     a person or the Banker ends up sitting there */
  renderBots() {
    const s = MM.state;
    if (!this.refs.bots || !s) return;
    const netRoster = MM.net.enabled ? MM.net.roster : [];

    this.refs.bots.innerHTML = MM.PERSONALITIES.map((b, n) => {
      const seat = n + 1;
      const human = netRoster.find((r) => r.seat === seat);
      /* a joined person holds their seat regardless of the players
         dropdown — that setting only ever trims bots, never people */
      const seated = human ? true : seat < s.settings.players;

      if (human) {
        const meta = MM.SEAT_META[seat];
        return `<div class="bot-row">
          <div class="avatar" style="--pcolor:${meta.hex}">${meta.avatar}</div>
          <div><b>${human.name}</b><i>${human.connected ? "Joined" : "Reconnecting…"}</i></div>
        </div>`;
      }
      /* the bot's real name (from MM.PERSONALITIES) never shows up in
         the UI — a seated bot already has its randomised table name
         sitting in the game object; an unseated one has no player
         object yet, so it just reads as an empty seat */
      const seatedPlayer = seated ? s.players[seat] : null;
      const shownName = seatedPlayer ? seatedPlayer.name : `Seat ${seat + 1}`;
      return `<div class="bot-row" style="${seated ? "" : "opacity:.4"}">
        <div class="avatar" style="--pcolor:${b.color}">${b.avatar}</div>
        <div><b>${shownName}</b><i>${!seated ? "Not seated this game" : MM.net.enabled ? "Open — will play as a bot" : b.blurb}</i></div>
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
        ${log.upcoming.length ? `<div class="status-split">On the way</div>${log.upcoming.map(row).join("")}` : ""}
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
  renderTrades() { MM.tradeUI.render(); },

  /* a static bar, not a scrolling tape — every listing sits in its own
     spot the whole game, each with a small live line chart rather than
     just a number, using the exact same spark() the Market popup does
     so the two never draw the trend differently */
  renderTicker() {
    const s = MM.state;
    if (!s || !this.refs.ticker) return;
    this.refs.ticker.innerHTML = s.stocks.map((st) => {
      const chg = ((st.price - st.open) / st.open) * 100;
      const dir = chg >= 0 ? "up" : "down";
      return `
        <div class="ticker-stock" style="--scolor:${st.color}">
          <span class="ticker-sym">${st.sym}</span>
          <span class="ticker-px">$${st.price.toFixed(2)}</span>
          ${MM.marketUI.spark(st, 40, 18)}
          <span class="ticker-chg ${dir}">${chg >= 0 ? "▲" : "▼"} ${Math.abs(chg).toFixed(1)}%</span>
        </div>`;
    }).join("");
  },

  /* your deeds, with the controls to develop them */
  renderProps() {
    const s = MM.state;
    if (!s || !this.refs.props) return;

    const you = MM.net.myPlayer(s);
    const mine = MM.tilesOf(s, you.id).sort((a, b) => a.i - b.i);

    if (!mine.length) {
      this.refs.props.innerHTML = `<p class="empty-note">You don't own anything yet. Land on an unclaimed tile and the deed is offered to you.</p>`;
      return;
    }

    const canAct = MM.currentPlayer(s) === you && you.alive && s.phase === MM.PHASES.AWAIT_ROLL;
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

    const ACTIONS = { build: "build", sell: "sellHouse", mortgage: "mortgage", unmortgage: "unmortgage" };
    this.refs.props.querySelectorAll(".mini-btn").forEach((b) => {
      b.addEventListener("click", () => {
        MM.net.act(ACTIONS[b.dataset.act], { i: +b.dataset.i });
        this.renderProps();
      });
    });
  },

  /* ── feeds ──────────────────────────────── */
  /* the on-board event log is gone — MM.log()/s.log still record every
     event (bots, tests and anything else that reads game history still
     see it), there's just nothing rendering it on the table anymore */

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
