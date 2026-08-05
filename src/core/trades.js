/* ═══════════════════════════════════════════
   Player-to-player trades
   A bundle is { cash, tiles: [tileIndex...], shares: {SYM: qty} }.
   Bots value a bundle through their own personality — the same
   `weights` that drive buying and building in core/bots.js — so a
   trade that flatters the Tycoon can still insult the Banker.
   ═══════════════════════════════════════════ */
window.MM = window.MM || {};

MM.trades = {
  MIN_MARGIN: 0.06,        /* the base premium any bot wants over fair value */
  PROPOSE_COOLDOWN: 3,     /* rounds before a bot will offer the human another trade */

  emptyBundle() { return { cash: 0, tiles: [], shares: {} }; },

  bundleIsEmpty(b) {
    return !b.cash && (!b.tiles || !b.tiles.length) &&
      (!b.shares || !Object.values(b.shares).some((q) => q > 0));
  },

  /* can `player` actually put this bundle on the table right now? */
  canOffer(s, player, bundle) {
    if ((bundle.cash || 0) > player.cash) return false;
    for (const i of bundle.tiles || []) {
      if (s.ownership[i] !== player.id) return false;
      if (s.houses[i] > 0) return false;
    }
    for (const sym in bundle.shares || {}) {
      if ((bundle.shares[sym] || 0) > MM.market.held(player, sym)) return false;
    }
    return true;
  },

  /* raw fair-market value — what a bundle would fetch from the bank */
  marketValue(s, bundle) {
    let v = bundle.cash || 0;
    (bundle.tiles || []).forEach((i) => {
      const t = MM.BOARD[i];
      v += s.mortgaged[i] ? t.price / 2 : t.price;
    });
    Object.entries(bundle.shares || {}).forEach(([sym, qty]) => {
      v += MM.market.stock(s, sym).price * qty;
    });
    return v;
  },

  /* how much the bundle is worth to a SPECIFIC bot, personality-tinted.
     The set-completion bonus checks ownership before the trade, so a
     bundle handing over two of a group's three missing tiles at once
     under-credits itself slightly — a deliberate simplification, since
     the more consequential check (does giving a tile away complete
     someone ELSE's set) is exact, in completesRecipient() below. */
  personalValue(s, bot, bundle) {
    const w = MM.bots.brain(bot).weights;
    let v = bundle.cash || 0;

    (bundle.tiles || []).forEach((i) => {
      const t = MM.BOARD[i];
      let base = s.mortgaged[i] ? t.price / 2 : t.price;
      if (t.group) {
        const group = MM.groupTiles(t.group);
        const owned = group.filter((x) => s.ownership[x.i] === bot.id).length;
        if (owned === group.length - 1) base *= 1.5 + w.block * 0.7;   /* this completes a set */
      }
      v += base;
    });

    Object.entries(bundle.shares || {}).forEach(([sym, qty]) => {
      const st = MM.market.stock(s, sym);
      let base = st.price * qty;
      if (w.style === "income") base *= 1 + st.yield * 4;             /* the Banker prizes yield */
      v += base;
    });

    return v;
  },

  /* would handing `bundle`'s tiles to `recipientId` complete a colour
     group? — checked against every tile in the bundle at once, so a
     trade that hands over two of a rival's three missing tiles in one
     go is caught even though neither tile alone would be */
  completesRecipient(s, recipientId, bundle) {
    const groups = new Set();
    (bundle.tiles || []).forEach((i) => { const t = MM.BOARD[i]; if (t.group) groups.add(t.group); });
    for (const g of groups) {
      const already = MM.groupTiles(g).every((x) =>
        s.ownership[x.i] === recipientId || (bundle.tiles || []).includes(x.i));
      if (already) return true;
    }
    return false;
  },

  /* ── a bot deciding on an offer ──────────
     give = what the bot would receive · take = what the bot would give
     up, headed to `counterpartId` */
  evaluate(s, bot, give, take, counterpartId) {
    const w = MM.bots.brain(bot).weights;
    const receive = this.personalValue(s, bot, give);
    let cost = this.personalValue(s, bot, take);

    /* handing over the last piece of a set gives every bot pause — the
       Shark, whose whole game is blocking, pauses hardest of all */
    const blocksOne = counterpartId !== undefined && this.completesRecipient(s, counterpartId, take);
    if (blocksOne) cost *= w.block >= 0.6 ? 3 : 1.7;

    const skill = MM.bots.skill(s);
    const threshold = (this.MIN_MARGIN + (1 - w.riskAppetite) * 0.12) * skill.edge;
    const margin = (receive - cost) / Math.max(1, cost);
    const accept = margin >= threshold;

    let reason = null;
    if (!accept) {
      reason = blocksOne ? "I'm not handing over the last piece of that set"
        : cost > receive * 1.6 ? "that's a lot to ask"
        : "not quite enough for me";
    }
    return { accept, reason, receive, cost };
  },

  /* ── the human proposing to a bot ───────── */
  proposeToBot(s, proposer, bot, give, take) {
    if (!this.canOffer(s, proposer, give) || !this.canOffer(s, bot, take)) {
      return { accept: false, reason: "that trade isn't valid anymore" };
    }
    if (this.bundleIsEmpty(give) && this.bundleIsEmpty(take)) {
      return { accept: false, reason: "there's nothing on the table" };
    }

    const result = this.evaluate(s, bot, give, take, proposer.id);
    if (result.accept) {
      this.execute(s, proposer, bot, give, take);
      MM.log(s, `<b>${proposer.name}</b> and <b>${bot.name}</b> shook on a trade`, bot);
      MM.bots.say(s, bot, 0.6);
    } else {
      MM.log(s, `<b>${bot.name}</b> turned down the trade — ${result.reason}`, bot);
    }
    return result;
  },

  /* ── moving the goods: aGives runs a → b, aWants runs b → a ── */
  execute(s, a, b, aGives, aWants) {
    if (aGives.cash) { MM.debit(s, a, aGives.cash, "trade"); MM.credit(s, b, aGives.cash, "trade"); }
    if (aWants.cash) { MM.debit(s, b, aWants.cash, "trade"); MM.credit(s, a, aWants.cash, "trade"); }

    (aGives.tiles || []).forEach((i) => { s.ownership[i] = b.id; });
    (aWants.tiles || []).forEach((i) => { s.ownership[i] = a.id; });

    Object.entries(aGives.shares || {}).forEach(([sym, qty]) => { if (qty > 0) MM.market.transferShares(s, a, b, sym, qty); });
    Object.entries(aWants.shares || {}).forEach(([sym, qty]) => { if (qty > 0) MM.market.transferShares(s, b, a, sym, qty); });

    MM.bus.emit("state", s);
  },

  /* ── the one offer bots initiate on their own: cash for the missing
     piece of a set, aimed only at the human, on a personality-scaled
     chance with a cooldown so it doesn't ask every turn ─────────── */
  async maybeProposeToHuman(s, bot) {
    if (!s.rules.botTrades) return;

    bot.tradeCooldown = Math.max(0, (bot.tradeCooldown || 0) - 1);
    if (bot.tradeCooldown > 0) return;

    const human = s.players[0];
    if (!human.alive || human.bot) return;

    const w = MM.bots.brain(bot).weights;
    const chance = { none: 0.35, income: 0.08, momentum: 0.5, random: 0.25 }[w.style] || 0.2;
    if (!s.rng.chance(chance)) return;

    const target = MM.tilesOf(s, human.id).find((t) =>
      t.group && !(s.houses[t.i] > 0) && MM.bots.completes(s, bot, t));
    if (!target) return;

    const premium = w.style === "none" ? 1.3 + s.rng.float() * 0.3
      : w.style === "momentum" ? 1.5 + s.rng.float() * 0.5
      : w.style === "income" ? 1.15 + s.rng.float() * 0.15
      : 0.7 + s.rng.float() * 1.3;                    /* the Wildcard might even lowball */

    const offer = Math.max(1, Math.round(target.price * premium));
    if (bot.cash - offer < MM.bots.floor(s, bot) * 0.3) return;

    bot.tradeCooldown = this.PROPOSE_COOLDOWN;
    MM.log(s, `<b>${bot.name}</b> offers <b>${human.name}</b> <span class="money">${MM.money(offer)}</span> for ${target.name}`, bot);

    const accepted = await MM.deal.tradeOffer(s, bot, target, offer);
    if (accepted) {
      this.execute(s, human, bot,
        { cash: 0, tiles: [target.i], shares: {} },
        { cash: offer, tiles: [], shares: {} });
      MM.log(s, `<b>${human.name}</b> sold ${target.name} to <b>${bot.name}</b> for <span class="money">${MM.money(offer)}</span>`, human);
      MM.bots.say(s, bot, 0.6);
    } else {
      MM.log(s, `<b>${human.name}</b> turned it down`, human);
    }
  }
};
