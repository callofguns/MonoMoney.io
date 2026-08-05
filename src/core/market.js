/* ═══════════════════════════════════════════
   The exchange
   Five listings, priced by three forces:
     · fundamentals — what's actually been built and bought
     · headlines    — random events and insider cards
     · flow         — the price impact of your own orders
   ═══════════════════════════════════════════ */
window.MM = window.MM || {};

MM.market = {
  HISTORY: 48,
  IMPACT: 0.0015,     /* price impact per share traded, capped below */
  MAX_IMPACT: 0.03,

  stock(s, sym) { return s.stocks.find((x) => x.sym === sym); },
  held(player, sym) { return player.portfolio[sym] || 0; },
  basis(player, sym) { return (player.basis && player.basis[sym]) || 0; },

  /* gain or loss against average cost — the Shark trades on this */
  unrealized(player, st) {
    const cost = this.basis(player, st.sym);
    return cost > 0 ? (st.price - cost) / cost : 0;
  },

  /* Seed a little prior history so the charts read as a market that was
     already running when you sat down, rather than a single dot. */
  init(s) {
    s.stocks.forEach((st) => {
      st.anchor = st.price;
      const past = [st.price];
      let v = st.price;
      for (let i = 0; i < 13; i++) {
        v = this.clamp(v - v * st.vol * s.rng.gauss() * 0.4);
        past.unshift(v);
      }
      st.history = past;
    });
  },

  /* ── what the board says a company is worth ─ */
  fundamentals(s) {
    let houses = 0, airports = 0, utilities = 0, cash = 0;
    MM.BOARD.forEach((t) => {
      if (s.ownership[t.i] === undefined) return;
      if (t.type === "airport") airports += 1;
      if (t.type === "utility") utilities += 1;
      houses += s.houses[t.i] || 0;
    });
    MM.livePlayers(s).forEach((p) => { cash += p.cash; });

    return {
      SKY: 1 + 0.07 * airports,
      VLT: 1 + 0.09 * utilities,
      BRK: 1 + 0.028 * houses,
      TCH: 1,
      AUR: 1 + Math.min(0.5, cash / 40000)
    };
  },

  /* ── one round of trading ───────────────── */
  tick(s) {
    const k = MM.VOLATILITY[s.settings.volatility] || 1;
    const fund = this.fundamentals(s);

    s.stocks.forEach((st) => {
      st.prev = st.price;
      st.anchor = st.base * (fund[st.sym] || 1);
      const pull = (st.anchor - st.price) * 0.08;
      const noise = st.price * st.vol * k * s.rng.gauss() * 0.5;
      st.price = this.clamp(st.price + pull + noise);
    });

    if (s.rng.chance(0.32 * k)) this.fireEvent(s);

    this.record(s);
    MM.bus.emit("market", s.stocks);
  },

  clamp(v) { return Math.max(5, Math.round(v * 100) / 100); },

  record(s) {
    s.stocks.forEach((st) => {
      st.history.push(st.price);
      if (st.history.length > this.HISTORY) st.history.shift();
    });
  },

  /* ── headlines ──────────────────────────── */
  fireEvent(s) {
    const e = s.rng.pick(MM.MARKET_EVENTS);
    if (e.all !== undefined) {
      s.stocks.forEach((st) => { st.price = this.clamp(st.price * (1 + e.all)); });
    } else {
      const st = this.stock(s, e.sym);
      st.price = this.clamp(st.price * (1 + e.pct));
    }
    const move = e.all !== undefined ? e.all : e.pct;
    s.headline = { text: e.head, sym: e.sym || "ALL", pct: move };
    MM.log(s, `📰 ${e.head} — <b>${e.sym || "the market"}</b> ${move > 0 ? "+" : ""}${Math.round(move * 100)}%`);
    MM.bus.emit("headline", s.headline);
  },

  /* a one-off move from a card or a board event */
  shock(s, sym, pct, why) {
    const st = this.stock(s, sym);
    if (!st) return;
    st.price = this.clamp(st.price * (1 + pct));
    if (why) {
      s.headline = { text: why, sym, pct };
      MM.bus.emit("headline", s.headline);
    }
    MM.bus.emit("market", s.stocks);
  },

  /* ── trading ────────────────────────────── */
  cost(s, sym, qty) { return Math.round(this.stock(s, sym).price * qty); },

  maxBuy(s, player, sym) { return Math.floor(player.cash / this.stock(s, sym).price); },

  buy(s, player, sym, qty) {
    const st = this.stock(s, sym);
    if (!st || qty <= 0) return false;
    const bill = this.cost(s, sym, qty);
    if (player.cash < bill) return false;

    const had = this.held(player, sym);
    MM.debit(s, player, bill, "shares");
    player.portfolio[sym] = had + qty;
    player.basis = player.basis || {};
    player.basis[sym] = (this.basis(player, sym) * had + bill) / (had + qty);
    st.price = this.clamp(st.price * (1 + Math.min(this.MAX_IMPACT, this.IMPACT * qty)));

    MM.log(s, `<b>${player.name}</b> bought <b>${qty}</b> ${sym} for <span class="money">${MM.money(bill)}</span>`, player);
    this.after(s);
    return true;
  },

  sell(s, player, sym, qty) {
    const st = this.stock(s, sym);
    const have = this.held(player, sym);
    if (!st || qty <= 0 || have < qty) return false;

    const proceeds = this.cost(s, sym, qty);
    MM.credit(s, player, proceeds, "shares");
    player.portfolio[sym] = have - qty;
    if (player.portfolio[sym] === 0 && player.basis) delete player.basis[sym];
    st.price = this.clamp(st.price * (1 - Math.min(this.MAX_IMPACT, this.IMPACT * qty)));

    MM.log(s, `<b>${player.name}</b> sold <b>${qty}</b> ${sym} for <span class="money">${MM.money(proceeds)}</span>`, player);
    this.after(s);
    return true;
  },

  after(s) {
    MM.bus.emit("market", s.stocks);
    MM.bus.emit("state", s);
  },

  /* ── dividends, paid on every lap ───────── */
  dividends(s, player) {
    if (!s.rules.dividends) return 0;
    let total = 0;
    s.stocks.forEach((st) => {
      const qty = this.held(player, st.sym);
      if (qty) total += Math.round(qty * st.price * st.yield);
    });
    if (total > 0) {
      MM.credit(s, player, total, "dividends");
      player.divTotal = (player.divTotal || 0) + total;
      MM.log(s, `<b>${player.name}</b> collected <span class="money">${MM.money(total)}</span> in dividends`, player);
    }
    return total;
  },

  /* ── board events that move a price ─────── */
  onBuild(s, tile) {
    const corp = tile.group ? MM.GROUPS[tile.group].corp : null;
    if (corp) this.shock(s, corp, 0.012);
  },

  onDeed(s, tile) {
    if (tile.type === "airport") this.shock(s, "SKY", 0.02);
    else if (tile.type === "utility") this.shock(s, "VLT", 0.025);
  },

  onBankrupt(s) { this.shock(s, "AUR", -0.05, "A player folds — Aurum Bank writes off the loans"); },

  /* ── raising cash: shares go before deeds ─ */
  liquidateFor(s, player, target) {
    let guard = 60;
    while (player.cash < target && guard-- > 0) {
      const holdings = s.stocks
        .filter((st) => this.held(player, st.sym) > 0)
        .sort((a, b) => a.yield - b.yield);          /* keep the income earners longest */
      if (!holdings.length) break;

      const st = holdings[0];
      const need = target - player.cash;
      const qty = Math.min(this.held(player, st.sym), Math.max(1, Math.ceil(need / st.price)));
      this.sell(s, player, st.sym, qty);
    }
    return player.cash;
  }
};
