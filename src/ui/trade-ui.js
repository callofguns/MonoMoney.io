/* ═══════════════════════════════════════════
   The Trades tab: pick a partner — bot or another
   live player — build both sides of the table,
   propose. A bot decides for itself on the spot;
   a person gets asked, on their own screen, and
   the outcome lands in the log — see core/trades.js.
   This file only composes the bundles and shows
   what happened.
   ═══════════════════════════════════════════ */
window.MM = window.MM || {};

MM.tradeUI = {
  partnerId: null,
  give: null,
  take: null,
  flash: null,

  mount(el) {
    this.el = el;
  },

  reset(keepPartner) {
    this.give = MM.trades.emptyBundle();
    this.take = MM.trades.emptyBundle();
    if (!keepPartner) this.partnerId = null;
  },

  render() {
    const s = MM.state;
    if (!s || !this.el) return;
    if (!this.give) this.reset();

    const you = MM.net.myPlayer(s);
    /* every other live player is a partner now — a human seat included,
       not just the bots this tab started out only trading with */
    const partners = MM.livePlayers(s).filter((p) => p !== you);

    if (!you.alive) {
      this.el.innerHTML = `<p class="empty-note">You're out of the game.</p>`;
      return;
    }
    if (!partners.length) {
      this.el.innerHTML = `<p class="empty-note">No one left to trade with.</p>`;
      return;
    }

    if (this.partnerId != null && !partners.some((p) => p.id === this.partnerId)) this.reset();
    const partner = this.partnerId != null ? MM.playerById(s, this.partnerId) : null;

    const chips = partners.map((p) => `
      <button class="partner-chip ${p.id === this.partnerId ? "is-active" : ""}" data-partner="${p.id}" style="--pcolor:${p.hex}">
        <span class="avatar" style="--pcolor:${p.hex}">${p.avatar}</span>${p.name}
      </button>`).join("");

    /* MM.turn.busy only ever means anything on the browser actually
       running the engine — the phase check alone is what's networked,
       and it's already enough: nothing lets a trade through mid-roll */
    const yourTurn = MM.currentPlayer(s) === you && s.phase === MM.PHASES.AWAIT_ROLL;

    let body;
    if (partner) {
      body = `
        ${this.section(s, you, this.give, "give", "You offer")}
        ${this.section(s, partner, this.take, "take", `You want from ${partner.name}`)}
        <div class="trade-summary">
          <span>You give ≈ ${MM.money(MM.trades.marketValue(s, this.give))}</span>
          <span>You get ≈ ${MM.money(MM.trades.marketValue(s, this.take))}</span>
        </div>
        <div class="trade-actions">
          <button class="btn btn--primary btn--sm" data-trade-action="propose" ${yourTurn && this.canPropose(s, you, partner) ? "" : "disabled"}>Propose trade</button>
          <button class="btn btn--muted btn--sm" data-trade-action="clear">Clear</button>
        </div>
        ${!yourTurn ? `<p class="panel-note">Propose trades on your own turn, before you roll.</p>` : ""}
        ${this.flash ? `<p class="trade-result ${this.flash.ok ? "up" : "down"}">${this.flash.text}</p>` : ""}`;
    } else {
      body = `<p class="panel-note">Pick someone to trade with. Only bare tiles — nothing with houses on it — can go on the table.</p>`;
    }

    this.el.innerHTML = `<div class="partner-row">${chips}</div>${body}`;
    this.bind(s, you, partner);
  },

  canPropose(s, you, partner) {
    if (!partner) return false;
    if (MM.trades.bundleIsEmpty(this.give) && MM.trades.bundleIsEmpty(this.take)) return false;
    return MM.trades.canOffer(s, you, this.give) && MM.trades.canOffer(s, partner, this.take);
  },

  /* one side of the table — cash, deeds, shares belonging to `owner` */
  section(s, owner, bundle, key, title) {
    const tiles = MM.tilesOf(s, owner.id).filter((t) => !(s.houses[t.i] > 0));
    const held = s.stocks.filter((st) => MM.market.held(owner, st.sym) > 0);

    const tileRows = tiles.length ? tiles.map((t) => {
      const checked = bundle.tiles.includes(t.i);
      const color = t.group ? MM.GROUPS[t.group].color : "#2f7df6";
      return `
        <label class="trade-item">
          <input type="checkbox" data-tile="${t.i}" data-key="${key}" ${checked ? "checked" : ""} />
          <span class="prop-swatch" style="background:${color}"></span>
          <span class="trade-item-name">${t.name}${s.mortgaged[t.i] ? " · mortgaged" : ""}</span>
          <span class="trade-item-price">${MM.money(t.price)}</span>
        </label>`;
    }).join("") : `<p class="empty-note empty-note--tight">No tradeable deeds</p>`;

    const shareRows = held.map((st) => {
      const have = MM.market.held(owner, st.sym);
      const qty = bundle.shares[st.sym] || 0;
      return `
        <div class="trade-share-row">
          <span class="stock-sym" style="--scolor:${st.color}">${st.sym}</span>
          <span class="trade-share-held">of ${have}</span>
          <button class="mini-btn" data-share="-1" data-sym="${st.sym}" data-key="${key}" ${qty <= 0 ? "disabled" : ""}>−</button>
          <span class="qty-value qty-value--sm">${qty}</span>
          <button class="mini-btn" data-share="1" data-sym="${st.sym}" data-key="${key}" ${qty >= have ? "disabled" : ""}>＋</button>
        </div>`;
    }).join("");

    return `
      <div class="trade-section">
        <h3 class="trade-section-title">${title}</h3>
        <div class="trade-cash-row">
          <span>Cash</span>
          <button class="mini-btn" data-cash="-25" data-key="${key}">−</button>
          <input type="number" class="trade-cash-input" data-cash-input="${key}" min="0" max="${owner.cash}" step="25" value="${bundle.cash}" />
          <button class="mini-btn" data-cash="25" data-key="${key}">＋</button>
        </div>
        <div class="trade-list">${tileRows}</div>
        ${shareRows}
      </div>`;
  },

  bind(s, you, partner) {
    this.el.querySelectorAll("[data-partner]").forEach((b) =>
      b.addEventListener("click", () => {
        this.partnerId = +b.dataset.partner;
        this.reset(true);
        this.flash = null;
        this.render();
      }));

    if (!partner) return;

    this.el.querySelectorAll("[data-tile]").forEach((cb) =>
      cb.addEventListener("change", () => {
        const bundle = cb.dataset.key === "give" ? this.give : this.take;
        const i = +cb.dataset.tile;
        const at = bundle.tiles.indexOf(i);
        if (cb.checked && at < 0) bundle.tiles.push(i);
        if (!cb.checked && at >= 0) bundle.tiles.splice(at, 1);
        this.render();
      }));

    this.el.querySelectorAll("[data-share]").forEach((b) =>
      b.addEventListener("click", () => {
        const bundle = b.dataset.key === "give" ? this.give : this.take;
        const owner = b.dataset.key === "give" ? you : partner;
        const sym = b.dataset.sym;
        const have = MM.market.held(owner, sym);
        const next = Math.max(0, Math.min(have, (bundle.shares[sym] || 0) + (+b.dataset.share)));
        bundle.shares[sym] = next;
        this.render();
      }));

    this.el.querySelectorAll("[data-cash]").forEach((b) =>
      b.addEventListener("click", () => {
        const bundle = b.dataset.key === "give" ? this.give : this.take;
        const owner = b.dataset.key === "give" ? you : partner;
        bundle.cash = Math.max(0, Math.min(owner.cash, bundle.cash + (+b.dataset.cash)));
        this.render();
      }));

    this.el.querySelectorAll("[data-cash-input]").forEach((inp) =>
      inp.addEventListener("change", () => {
        const bundle = inp.dataset.cashInput === "give" ? this.give : this.take;
        const owner = inp.dataset.cashInput === "give" ? you : partner;
        bundle.cash = Math.max(0, Math.min(owner.cash, Math.round(+inp.value || 0)));
        this.render();
      }));

    const propose = this.el.querySelector('[data-trade-action="propose"]');
    if (propose) propose.addEventListener("click", () => {
      const result = MM.net.act("proposeTrade", { partnerId: partner.id, give: this.give, take: this.take });
      if (partner.bot) {
        /* a bot decides on the spot — networked and not the host, the
           result comes back through the log instead of landing here */
        if (result) this.flash = { ok: result.accept, text: result.accept ? "Deal! The trade went through." : `Declined — ${result.reason}` };
      } else {
        /* a person has to actually be asked — there's nothing to report
           yet, just confirmation the offer went out; the log carries
           whatever they decide, whenever they decide it */
        this.flash = { ok: true, text: `Offer sent to ${partner.name} — waiting for a response.` };
      }
      this.reset(true);
      this.render();
    });

    const clear = this.el.querySelector('[data-trade-action="clear"]');
    if (clear) clear.addEventListener("click", () => { this.reset(true); this.flash = null; this.render(); });
  }
};
