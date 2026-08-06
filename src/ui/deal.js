/* ═══════════════════════════════════════════
   Everything the middle of the board asks you:
   buy this deed, read this card, beat this bid.
   Each method resolves a promise the turn engine awaits.
   ═══════════════════════════════════════════ */
window.MM = window.MM || {};

MM.deal = {
  init() {
    this.el = document.getElementById("deal");
    this.center = document.getElementById("board-center");
  },

  open(html) {
    this.el.innerHTML = html;
    this.el.hidden = false;
    this.center.classList.add("is-prompting");
  },

  hide() {
    if (!this.el) return;
    this.el.hidden = true;
    this.el.innerHTML = "";
    this.center.classList.remove("is-prompting");
  },

  /* ── the deed itself ────────────────────── */
  deed(s, tile) {
    const color = tile.group ? MM.GROUPS[tile.group].color : "#2f7df6";
    let rows;

    if (tile.type === "property") {
      const cost = MM.prop.houseCost(tile);
      rows = `
        <div class="deed-row"><span>Rent</span><b>${MM.money(tile.rent[0])}</b></div>
        <div class="deed-row"><span>With colour set</span><b>${MM.money(tile.rent[0] * 2)}</b></div>
        <div class="deed-row"><span>1 house</span><b>${MM.money(tile.rent[1])}</b></div>
        <div class="deed-row"><span>3 houses</span><b>${MM.money(tile.rent[3])}</b></div>
        <div class="deed-row"><span>Hotel</span><b>${MM.money(tile.rent[5])}</b></div>
        <div class="deed-row deed-row--foot"><span>House cost</span><b>${MM.money(cost)}</b></div>`;
    } else if (tile.type === "airport") {
      rows = MM.AIRPORT_RENT.slice(1).map((r, n) =>
        `<div class="deed-row"><span>${n + 1} airport${n ? "s" : ""}</span><b>${MM.money(r)}</b></div>`).join("");
    } else {
      rows = `
        <div class="deed-row"><span>One utility</span><b>4× the dice</b></div>
        <div class="deed-row"><span>Both utilities</span><b>10× the dice</b></div>`;
    }

    return `
      <div class="deed">
        <div class="deed-band" style="background:${color}">
          ${tile.group ? MM.GROUPS[tile.group].name : tile.type === "airport" ? "Airport" : "Utility"}
        </div>
        <h3 class="deed-name">${tile.name}</h3>
        <div class="deed-rows">${rows}</div>
      </div>`;
  },

  /* ── buy or pass ────────────────────────── */
  offer(s, tile, player) {
    return new Promise((resolve) => {
      this.open(`
        ${this.deed(s, tile)}
        <div class="deal-actions">
          <button class="btn btn--primary" data-deal="buy">Buy · ${MM.money(tile.price)}</button>
          <button class="btn btn--muted" data-deal="pass">${s.rules.auction ? "Auction it" : "Pass"}</button>
        </div>
        <p class="deal-note">You'd be left with ${MM.money(player.cash - tile.price)}</p>`);

      const done = (answer) => { this.hide(); resolve(answer); };
      this.el.querySelector('[data-deal="buy"]').addEventListener("click", () => done(true));
      this.el.querySelector('[data-deal="pass"]').addEventListener("click", () => done(false));
    });
  },

  /* ── a drawn card ───────────────────────── */
  showCard(s, kind, card, player) {
    const isSurprise = kind === "surprise";
    return new Promise((resolve) => {
      this.open(`
        <div class="card-face card-face--${kind}">
          <div class="card-kind">${isSurprise ? "Surprise" : "Treasure"}</div>
          <p class="card-text">${card.text}</p>
          <div class="card-mark">${isSurprise ? "?" : "★"}</div>
        </div>
        ${player.bot ? `<p class="deal-note">${player.name} drew this</p>`
                     : `<button class="btn btn--primary" data-deal="ok">Continue</button>`}`);

      /* gated the same way turn.js's own pacing is — a card that auto-
         dismisses shouldn't do it while a solo player has a popup open
         and isn't watching */
      let dismissed = false;
      const done = () => { dismissed = true; this.hide(); resolve(); };
      MM.turn.wait(player.bot ? 2200 : 6000).then(() => { if (!dismissed) done(); });
      const ok = this.el.querySelector('[data-deal="ok"]');
      if (ok) ok.addEventListener("click", done);
    });
  },

  /* ── auction ────────────────────────────── */
  auctionBid(s, tile, bid, leader) {
    return new Promise((resolve) => {
      this.open(`
        ${this.deed(s, tile)}
        <div class="auction-state">
          ${leader ? `<b style="color:${leader.hex}">${leader.name}</b> leads at ${MM.money(bid - Math.max(10, Math.round(tile.price * 0.1)))}`
                   : "No bids yet — the floor is yours"}
        </div>
        <div class="deal-actions">
          <button class="btn btn--primary" data-deal="bid">Bid ${MM.money(bid)}</button>
          <button class="btn btn--muted" data-deal="out">Drop out</button>
        </div>`);

      const done = (answer) => { this.hide(); resolve(answer); };
      this.el.querySelector('[data-deal="bid"]').addEventListener("click", () => done(true));
      this.el.querySelector('[data-deal="out"]').addEventListener("click", () => done(false));
    });
  },

  /* what you watch once you've dropped out, or while the bots think */
  auctionWatch(s, tile, price, leader) {
    this.open(`
      ${this.deed(s, tile)}
      <div class="auction-state">
        ${leader ? `<b style="color:${leader.hex}">${leader.name}</b> bids <span class="money">${MM.money(price)}</span>`
                 : "Waiting for the first bid"}
      </div>
      <p class="deal-note">Auction in progress</p>`);
  },

  /* ── a bot wants to buy one of your tiles ── */
  tradeOffer(s, bot, tile, cash) {
    return new Promise((resolve) => {
      this.open(`
        <div class="trade-ask">
          <div class="avatar" style="--pcolor:${bot.hex}">${bot.avatar}</div>
          <p><b style="color:${bot.hex}">${bot.name}</b> wants to buy this from you</p>
        </div>
        ${this.deed(s, tile)}
        <div class="deal-actions">
          <button class="btn btn--primary" data-deal="accept">Accept · ${MM.money(cash)}</button>
          <button class="btn btn--muted" data-deal="decline">Decline</button>
        </div>`);

      const done = (answer) => { this.hide(); resolve(answer); };
      this.el.querySelector('[data-deal="accept"]').addEventListener("click", () => done(true));
      this.el.querySelector('[data-deal="decline"]').addEventListener("click", () => done(false));
    });
  },

  /* ── another player wants to trade ─────────
     give/take are named from the PROPOSER's side (same as the Trades
     tab composer) — so from here, the one deciding, give is what
     they'd receive and take is what they'd have to hand over */
  humanTradeOffer(s, proposer, give, take) {
    const summarize = (bundle) => {
      const rows = [];
      if (bundle.cash) rows.push(`
        <div class="trade-item trade-item--plain">
          <span class="trade-item-name">💵 Cash</span>
          <span class="trade-item-price">${MM.money(bundle.cash)}</span>
        </div>`);
      (bundle.tiles || []).forEach((i) => {
        const t = MM.BOARD[i];
        const color = t.group ? MM.GROUPS[t.group].color : "#2f7df6";
        rows.push(`
          <div class="trade-item trade-item--plain">
            <span class="prop-swatch" style="background:${color}"></span>
            <span class="trade-item-name">${t.name}</span>
          </div>`);
      });
      Object.entries(bundle.shares || {}).forEach(([sym, qty]) => {
        if (!qty) return;
        const st = MM.market.stock(s, sym);
        rows.push(`
          <div class="trade-item trade-item--plain">
            <span class="stock-sym" style="--scolor:${st.color}">${sym}</span>
            <span class="trade-item-name">${qty} share${qty > 1 ? "s" : ""}</span>
          </div>`);
      });
      return rows.length ? rows.join("") : `<p class="empty-note empty-note--tight">Nothing</p>`;
    };

    return new Promise((resolve) => {
      this.open(`
        <div class="trade-ask">
          <div class="avatar" style="--pcolor:${proposer.hex}">${proposer.avatar}</div>
          <p><b style="color:${proposer.hex}">${proposer.name}</b> wants to trade</p>
        </div>
        <div class="trade-section">
          <h3 class="trade-section-title">You'd get</h3>
          <div class="trade-list trade-list--static">${summarize(give)}</div>
        </div>
        <div class="trade-section">
          <h3 class="trade-section-title">You'd give up</h3>
          <div class="trade-list trade-list--static">${summarize(take)}</div>
        </div>
        <div class="deal-actions">
          <button class="btn btn--primary" data-deal="accept">Accept</button>
          <button class="btn btn--muted" data-deal="decline">Decline</button>
        </div>`);

      const done = (answer) => { this.hide(); resolve(answer); };
      this.el.querySelector('[data-deal="accept"]').addEventListener("click", () => done(true));
      this.el.querySelector('[data-deal="decline"]').addEventListener("click", () => done(false));
    });
  }
};
