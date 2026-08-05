/* ═══════════════════════════════════════════
   Turn state machine
   lobby → awaiting-roll → rolling → moving
         → resolving → turn-end → (next player)
   ═══════════════════════════════════════════ */
window.MM = window.MM || {};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

MM.turn = {
  busy: false,

  /* ── kick off ─────────────────────────── */
  begin(s) {
    s.current = 0;
    s.round = 1;
    MM.log(s, "Game started with a randomised player order. Good luck!");
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

    if (p.bot) {
      setTimeout(() => {
        if (s.phase === MM.PHASES.AWAIT_ROLL && MM.currentPlayer(s) === p) this.roll(s);
      }, s.settings.botDelay);
    }
  },

  /* ── roll ─────────────────────────────── */
  async roll(s) {
    if (this.busy || s.phase !== MM.PHASES.AWAIT_ROLL) return;
    this.busy = true;

    const p = MM.currentPlayer(s);
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

    await this.advance(s, p, d.sum);
    return this.finishTurn(s, d.isDouble);
  },

  async resolveJailRoll(s, p, d) {
    if (d.isDouble) {
      p.jailed = false;
      p.jailTurns = 0;
      MM.log(s, `<b>${p.name}</b> rolled doubles and walks free`, p);
      await this.advance(s, p, d.sum);
      return this.finishTurn(s, false);
    }

    p.jailTurns += 1;
    if (p.jailTurns >= 3) {
      MM.debit(s, p, MM.BAIL, "bail");
      p.jailed = false;
      p.jailTurns = 0;
      MM.log(s, `<b>${p.name}</b> paid <span class="money">${MM.money(MM.BAIL)}</span> bail`, p);
      await this.advance(s, p, d.sum);
    } else {
      MM.log(s, `<b>${p.name}</b> stays in prison (${p.jailTurns}/3)`, p);
      await wait(320);
    }
    return this.finishTurn(s, false);
  },

  /* ── movement ─────────────────────────── */
  async advance(s, p, steps) {
    MM.setPhase(s, MM.PHASES.MOVING);
    await MM.renderer.travel(p, steps, (index) => {
      if (index === 0) this.passGo(s, p);
    });
    MM.setPhase(s, MM.PHASES.RESOLVING);
    await this.resolveLanding(s, p, MM.tile(p.pos));
  },

  passGo(s, p) {
    MM.credit(s, p, MM.GO_SALARY, "salary");
    MM.log(s, `<b>${p.name}</b> passed START and collected <span class="money">${MM.money(MM.GO_SALARY)}</span>`, p);
    MM.bus.emit("pass-go", p); /* Phase 3 hangs dividends off this */
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
  async resolveLanding(s, p, tile) {
    await wait(200);

    switch (tile.type) {
      case "property":
      case "airport":
      case "utility": {
        const owner = MM.ownerOf(s, tile.i);
        if (!owner) {
          MM.log(s, `<b>${p.name}</b> landed on ${tile.name} — unclaimed at <span class="money">${MM.money(tile.price)}</span>`, p);
        } else if (owner.id === p.id) {
          MM.log(s, `<b>${p.name}</b> is home at ${tile.name}`, p);
        } else {
          MM.log(s, `<b>${p.name}</b> owes rent at ${tile.name}`, p);
        }
        break;
      }

      case "tax": {
        const due = tile.pct
          ? Math.min(tile.amount, Math.round((MM.netWorth(s, p) * tile.pct) / 100))
          : tile.amount;
        MM.debit(s, p, due, "tax");
        if (s.rules.vacationCash) s.vacationPot += due;
        MM.log(s, `<b>${p.name}</b> paid <span class="money">${MM.money(due)}</span> ${tile.name.toLowerCase()}`, p);
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
      case "treasure":
        MM.log(s, `<b>${p.name}</b> drew a ${tile.name} card`, p);
        break;

      case "go":
        MM.log(s, `<b>${p.name}</b> landed square on START`, p);
        break;
    }

    MM.bus.emit("state", s);
    await wait(260);
  },

  /* ── end of turn ──────────────────────── */
  finishTurn(s, rollAgain) {
    this.busy = false;

    const alive = MM.livePlayers(s);
    if (alive.length <= 1) {
      MM.setPhase(s, MM.PHASES.GAME_OVER);
      MM.log(s, `<b>${alive[0] ? alive[0].name : "Nobody"}</b> owns the table. Game over.`);
      MM.bus.emit("game-over", alive[0]);
      return;
    }

    const p = MM.currentPlayer(s);
    if (rollAgain && p.alive && !p.jailed) {
      MM.setPhase(s, MM.PHASES.AWAIT_ROLL);
      MM.bus.emit("turn", p);
      if (p.bot) setTimeout(() => this.roll(s), s.settings.botDelay);
      return;
    }

    MM.setPhase(s, MM.PHASES.TURN_END);
    setTimeout(() => this.nextPlayer(s), 260);
  },

  nextPlayer(s) {
    const start = s.current;
    do {
      s.current = (s.current + 1) % s.players.length;
      if (s.current <= start) {
        s.round += 1;
        MM.driftMarket(s);
      }
    } while (!MM.currentPlayer(s).alive && s.current !== start);

    this.startTurn(s);
  }
};
