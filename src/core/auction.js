/* ═══════════════════════════════════════════
   Ascending auction for a declined property.
   Everyone still in the game gets a turn to beat the
   standing bid; drop out and you're out for good.
   ═══════════════════════════════════════════ */
window.MM = window.MM || {};

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

MM.auction = {
  async run(s, tile) {
    const step = Math.max(10, Math.round(tile.price * 0.1));
    let live = MM.livePlayers(s).filter((p) => p.cash >= step);
    if (!live.length) {
      MM.log(s, `No one could bid on ${tile.name} — it stays with the bank`);
      return null;
    }

    let price = 0;
    let leader = null;
    let i = 0;
    let guard = 400;

    MM.log(s, `${tile.name} goes to auction, bids rise in <span class="money">${MM.money(step)}</span> steps`);

    while (guard-- > 0) {
      if (!live.length) break;
      if (live.length === 1 && leader === live[0]) break;

      const p = live[i % live.length];
      if (p === leader) { i += 1; continue; }

      const bid = price + step;
      let wants = false;

      if (p.cash >= bid) {
        if (p.bot) {
          MM.deal.auctionWatch(s, tile, price, leader);
          MM.net.tell("auctionWatch", { tile: tile.i, price, leaderId: leader ? leader.id : null });
          await pause(450);
          wants = bid <= MM.bots.bidLimit(s, p, tile);
        } else {
          MM.deal.auctionWatch(s, tile, price, leader);
          MM.net.tell("auctionWatch", { tile: tile.i, price, leaderId: leader ? leader.id : null }, { exceptSeat: p.id });
          wants = await MM.net.ask(p, "auctionBid", { tile: tile.i, bid, leaderId: leader ? leader.id : null },
            () => MM.deal.auctionBid(s, tile, bid, leader));
        }
      }

      if (wants) {
        price = bid;
        leader = p;
        MM.log(s, `<b>${p.name}</b> bids <span class="money">${MM.money(price)}</span>`, p);
        MM.bus.emit("auction-bid", { player: p, tile, price });
        i += 1;
      } else {
        const at = live.indexOf(p);
        live.splice(at, 1);
        if (at < i % (live.length + 1)) i -= 1;
        if (i < 0 || i >= live.length) i = 0;
        if (p.cash >= step) MM.log(s, `<b>${p.name}</b> dropped out`, p);
      }
    }

    MM.deal.hide();

    if (leader) {
      MM.prop.buy(s, leader, tile, price);
      return { winner: leader, price };
    }

    MM.log(s, `${tile.name} drew no bids and stays with the bank`);
    return null;
  }
};
