/* ═══ drawing and resolving Surprise / Treasure cards ═══ */
window.MM = window.MM || {};

MM.cards = {
  /* shuffle a fresh pile whenever one runs out */
  refill(s, kind) {
    const pile = MM.DECKS[kind].slice();
    for (let i = pile.length - 1; i > 0; i--) {
      const j = Math.floor(s.rng.float() * (i + 1));
      [pile[i], pile[j]] = [pile[j], pile[i]];
    }
    s.piles[kind] = pile;
  },

  draw(s, kind) {
    if (!s.piles[kind] || !s.piles[kind].length) this.refill(s, kind);
    return s.piles[kind].pop();
  },

  async apply(s, player, card, depth) {
    const e = card.effect;

    switch (e.type) {
      case "cash":
        if (e.amount >= 0) {
          MM.credit(s, player, e.amount, "card");
          MM.log(s, `<b>${player.name}</b> collected <span class="money">${MM.money(e.amount)}</span>`, player);
        } else {
          MM.pay(s, player, null, -e.amount, "card");
          MM.log(s, `<b>${player.name}</b> paid <span class="money">${MM.money(-e.amount)}</span>`, player);
        }
        break;

      case "collectEach": {
        let got = 0;
        MM.livePlayers(s).forEach((other) => {
          if (other !== player) got += MM.pay(s, other, player, e.amount, "card");
        });
        MM.log(s, `<b>${player.name}</b> collected <span class="money">${MM.money(got)}</span> from the table`, player);
        break;
      }

      case "payEach": {
        let paid = 0;
        MM.livePlayers(s).forEach((other) => {
          if (other !== player && player.alive) paid += MM.pay(s, player, other, e.amount, "card");
        });
        MM.log(s, `<b>${player.name}</b> paid out <span class="money">${MM.money(paid)}</span>`, player);
        break;
      }

      case "repairs": {
        let houses = 0, hotels = 0;
        MM.tilesOf(s, player.id).forEach((t) => {
          const h = s.houses[t.i] || 0;
          if (h === 5) hotels += 1; else houses += h;
        });
        const bill = houses * e.house + hotels * e.hotel;
        if (bill) {
          MM.pay(s, player, null, bill, "repairs");
          MM.log(s, `<b>${player.name}</b> paid <span class="money">${MM.money(bill)}</span> for repairs on ${houses} house${houses === 1 ? "" : "s"} and ${hotels} hotel${hotels === 1 ? "" : "s"}`, player);
        } else {
          MM.log(s, `<b>${player.name}</b> owns nothing to repair`, player);
        }
        break;
      }

      case "getOut":
        player.getOut += 1;
        MM.log(s, `<b>${player.name}</b> is holding a get-out-of-prison card`, player);
        break;

      case "jail":
        await MM.turn.sendToPrison(s, player);
        break;

      case "move":
        await MM.turn.walkTo(s, player, e.to, true);
        await MM.turn.resolveLanding(s, player, MM.tile(player.pos), (depth || 0) + 1);
        break;

      case "moveBy":
        if (e.steps > 0) {
          await MM.turn.advance(s, player, e.steps, (depth || 0) + 1);
        } else {
          player.pos = (player.pos + e.steps + 40) % 40;
          await MM.renderer.teleport(player, player.pos);
          await MM.turn.resolveLanding(s, player, MM.tile(player.pos), (depth || 0) + 1);
        }
        break;

      case "nearest": {
        const type = e.kind;
        let steps = 1;
        while (steps < 40 && MM.tile(player.pos + steps).type !== type) steps += 1;
        await MM.turn.advance(s, player, steps, 99); /* 99 = don't auto-resolve */

        const tile = MM.tile(player.pos);
        const owner = MM.ownerOf(s, tile.i);
        if (!owner) {
          await MM.turn.offer(s, player, tile);
        } else if (owner.id !== player.id && !s.mortgaged[tile.i]) {
          const due = type === "airport"
            ? MM.AIRPORT_RENT[MM.prop.countType(s, owner.id, "airport")] * e.multiplier
            : e.multiplier * s.dice.sum;
          MM.pay(s, player, owner, due, "rent");
          MM.log(s, `<b>${player.name}</b> paid <b>${owner.name}</b> <span class="money">${MM.money(due)}</span> at ${tile.name}`, player);
        }
        break;
      }
    }

    MM.bus.emit("state", s);
  }
};
