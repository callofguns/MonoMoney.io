/* ═══════════════════════════════════════════
   Bot brains (V2.5)
   Every decision reads the personality's weights from
   src/data/rules.js, so the four of them genuinely play
   different games: what they'll buy, how hard they bid,
   when they build, and what they do with the tape.
   ═══════════════════════════════════════════ */
window.MM = window.MM || {};

MM.bots = {
  /* Bot skill sharpens the same brain: a casual bot keeps a bigger
     cushion and second-guesses itself, a ruthless one commits. */
  SKILL: {
    casual:   { edge: 0.75, noise: 0.30 },
    normal:   { edge: 1.00, noise: 0.12 },
    ruthless: { edge: 1.30, noise: 0.00 }
  },

  brain(p) {
    return MM.PERSONALITIES.find((x) => x.id === p.personality) || MM.PERSONALITIES[0];
  },

  skill(s) { return this.SKILL[s.settings.botSkill] || this.SKILL.normal; },

  /* the cash a bot wants left in hand after any spend */
  floor(s, p) {
    return Math.round(this.brain(p).weights.cashFloor / this.skill(s).edge);
  },

  /* ── reading the board ──────────────────── */
  completes(s, p, tile) {
    if (!tile.group) return false;
    const group = MM.groupTiles(tile.group);
    return group.filter((t) => s.ownership[t.i] === p.id).length === group.length - 1;
  },

  /* 1 = someone else is one tile from a set, 0.4 = they've started on it */
  blockValue(s, p, tile) {
    if (!tile.group) return 0;
    const group = MM.groupTiles(tile.group);
    let worst = 0;
    MM.livePlayers(s).forEach((o) => {
      if (o.id === p.id) return;
      const owned = group.filter((t) => s.ownership[t.i] === o.id).length;
      if (owned === group.length - 1) worst = Math.max(worst, 1);
      else if (owned > 0) worst = Math.max(worst, 0.4);
    });
    return worst;
  },

  /* ── landing on an unclaimed deed ───────── */
  wantsToBuy(s, p, tile) {
    if (p.cash < tile.price) return false;

    const w = this.brain(p).weights;
    const k = this.skill(s);
    const after = p.cash - tile.price;
    const block = this.blockValue(s, p, tile);

    /* nobody walks past a set they can finish */
    if (this.completes(s, p, tile)) return true;

    /* denying a rival their last tile is the Shark's whole game */
    if (block >= 1 && w.block >= 0.6 && after >= this.floor(s, p) * 0.4) {
      this.say(s, p, 0.4);
      return true;
    }

    if (after < this.floor(s, p)) return false;

    const appetite = w.buyProperty * k.edge
      + w.block * block * 0.35
      + (s.rng.float() - 0.5) * k.noise * 2;

    return appetite > 0.5;
  },

  /* ── auctions ───────────────────────────── */
  bidLimit(s, p, tile) {
    const w = this.brain(p).weights;
    const k = this.skill(s);

    let ceiling = tile.price * (0.75 + w.riskAppetite * 0.55);
    if (this.completes(s, p, tile)) ceiling *= 1.35;
    ceiling *= 1 + w.block * this.blockValue(s, p, tile) * 0.3;
    if (w.style === "random") ceiling *= 0.7 + s.rng.float() * 0.9;
    ceiling *= k.edge;

    return Math.min(Math.round(ceiling), Math.max(0, p.cash - this.floor(s, p) * 0.5));
  },

  /* ── end of turn ────────────────────────── */
  manage(s, p) {
    this.develop(s, p);
    this.trade(s, p);

    /* clear a mortgage once there's comfort again */
    if (p.cash > this.floor(s, p) * 2.5) {
      const held = MM.tilesOf(s, p.id).find((t) => MM.prop.canUnmortgage(s, p, t));
      if (held) MM.prop.unmortgage(s, p, held);
    }
  },

  /* how much cash each personality insists on keeping while building */
  buildReserve(s, p) {
    const w = this.brain(p).weights;
    return Math.round(this.floor(s, p) * (0.8 + (1 - w.build)));
  },

  develop(s, p) {
    const w = this.brain(p).weights;
    const k = this.skill(s);
    if (s.rng.float() > w.build * k.edge) return;

    const reserve = this.buildReserve(s, p);
    let guard = 8;

    while (guard-- > 0) {
      const options = MM.tilesOf(s, p.id)
        .filter((t) => MM.prop.canBuild(s, p, t))
        /* build out the priciest set first — that's where the rent is */
        .sort((a, b) => (s.houses[a.i] || 0) - (s.houses[b.i] || 0) || b.price - a.price);
      if (!options.length) break;

      const tile = options[0];
      const cost = MM.prop.houseCost(tile);

      if (p.cash - cost < reserve) {
        /* the Tycoon will cash out shares to keep pouring concrete */
        if (w.style === "none" && MM.portfolioValue(s, p) > cost) {
          MM.market.liquidateFor(s, p, cost + reserve);
          if (p.cash - cost < reserve) break;
        } else break;
      }

      MM.prop.build(s, p, tile);
      if ((s.houses[tile.i] || 0) === 5) this.say(s, p, 0.5);
    }
  },

  /* ── the tape ───────────────────────────── */
  trade(s, p) {
    const w = this.brain(p).weights;
    const spare = p.cash - this.floor(s, p) - 200;

    if (w.style === "none") return;                /* the Tycoon does not invest */

    if (w.style === "income") {
      /* buy the fattest dividend until the portfolio is the target slice */
      const worth = Math.max(1, MM.netWorth(s, p));
      if (MM.portfolioValue(s, p) / worth >= w.stockTarget || spare <= 0) return;
      const pick = s.stocks.slice().sort((a, b) => b.yield - a.yield)[0];
      const qty = Math.floor(Math.min(spare, worth * 0.2) / pick.price);
      if (qty > 0 && MM.market.buy(s, p, pick.sym, qty)) this.say(s, p, 0.25);
      return;
    }

    if (w.style === "momentum") {
      /* take profits on anything that has run, then buy what's fallen */
      const winner = s.stocks.find((st) => MM.market.held(p, st.sym) > 0 &&
        MM.market.unrealized(p, st) > 0.12);
      if (winner) {
        MM.market.sell(s, p, winner.sym, MM.market.held(p, winner.sym));
        this.say(s, p, 0.35);
        return;
      }
      if (spare <= 0) return;
      const dip = s.stocks.slice().sort((a, b) => (a.price / a.anchor) - (b.price / b.anchor))[0];
      if (dip.price < dip.anchor) {
        const qty = Math.floor(Math.min(spare, spare * w.stockTarget * 2) / dip.price);
        if (qty > 0 && MM.market.buy(s, p, dip.sym, qty)) this.say(s, p, 0.25);
      }
      return;
    }

    /* random: the Wildcard does whatever it feels like */
    if (s.rng.chance(0.18)) {
      const holding = s.stocks.filter((st) => MM.market.held(p, st.sym) > 0);
      if (holding.length) {
        const st = s.rng.pick(holding);
        MM.market.sell(s, p, st.sym, MM.market.held(p, st.sym));
        this.say(s, p, 0.3);
        return;
      }
    }
    if (spare > 0 && s.rng.chance(0.4)) {
      const st = s.rng.pick(s.stocks);
      const qty = Math.floor((spare * (0.2 + s.rng.float() * 0.6)) / st.price);
      if (qty > 0 && MM.market.buy(s, p, st.sym, qty)) this.say(s, p, 0.3);
    }
  },

  /* a line in chat, so the personality is visible from outside */
  say(s, p, chance) {
    const lines = this.brain(p).lines;
    if (!lines || !s.rng.chance(chance)) return;
    MM.chat(s, p.name, s.rng.pick(lines), p.hex);
  }
};
