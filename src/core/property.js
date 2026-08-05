/* ═══════════════════════════════════════════
   Deeds: buying, rent, building, mortgaging and
   the forced sale that happens when someone can't pay.
   ═══════════════════════════════════════════ */
window.MM = window.MM || {};

MM.prop = {
  BUYABLE: ["property", "airport", "utility"],

  isBuyable(t) { return this.BUYABLE.indexOf(t.type) >= 0; },

  houseCost(t) { return t.group ? MM.GROUPS[t.group].house : 0; },

  countType(s, playerId, type) {
    return MM.BOARD.filter((t) => t.type === type && s.ownership[t.i] === playerId).length;
  },

  ownsFullSet(s, playerId, group) {
    const tiles = MM.groupTiles(group);
    return tiles.every((t) => s.ownership[t.i] === playerId);
  },

  setsOwned(s, playerId) {
    return Object.keys(MM.GROUPS).filter((g) => this.ownsFullSet(s, playerId, g));
  },

  /* ── buying ─────────────────────────────── */
  buy(s, player, tile, price) {
    const cost = price === undefined ? tile.price : price;
    MM.debit(s, player, cost, "purchase");
    s.ownership[tile.i] = player.id;
    MM.log(s, `<b>${player.name}</b> bought ${tile.name} for <span class="money">${MM.money(cost)}</span>`, player);
    MM.market.onDeed(s, tile);
    MM.bus.emit("bought", { player, tile, cost });
    MM.bus.emit("state", s);
  },

  /* ── rent ───────────────────────────────── */
  rent(s, tile, diceSum) {
    const owner = MM.ownerOf(s, tile.i);
    if (!owner || s.mortgaged[tile.i]) return 0;
    if (s.rules.noRentInPrison && owner.jailed) return 0;

    if (tile.type === "airport") return MM.AIRPORT_RENT[this.countType(s, owner.id, "airport")];
    if (tile.type === "utility") return MM.UTILITY_MULT[this.countType(s, owner.id, "utility")] * diceSum;

    const houses = s.houses[tile.i] || 0;
    let due = tile.rent[houses];
    if (houses === 0 && s.rules.doubleRent && this.ownsFullSet(s, owner.id, tile.group)) due *= 2;
    return due;
  },

  /* ── building ───────────────────────────── */
  canBuild(s, player, tile) {
    if (tile.type !== "property" || s.ownership[tile.i] !== player.id) return false;
    if (!this.ownsFullSet(s, player.id, tile.group)) return false;
    if ((s.houses[tile.i] || 0) >= 5) return false;

    const group = MM.groupTiles(tile.group);
    if (group.some((t) => s.mortgaged[t.i])) return false;
    if (s.rules.evenBuild) {
      const low = Math.min(...group.map((t) => s.houses[t.i] || 0));
      if ((s.houses[tile.i] || 0) > low) return false;
    }
    return player.cash >= this.houseCost(tile);
  },

  build(s, player, tile) {
    if (!this.canBuild(s, player, tile)) return false;
    const cost = this.houseCost(tile);
    MM.debit(s, player, cost, "building");
    s.houses[tile.i] = (s.houses[tile.i] || 0) + 1;
    const what = s.houses[tile.i] === 5 ? "a hotel" : "a house";
    MM.log(s, `<b>${player.name}</b> built ${what} on ${tile.name} for <span class="money">${MM.money(cost)}</span>`, player);
    MM.market.onBuild(s, tile);
    MM.bus.emit("built", { player, tile });
    MM.bus.emit("state", s);
    return true;
  },

  canSellHouse(s, player, tile) {
    if (s.ownership[tile.i] !== player.id || !(s.houses[tile.i] > 0)) return false;
    if (s.rules.evenBuild) {
      const group = MM.groupTiles(tile.group);
      const high = Math.max(...group.map((t) => s.houses[t.i] || 0));
      if ((s.houses[tile.i] || 0) < high) return false;
    }
    return true;
  },

  /* the bank buys buildings back at half price */
  sellHouse(s, player, tile, quiet) {
    if (!this.canSellHouse(s, player, tile)) return 0;
    const back = Math.round(this.houseCost(tile) / 2);
    s.houses[tile.i] -= 1;
    MM.credit(s, player, back, "sold building");
    if (!quiet) MM.log(s, `<b>${player.name}</b> sold a building on ${tile.name} for <span class="money">${MM.money(back)}</span>`, player);
    MM.bus.emit("state", s);
    return back;
  },

  /* ── mortgaging ─────────────────────────── */
  canMortgage(s, player, tile) {
    return s.rules.mortgage && s.ownership[tile.i] === player.id &&
      !s.mortgaged[tile.i] && !(s.houses[tile.i] > 0);
  },

  mortgage(s, player, tile, quiet) {
    if (!this.canMortgage(s, player, tile)) return 0;
    const raised = Math.round(tile.price / 2);
    s.mortgaged[tile.i] = true;
    MM.credit(s, player, raised, "mortgage");
    if (!quiet) MM.log(s, `<b>${player.name}</b> mortgaged ${tile.name} for <span class="money">${MM.money(raised)}</span>`, player);
    MM.bus.emit("state", s);
    return raised;
  },

  unmortgageCost(tile) { return Math.round((tile.price / 2) * 1.1); },

  canUnmortgage(s, player, tile) {
    return s.ownership[tile.i] === player.id && s.mortgaged[tile.i] &&
      player.cash >= this.unmortgageCost(tile);
  },

  unmortgage(s, player, tile) {
    if (!this.canUnmortgage(s, player, tile)) return false;
    const cost = this.unmortgageCost(tile);
    MM.debit(s, player, cost, "unmortgage");
    delete s.mortgaged[tile.i];
    MM.log(s, `<b>${player.name}</b> lifted the mortgage on ${tile.name} for <span class="money">${MM.money(cost)}</span>`, player);
    MM.bus.emit("state", s);
    return true;
  },

  /* ── forced sale ────────────────────────── */
  /* Everything a player could turn into cash without going bankrupt. */
  liquidValue(s, player) {
    let total = 0;
    MM.tilesOf(s, player.id).forEach((t) => {
      total += (s.houses[t.i] || 0) * Math.round(this.houseCost(t) / 2);
      if (!s.mortgaged[t.i]) total += Math.round(t.price / 2);
    });
    return total;
  },

  /* Sell buildings first, then mortgage — cheapest deeds go last. */
  raiseCash(s, player, target) {
    /* shares are the most liquid thing anyone holds */
    if (player.cash < target) MM.market.liquidateFor(s, player, target);

    const owned = () => MM.tilesOf(s, player.id).sort((a, b) => b.price - a.price);

    let guard = 200;
    while (player.cash < target && guard-- > 0) {
      const withHouses = owned().filter((t) => this.canSellHouse(s, player, t));
      if (withHouses.length) { this.sellHouse(s, player, withHouses[0], true); continue; }

      const mortgageable = owned().filter((t) => this.canMortgage(s, player, t));
      if (mortgageable.length) { this.mortgage(s, player, mortgageable[0], true); continue; }
      break;
    }

    if (player.cash >= target) {
      MM.log(s, `<b>${player.name}</b> sold and mortgaged assets to cover <span class="money">${MM.money(target)}</span>`, player);
    }
    return player.cash;
  },

  /* ── handing over the estate ────────────── */
  estateTo(s, from, to) {
    MM.tilesOf(s, from.id).forEach((t) => {
      if (to) {
        s.ownership[t.i] = to.id;
      } else {
        delete s.ownership[t.i];
        delete s.mortgaged[t.i];
      }
      delete s.houses[t.i];
    });
    MM.bus.emit("state", s);
  }
};
