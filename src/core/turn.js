/* ═══════════════════════════════════════════
   Turn state machine
   lobby → awaiting-roll → rolling → moving
         → resolving → turn-end → (next player)
   ═══════════════════════════════════════════ */
window.MM = window.MM || {};

/* Every pace delay in this file funnels through here, which makes it
   the one choke point a solo-game pause needs — see MM.turn.pause()
   below and screens.js's modal()/closeModal(). The setTimeout itself
   still runs to completion (nothing here freezes a clock mid-flight),
   but nothing downstream of a `wait()` proceeds until the game is
   unpaused, so a bot's turn stalls at whichever pace beat it was on
   the moment a popup opened, and quietly picks back up when it closes. */
const wait = (ms) => new Promise((r) => setTimeout(r, ms)).then(() => MM.turn._gate());

/* Named pauses so the table reads at a watchable pace rather than a
   flicker — every one of these is a moment where something just
   happened and the log/board deserves a beat before the next thing does. */
const PACE = {
  JAIL_STAY: 450,       /* "stays in prison" before the turn moves on       */
  LANDING_IN: 260,      /* breath after the token lands, before it resolves */
  LANDING_OUT: 340,     /* breath after resolving, before the turn ends     */
  BOT_BUY_THINK: 450,   /* a bot "deciding" whether to buy                  */
  NEXT_PLAYER: 380      /* between turn-end and the next player's turn      */
};

MM.turn = {
  busy: false,

  /* ── solo-only pause ──────────────────────
     A networked game never pauses — other real people are relying on
     it moving without you. Solo play pauses the instant a popup opens
     (Market, Trades, Rules, the bankrupt confirm, all of it) and picks
     back up the instant it closes — see screens.js. */
  paused: false,
  _resumeQueue: [],
  pause() { if (!MM.net.enabled) this.paused = true; },
  resume() {
    this.paused = false;
    const q = this._resumeQueue;
    this._resumeQueue = [];
    q.forEach((fn) => fn());
  },
  _gate() {
    return this.paused ? new Promise((resolve) => this._resumeQueue.push(resolve)) : Promise.resolve();
  },
  wait,

  /* a player who'd rather not roll this turn — build/mortgage already
     happens before this, same as before a real roll — passes play on
     without moving. Only meaningful before the dice are actually down;
     once they're rolled there's nothing left to skip. */
  skipTurn(s) {
    if (this.busy || s.phase !== MM.PHASES.AWAIT_ROLL) return;
    this.busy = true;
    const p = MM.currentPlayer(s);
    MM.log(s, `<b>${p.name}</b> ended their turn without rolling`, p);
    MM.bus.emit("state", s);
    this.finishTurn(s, false);
  },

  /* ── kick off ─────────────────────────── */
  begin(s) {
    s.current = 0;
    s.round = 1;
    MM.log(s, "Game started with a randomised player order. Good luck!");
    MM.snapshotWorth(s);
    MM.setPhase(s, MM.PHASES.AWAIT_ROLL);
    this.startTurn(s);
  },

  startTurn(s) {
    const p = MM.currentPlayer(s);
    if (!p.alive) return this.nextPlayer(s);

    p.doubles = 0;
    MM.setPhase(s, MM.PHASES.AWAIT_ROLL);
    MM.bus.emit("turn", p);
    MM.bus.emit("state", s);

    if (p.bot) this.runBotTurn(s, p);
  },

  /* the delay before a bot's roll, with room for it to shop a trade
     offer to the human first — same timing as before when it doesn't */
  async runBotTurn(s, p) {
    await wait(s.settings.botDelay);
    if (s.phase !== MM.PHASES.AWAIT_ROLL || MM.currentPlayer(s) !== p) return;

    if (!p.jailed) await MM.trades.maybeProposeToHuman(s, p);
    if (s.phase !== MM.PHASES.AWAIT_ROLL || MM.currentPlayer(s) !== p) return;

    this.roll(s);
  },

  /* ── roll ─────────────────────────────── */
  async roll(s) {
    if (this.busy || s.phase !== MM.PHASES.AWAIT_ROLL) return;
    this.busy = true;

    const p = MM.currentPlayer(s);

    /* a kept card beats the cell */
    if (p.jailed && p.getOut > 0) {
      p.getOut -= 1;
      p.jailed = false;
      p.jailTurns = 0;
      MM.log(s, `<b>${p.name}</b> used a get-out-of-prison card`, p);
    }

    const d = MM.rollDice(s.rng);
    s.dice = d;

    MM.setPhase(s, MM.PHASES.ROLLING);
    MM.bus.emit("dice", d);
    await MM.diceUI.roll(d);

    if (p.jailed) return this.resolveJailRoll(s, p, d);

    if (d.isDouble) {
      p.doubles += 1;
      if (p.doubles === 3) {
        MM.log(s, `<b>${p.name}</b> rolled a third double — straight to prison`, p);
        await this.sendToPrison(s, p);
        return this.finishTurn(s, false);
      }
      MM.log(s, `<b>${p.name}</b> rolled <b>${d.a}+${d.b}</b> — doubles, roll again`, p);
    } else {
      MM.log(s, `<b>${p.name}</b> rolled <b>${d.a}+${d.b}</b> = ${d.sum}`, p);
    }

    await this.advance(s, p, d.sum, 0);
    return this.finishTurn(s, d.isDouble);
  },

  async resolveJailRoll(s, p, d) {
    if (d.isDouble) {
      p.jailed = false;
      p.jailTurns = 0;
      MM.log(s, `<b>${p.name}</b> rolled doubles and walks free`, p);
      await this.advance(s, p, d.sum, 0);
      return this.finishTurn(s, false);
    }

    p.jailTurns += 1;
    if (p.jailTurns >= 3) {
      MM.pay(s, p, null, MM.BAIL, "bail");
      p.jailed = false;
      p.jailTurns = 0;
      MM.log(s, `<b>${p.name}</b> paid <span class="money">${MM.money(MM.BAIL)}</span> bail`, p);
      await this.advance(s, p, d.sum, 0);
    } else {
      MM.log(s, `<b>${p.name}</b> stays in prison (${p.jailTurns}/3)`, p);
      await wait(PACE.JAIL_STAY);
    }
    return this.finishTurn(s, false);
  },

  /* ── movement ─────────────────────────── */
  /* depth guards card-chains; 99 means "just move, I'll resolve it myself" */
  async advance(s, p, steps, depth) {
    MM.setPhase(s, MM.PHASES.MOVING);
    await MM.renderer.travel(p, steps, (index) => {
      if (index === 0) this.passGo(s, p);
    });
    if (depth === 99) return;
    MM.setPhase(s, MM.PHASES.RESOLVING);
    await this.resolveLanding(s, p, MM.tile(p.pos), depth || 0);
  },

  async walkTo(s, p, index) {
    const steps = ((index - p.pos + 40) % 40) || 40;
    await this.advance(s, p, steps, 99);
  },

  passGo(s, p) {
    MM.credit(s, p, MM.GO_SALARY, "salary");
    MM.log(s, `<b>${p.name}</b> passed START and collected <span class="money">${MM.money(MM.GO_SALARY)}</span>`, p);
    MM.market.dividends(s, p);
    MM.bus.emit("pass-go", p);
  },

  async sendToPrison(s, p) {
    p.jailed = true;
    p.jailTurns = 0;
    p.doubles = 0;
    MM.bus.emit("jailed", p);
    await MM.renderer.teleport(p, MM.JAIL_INDEX);
    MM.bus.emit("state", s);
  },

  /* ── landing ──────────────────────────── */
  async resolveLanding(s, p, tile, depth) {
    if (!p.alive) return;
    await wait(PACE.LANDING_IN);

    switch (tile.type) {
      case "property":
      case "airport":
      case "utility": {
        const owner = MM.ownerOf(s, tile.i);

        if (!owner) return this.offer(s, p, tile);

        if (owner.id === p.id) {
          MM.log(s, `<b>${p.name}</b> is home at ${tile.name}`, p);
          break;
        }
        if (s.mortgaged[tile.i]) {
          MM.log(s, `${tile.name} is mortgaged — no rent for <b>${owner.name}</b>`, owner);
          break;
        }

        const due = MM.prop.rent(s, tile, s.dice.sum);
        if (due <= 0) {
          MM.log(s, `<b>${p.name}</b> landed on ${tile.name} — nothing to pay`, p);
          break;
        }
        const paid = MM.pay(s, p, owner, due, "rent");
        owner.rentTotal = (owner.rentTotal || 0) + paid;
        MM.log(s, `<b>${p.name}</b> paid <b>${owner.name}</b> <span class="money">${MM.money(due)}</span> in rent at ${tile.name}`, p);
        break;
      }

      case "tax": {
        const dueTax = tile.pct
          ? Math.min(tile.amount, Math.round((MM.netWorth(s, p) * tile.pct) / 100))
          : tile.amount;
        MM.pay(s, p, null, dueTax, "tax");
        if (s.rules.vacationCash) s.vacationPot += dueTax;
        MM.log(s, `<b>${p.name}</b> paid <span class="money">${MM.money(dueTax)}</span> ${tile.name.toLowerCase()}`, p);
        break;
      }

      case "vacation": {
        if (s.rules.vacationCash && s.vacationPot > 0) {
          MM.credit(s, p, s.vacationPot, "vacation");
          MM.log(s, `<b>${p.name}</b> swept the vacation pot — <span class="money">${MM.money(s.vacationPot)}</span>`, p);
          s.vacationPot = 0;
        } else {
          MM.log(s, `<b>${p.name}</b> is on vacation`, p);
        }
        break;
      }

      case "gotojail":
        MM.log(s, `<b>${p.name}</b> was sent to prison`, p);
        await this.sendToPrison(s, p);
        break;

      case "jail":
        MM.log(s, `<b>${p.name}</b> is just passing by the prison`, p);
        break;

      case "surprise":
      case "treasure": {
        if ((depth || 0) >= 2) break; /* a card that lands you on a card stops here */
        const card = MM.cards.draw(s, tile.type);
        MM.log(s, `<b>${p.name}</b> drew a ${tile.name} card`, p);
        if (p.bot || MM.net.isMine(p)) {
          await MM.deal.showCard(s, tile.type, card, p);
        } else {
          /* someone else's screen shows the card face — this one just
             holds the same pause a human's "Continue" timer would have */
          MM.net.tell("showCard", { kind: tile.type, card }, { to: p.id });
          await wait(6000);
        }
        await MM.cards.apply(s, p, card, depth || 0);
        break;
      }

      case "go":
        MM.log(s, `<b>${p.name}</b> landed square on START`, p);
        break;
    }

    MM.bus.emit("state", s);
    await wait(PACE.LANDING_OUT);
  },

  /* ── an unclaimed deed ────────────────── */
  async offer(s, p, tile) {
    const price = tile.price;

    if (p.bot) {
      await wait(PACE.BOT_BUY_THINK);
      if (MM.bots.wantsToBuy(s, p, tile)) return MM.prop.buy(s, p, tile);
      MM.log(s, `<b>${p.name}</b> passed on ${tile.name}`, p);
      if (s.rules.auction) await MM.auction.run(s, tile);
      return;
    }

    if (p.cash < price) {
      MM.log(s, `<b>${p.name}</b> can't afford ${tile.name} at <span class="money">${MM.money(price)}</span>`, p);
      if (s.rules.auction) await MM.auction.run(s, tile);
      return;
    }

    MM.setPhase(s, MM.PHASES.DECIDING);
    const buying = await MM.net.ask(p, "buyOffer", { tile: tile.i }, () => MM.deal.offer(s, tile, p));
    MM.setPhase(s, MM.PHASES.RESOLVING);

    if (buying) return MM.prop.buy(s, p, tile);

    MM.log(s, `<b>${p.name}</b> passed on ${tile.name}`, p);
    if (s.rules.auction) await MM.auction.run(s, tile);
  },

  /* ── end of turn ──────────────────────── */
  finishTurn(s, rollAgain) {
    this.busy = false;
    MM.deal.hide();

    const p = MM.currentPlayer(s);
    if (p.bot && p.alive) MM.bots.manage(s, p);

    const alive = MM.livePlayers(s);
    if (alive.length <= 1) {
      MM.setPhase(s, MM.PHASES.GAME_OVER);
      MM.log(s, `<b>${alive[0] ? alive[0].name : "Nobody"}</b> owns the table. Game over.`);
      MM.bus.emit("game-over", alive[0]);
      return;
    }

    if (rollAgain && p.alive && !p.jailed) {
      MM.setPhase(s, MM.PHASES.AWAIT_ROLL);
      MM.bus.emit("turn", p);
      if (p.bot) wait(s.settings.botDelay).then(() => this.roll(s));
      return;
    }

    MM.setPhase(s, MM.PHASES.TURN_END);
    wait(PACE.NEXT_PLAYER).then(() => this.nextPlayer(s));
  },

  nextPlayer(s) {
    const start = s.current;
    do {
      s.current = (s.current + 1) % s.players.length;
      if (s.current <= start) {
        s.round += 1;
        MM.driftMarket(s);
        MM.snapshotWorth(s);
      }
    } while (!MM.currentPlayer(s).alive && s.current !== start);

    this.startTurn(s);
  }
};
