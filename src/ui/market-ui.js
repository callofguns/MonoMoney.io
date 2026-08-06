/* ═══════════════════════════════════════════
   The Market: a list of listings, and a trade
   panel for whichever one you open. Charts are
   inline SVG — one series each, so the line
   carries direction and the label carries the
   number; never colour alone.

   Lives as a popup rather than a fixed tab-panel
   — see MM.tradeUI for the same pattern and why.
   ═══════════════════════════════════════════ */
window.MM = window.MM || {};

MM.marketUI = {
  isOpen: false,
  open: null,      /* symbol currently expanded — unrelated to isOpen */
  qty: 1,

  mount(el) {
    this.el = el;
    MM.bus.on("headline", (h) => this.flash(h));
  },

  openPopup() {
    MM.screens.modal("Market", "");
    this.isOpen = true;
    this.qty = 1;
    this.mount(document.getElementById("modal-body"));
    this.render();
  },

  render() {
    if (!this.isOpen) return; /* nothing showing — no point building the HTML */
    const s = MM.state;
    if (!s || !this.el) return;
    this.el.innerHTML = this.open ? this.tradePanel(s, this.open) : this.list(s);
    this.bind(s);
  },

  /* ── list view ──────────────────────────── */
  list(s) {
    const you = MM.net.myPlayer(s);
    const rows = s.stocks.map((st) => {
      const chg = ((st.price - st.open) / st.open) * 100;
      const dir = chg >= 0 ? "up" : "down";
      const qty = MM.market.held(you, st.sym);
      return `
        <div class="stock-row-wrap">
          <button class="info-btn" data-info="${st.sym}" title="What moves ${st.sym}" aria-label="What moves ${st.sym}">ⓘ</button>
          <button class="stock-row stock-row--btn" data-sym="${st.sym}">
            <div class="stock-sym" style="--scolor:${st.color}">${st.sym}</div>
            <div class="stock-id">
              <div class="stock-name">${st.name}</div>
              <div class="stock-meta">${qty ? `You hold ${qty}` : `${st.sector} · ${(st.yield * 100).toFixed(0)}% yield`}</div>
            </div>
            ${this.spark(st, 64, 24)}
            <div class="stock-price">
              <b>$${st.price.toFixed(2)}</b>
              <span class="stock-chg ${dir}">${chg >= 0 ? "▲" : "▼"} ${Math.abs(chg).toFixed(1)}%</span>
            </div>
          </button>
        </div>`;
    }).join("");

    const worth = MM.portfolioValue(s, you);
    return `
      <div class="port-strip">
        <div><span>Cash</span><b>${MM.money(you.cash)}</b></div>
        <div><span>Holdings</span><b>${MM.money(worth)}</b></div>
        <div><span>Dividends</span><b class="up">${MM.money(you.divTotal || 0)}</b></div>
      </div>
      <div class="market-list">${rows}</div>
      <p class="panel-note">Dividends land every time you pass START. Building on the board lifts the company that owns the sector.</p>`;
  },

  /* ── one listing, with the trade controls ── */
  tradePanel(s, sym) {
    const st = MM.market.stock(s, sym);
    const you = MM.net.myPlayer(s);
    const qty = this.qty;
    const held = MM.market.held(you, sym);
    const chg = ((st.price - st.open) / st.open) * 100;
    const dir = chg >= 0 ? "up" : "down";
    const cost = MM.market.cost(s, sym, qty);
    const canBuy = you.cash >= cost && you.alive;
    const canSell = held >= qty && you.alive;
    const band = this.series(st);
    const lo = Math.min(...band);
    const hi = Math.max(...band);

    return `
      <div class="trade-head">
        <button class="mini-btn" data-back="1" title="Back to the market">←</button>
        <div class="stock-sym" style="--scolor:${st.color}">${st.sym}</div>
        <div class="stock-id">
          <div class="stock-name">${st.name}</div>
          <div class="stock-meta">${st.sector} · ${(st.yield * 100).toFixed(0)}% per lap</div>
        </div>
        <button class="info-btn" data-info="${st.sym}" title="What moves ${st.sym}" aria-label="What moves ${st.sym}">ⓘ</button>
      </div>

      <div class="trade-price">
        <b>$${st.price.toFixed(2)}</b>
        <span class="stock-chg ${dir}">${chg >= 0 ? "▲" : "▼"} ${Math.abs(chg).toFixed(2)}% today</span>
      </div>

      ${this.chart(st)}
      <div class="chart-scale"><span>low $${lo.toFixed(0)}</span><span>high $${hi.toFixed(0)}</span></div>

      <div class="trade-stats">
        <div><span>You hold</span><b>${held}</b></div>
        <div><span>Position</span><b>${MM.money(held * st.price)}</b></div>
        <div><span>Per lap</span><b class="up">${MM.money(Math.round(held * st.price * st.yield))}</b></div>
      </div>
      ${held ? this.pnl(s, you, st, held) : ""}

      <div class="qty-row">
        <button class="mini-btn" data-qty="-1">−</button>
        <span class="qty-value">${qty}</span>
        <button class="mini-btn" data-qty="1">＋</button>
        <button class="chip-btn" data-qty="5">+5</button>
      </div>

      <div class="trade-actions">
        <div class="trade-action-row">
          <button class="btn btn--primary btn--sm" data-trade="buy" ${canBuy ? "" : "disabled"}>Buy · ${MM.money(cost)}</button>
          <button class="chip-btn" data-qty="maxbuy" title="The most you can afford">Max</button>
        </div>
        <div class="trade-action-row">
          <button class="btn btn--muted btn--sm" data-trade="sell" ${canSell ? "" : "disabled"}>Sell · ${MM.money(cost)}</button>
          <button class="chip-btn" data-qty="maxsell" title="Everything you hold">Max</button>
        </div>
      </div>`;
  },

  /* what the position has actually done since you bought it */
  pnl(s, you, st, held) {
    const cost = MM.market.basis(you, st.sym);
    if (!cost) return "";
    const gain = (st.price - cost) * held;
    const pct = MM.market.unrealized(you, st) * 100;
    const dir = gain >= 0 ? "up" : "down";
    return `
      <div class="pnl-row">
        <span>Avg cost <b>$${cost.toFixed(2)}</b></span>
        <span class="${dir}">${gain >= 0 ? "+" : "−"}${MM.money(Math.abs(gain))} (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)</span>
      </div>`;
  },

  /* ── the ⓘ next to a stock: what moves it, in plain language ──
     Reads live off the actual data — market events, insider cards, the
     current volatility band — so this can never drift out of sync with
     what the exchange is actually doing. Only the "what is this company"
     blurb and its fundamental driver are hand-written, in src/data/rules.js. */
  infoModal(sym) {
    const s = MM.state;
    const st = MM.market.stock(s, sym);
    const meta = MM.STOCKS.find((x) => x.sym === sym);
    const volLabel = st.vol > 0.08 ? "High" : st.vol > 0.045 ? "Medium" : "Low";
    const volNote = st.vol > 0.08 ? "the most volatile listing on the exchange"
      : st.vol < 0.045 ? "one of the steadier listings"
      : "middling — not the calmest listing, not the wildest";

    const headlines = MM.MARKET_EVENTS.filter((e) => e.sym === sym);
    const wholeMarket = MM.MARKET_EVENTS.filter((e) => e.all !== undefined);
    const insider = [].concat(MM.DECKS.surprise, MM.DECKS.treasure)
      .filter((c) => c.insider && c.effect.sym === sym);

    const pct = (p) => `<span class="${p >= 0 ? "up" : "down"}">${p >= 0 ? "+" : ""}${Math.round(p * 100)}%</span>`;

    MM.screens.modal(`${meta.name} · ${sym}`, `
      <p>${meta.blurb}</p>
      <h3>The numbers</h3>
      <ul>
        <li><b>${meta.sector}</b> sector</li>
        <li><b>${(meta.yield * 100).toFixed(0)}%</b> of the share price, paid as a dividend every lap you pass START</li>
        <li><b>${volLabel} volatility</b> — ${volNote}</li>
      </ul>
      <h3>What moves the price</h3>
      <ul>
        <li>${meta.driver}</li>
        ${headlines.map((h) => `<li>Headline — "${h.head}" ${pct(h.pct)}</li>`).join("")}
        <li>Whole-market headlines — two events that move every listing together, ${wholeMarket.map((w) => pct(w.all)).join(" or ")}</li>
        ${insider.map((c) => `<li>Insider Surprise card <i>(the house rule for it)</i> — "${c.text}" ${pct(c.effect.pct)}</li>`).join("")}
        <li>Every order nudges the price up to 3% — a big trade, yours or a bot's, moves it further</li>
        <li>A little random drift every round, sized by its own volatility</li>
      </ul>`);
  },

  /* ── charts ─────────────────────────────── */
  /* history only records on round ticks, so pin the live price on the end —
     otherwise a mid-round shock shows in the number but not the line */
  series(st) {
    const hist = st.history.slice();
    if (hist[hist.length - 1] !== st.price) hist.push(st.price);
    return hist.length > 1 ? hist : [st.price, st.price];
  },

  points(hist, w, h, pad) {
    const lo = Math.min(...hist);
    const hi = Math.max(...hist);
    const span = hi - lo;
    const step = hist.length > 1 ? (w - pad * 2) / (hist.length - 1) : 0;
    /* a dead-flat series belongs on the midline, not the floor */
    return hist.map((v, i) => [
      pad + i * step,
      span === 0 ? h / 2 : pad + (1 - (v - lo) / span) * (h - pad * 2)
    ]);
  },

  spark(st, w, h) {
    const hist = this.series(st);
    const pts = this.points(hist, w, h, 3);
    const rising = hist[hist.length - 1] >= hist[0];
    const stroke = rising ? "var(--up)" : "var(--down)";
    const line = pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
    const last = pts[pts.length - 1];
    return `
      <svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
        <polyline points="${line}" fill="none" stroke="${stroke}" stroke-width="2"
                  stroke-linejoin="round" stroke-linecap="round" />
        <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.5" fill="${stroke}" />
      </svg>`;
  },

  chart(st) {
    const w = 300, h = 110;
    const hist = this.series(st);
    const pts = this.points(hist, w, h, 8);
    const rising = hist[hist.length - 1] >= hist[0];
    const stroke = rising ? "var(--up)" : "var(--down)";
    const line = pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
    const area = `${pts[0][0]},${h} ${line} ${pts[pts.length - 1][0]},${h}`;
    const last = pts[pts.length - 1];

    return `
      <svg class="chart" viewBox="0 0 ${w} ${h}" role="img"
           aria-label="${st.sym} price over the last ${hist.length} rounds">
        <line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" class="chart-grid" />
        <polygon points="${area}" fill="${stroke}" opacity=".12" />
        <polyline points="${line}" fill="none" stroke="${stroke}" stroke-width="2"
                  stroke-linejoin="round" stroke-linecap="round" />
        <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4" fill="${stroke}"
                stroke="var(--ink-600)" stroke-width="2" />
      </svg>`;
  },

  /* ── wiring ─────────────────────────────── */
  bind(s) {
    const you = MM.net.myPlayer(s);

    this.el.querySelectorAll("[data-sym]").forEach((row) =>
      row.addEventListener("click", () => { this.open = row.dataset.sym; this.qty = 1; this.render(); }));

    this.el.querySelectorAll("[data-info]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        this.infoModal(b.dataset.info);
      }));

    const back = this.el.querySelector("[data-back]");
    if (back) back.addEventListener("click", () => { this.open = null; this.render(); });

    /* "Max" used to be one button shared between Buy and Sell, set from
       maxBuy() alone — fine for buying, but it meant Max could hand you
       a quantity bigger than what you actually hold, silently disabling
       Sell instead of selling everything. Buy and Sell each get their
       own Max now, tied to what that specific action can actually do. */
    this.el.querySelectorAll("[data-qty]").forEach((b) =>
      b.addEventListener("click", () => {
        const v = b.dataset.qty;
        if (v === "maxbuy") this.qty = Math.max(1, MM.market.maxBuy(s, you, this.open));
        else if (v === "maxsell") this.qty = Math.max(1, MM.market.held(you, this.open));
        else this.qty = Math.max(1, this.qty + (+v));
        this.render();
      }));

    this.el.querySelectorAll("[data-trade]").forEach((b) =>
      b.addEventListener("click", () => {
        const sym = this.open;
        MM.net.act(b.dataset.trade === "buy" ? "buyStock" : "sellStock", { sym, qty: this.qty });
        this.render();
      }));
  },

  /* ── headline banner over the tape ──────── */
  flash(h) {
    const el = document.getElementById("market-flash");
    if (!el) return;
    el.innerHTML = `<b class="${h.pct >= 0 ? "up" : "down"}">${h.sym} ${h.pct >= 0 ? "+" : ""}${Math.round(h.pct * 100)}%</b> ${h.text}`;
    el.classList.add("is-live");
    clearTimeout(this._flash);
    this._flash = setTimeout(() => el.classList.remove("is-live"), 5200);
  }
};
