/* ═══════════════════════════════════════════
   Game state · single source of truth
   Everything that changes the world goes through
   a function here and announces itself on MM.bus.
   ═══════════════════════════════════════════ */
window.MM = window.MM || {};

MM.PHASES = {
  LOBBY: "lobby",
  AWAIT_ROLL: "awaiting-roll",
  ROLLING: "rolling",
  MOVING: "moving",
  RESOLVING: "resolving",
  DECIDING: "deciding",
  TURN_END: "turn-end",
  GAME_OVER: "game-over"
};

MM.money = (n) => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US");

MM.createGame = function (opts) {
  const settings = Object.assign({}, MM.DEFAULT_SETTINGS, opts && opts.settings);
  const rules = {};
  MM.RULE_DEFS.forEach((r) => (rules[r.id] = r.on));
  Object.assign(rules, opts && opts.rules);

  const rng = MM.createRng(opts && opts.seed);
  const players = [];

  players.push({
    id: 0, name: (opts && opts.nickname) || "You", avatar: "😀",
    color: "var(--p1)", hex: "#4e97ff", bot: false, personality: null,
    cash: settings.startingCash, pos: 0, jailed: false, jailTurns: 0,
    doubles: 0, alive: true, portfolio: {}, getOut: 0, lastDelta: 0, divTotal: 0
  });

  const roster = MM.PERSONALITIES.slice(0, Math.max(0, settings.players - 1));
  const hexes = { tycoon: "#ff8455", banker: "#2fd4a0", shark: "#f26a8d", wildcard: "#ffd166" };
  roster.forEach((p, n) => {
    players.push({
      id: n + 1, name: p.name, avatar: p.avatar,
      color: p.color, hex: hexes[p.id], bot: true, personality: p.id,
      cash: settings.startingCash, pos: 0, jailed: false, jailTurns: 0,
      doubles: 0, alive: true, portfolio: {}, getOut: 0, lastDelta: 0, divTotal: 0
    });
  });

  const state = {
    settings, rules, rng,
    players,
    current: 0,
    round: 1,
    phase: MM.PHASES.LOBBY,
    dice: { a: 1, b: 1, sum: 2, isDouble: false, rolled: false },
    ownership: {},          /* tileIndex → playerId          */
    piles: {},              /* shuffled card piles           */
    houses: {},             /* tileIndex → 0–5 (5 = hotel)   */
    mortgaged: {},          /* tileIndex → true              */
    stocks: MM.STOCKS.map((s) => Object.assign({}, s, { open: s.price, prev: s.price, base: s.price })),
    vacationPot: 0,
    headline: null,
    log: [],
    chat: [],
    room: "room-" + Math.random().toString(36).slice(2, 7)
  };

  MM.market.init(state);
  MM.state = state;
  return state;
};

/* ── lookups ─────────────────────────────── */
MM.currentPlayer = (s) => s.players[s.current];
MM.playerById = (s, id) => s.players.find((p) => p.id === id);
MM.livePlayers = (s) => s.players.filter((p) => p.alive);
MM.ownerOf = (s, tileIndex) =>
  s.ownership[tileIndex] === undefined ? null : MM.playerById(s, s.ownership[tileIndex]);
MM.tilesOf = (s, playerId) =>
  Object.keys(s.ownership)
    .filter((k) => s.ownership[k] === playerId)
    .map((k) => MM.BOARD[+k]);

MM.portfolioValue = function (s, player) {
  return s.stocks.reduce((t, st) => t + (player.portfolio[st.sym] || 0) * st.price, 0);
};

MM.netWorth = function (s, player) {
  let w = player.cash + MM.portfolioValue(s, player);
  MM.tilesOf(s, player.id).forEach((t) => {
    w += s.mortgaged[t.i] ? (t.price || 0) / 2 : t.price || 0;
    const h = s.houses[t.i] || 0;
    if (h && t.group) w += h * MM.GROUPS[t.group].house;
  });
  return w;
};

/* ── mutations ───────────────────────────── */
MM.setPhase = function (s, phase) {
  s.phase = phase;
  MM.bus.emit("phase", phase);
};

MM.credit = function (s, player, amount, reason) {
  player.cash += amount;
  player.lastDelta = amount;
  MM.bus.emit("cash", { player, amount, reason });
  MM.bus.emit("state", s);
  return amount;
};

MM.debit = (s, player, amount, reason) => MM.credit(s, player, -amount, reason);

/* The settlement path — every debt goes through here. A player who is short
   sells buildings and mortgages deeds first; if that still isn't enough,
   whatever is left goes to the creditor and they're out. `to` null = the bank. */
MM.pay = function (s, from, to, amount, reason) {
  if (amount <= 0 || !from.alive) return 0;

  if (from.cash < amount) MM.prop.raiseCash(s, from, amount);

  if (from.cash < amount) {
    const left = Math.max(0, from.cash);
    if (left > 0) {
      MM.debit(s, from, left, reason);
      if (to) MM.credit(s, to, left, reason);
    }
    MM.bankrupt(s, from, to, reason);
    return left;
  }

  MM.debit(s, from, amount, reason);
  if (to) MM.credit(s, to, amount, reason);
  return amount;
};

MM.bankrupt = function (s, debtor, creditor, reason) {
  if (!debtor.alive) return;
  debtor.alive = false;

  /* buildings always go back to the bank at half price */
  MM.tilesOf(s, debtor.id).forEach((t) => {
    const h = s.houses[t.i] || 0;
    if (h) {
      debtor.cash += h * Math.round(MM.prop.houseCost(t) / 2);
      delete s.houses[t.i];
    }
  });

  /* shares transfer with the estate; to the bank they simply vanish */
  Object.keys(debtor.portfolio).forEach((sym) => {
    const qty = debtor.portfolio[sym];
    if (qty > 0 && creditor && creditor.alive) {
      creditor.portfolio[sym] = (creditor.portfolio[sym] || 0) + qty;
    }
    debtor.portfolio[sym] = 0;
  });

  if (creditor && creditor.alive) {
    if (debtor.cash > 0) MM.credit(s, creditor, debtor.cash, "estate");
    MM.prop.estateTo(s, debtor, creditor);
    MM.log(s, `<b>${debtor.name}</b> went bankrupt — the whole estate passes to <b>${creditor.name}</b>`, debtor);
  } else {
    MM.prop.estateTo(s, debtor, null);
    MM.log(s, `<b>${debtor.name}</b> went bankrupt${reason ? " — " + reason : ""}. The deeds return to the bank.`, debtor);
  }

  debtor.cash = 0;
  MM.market.onBankrupt(s);
  MM.bus.emit("bankrupt", { debtor, creditor });
  MM.bus.emit("state", s);
};

MM.log = function (s, html, player) {
  const entry = { html, hex: player ? player.hex : null, t: Date.now() };
  s.log.push(entry);
  if (s.log.length > 60) s.log.shift();
  MM.bus.emit("log", entry);
};

MM.chat = function (s, name, text, hex) {
  const entry = { name, text, hex: hex || "#4e97ff" };
  s.chat.push(entry);
  MM.bus.emit("chat", entry);
};

/* the tape moves through the exchange now — see core/market.js */
MM.driftMarket = (s) => MM.market.tick(s);
