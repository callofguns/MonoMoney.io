/* ═══════════════════════════════════════════
   Baseline bot decisions (V1.5)
   Deliberately one shared brain: everybody buys what
   they can afford and builds when a set is complete.
   V2.5 replaces this with the four personalities and
   their weights from src/data/rules.js.
   ═══════════════════════════════════════════ */
window.MM = window.MM || {};

MM.bots = {
  RESERVE: 120,        /* cash a bot likes to keep in hand   */
  BUILD_FLOOR: 450,    /* won't spend below this on building */

  reserve(s, p) {
    return this.RESERVE + (s.settings.botSkill === "ruthless" ? 0 : 60);
  },

  wantsToBuy(s, p, tile) {
    if (p.cash < tile.price) return false;
    /* completing or blocking a set is always worth the squeeze */
    if (tile.group) {
      const group = MM.groupTiles(tile.group);
      const mine = group.filter((t) => s.ownership[t.i] === p.id).length;
      if (mine === group.length - 1) return true;
    }
    return p.cash - tile.price >= this.reserve(s, p);
  },

  bidLimit(s, p, tile) {
    const cap = Math.round(tile.price * 1.25);
    return Math.min(cap, Math.max(0, p.cash - this.reserve(s, p)));
  },

  /* end-of-turn housekeeping: put spare cash into buildings */
  manage(s, p) {
    let guard = 6;
    while (guard-- > 0 && p.cash > this.BUILD_FLOOR) {
      const options = MM.tilesOf(s, p.id)
        .filter((t) => MM.prop.canBuild(s, p, t) && p.cash - MM.prop.houseCost(t) > this.BUILD_FLOOR - 200)
        .sort((a, b) => (s.houses[a.i] || 0) - (s.houses[b.i] || 0) || a.price - b.price);
      if (!options.length) break;
      MM.prop.build(s, p, options[0]);
    }

    /* lift a mortgage once the cash is comfortable again */
    if (p.cash > 700) {
      const held = MM.tilesOf(s, p.id).find((t) => MM.prop.canUnmortgage(s, p, t));
      if (held) MM.prop.unmortgage(s, p, held);
    }
  }
};
