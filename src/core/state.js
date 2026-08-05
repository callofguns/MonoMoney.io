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
    color: "var(--p1)", hex: "#8b5cf6", bot: false, personality: null,
    cash: settings.startingCash, pos: 0, jailed: false, jailTurns: 0,
    doubles: 0, alive: true, portfolio: {}, getOut: 0, lastDelta: 0
  });

  const roster = MM.PERSONALITIES.slice(0, Math.max(0, settings.players - 1));
  const hexes = { tycoon: "#ff7a45", banker: "#37c98b", shark: "#3fa9ff", wildcard: "#ff5fa2" };
  roster.forEach((p, n) => {
    players.push({
      id: n + 1, name: p.name, avatar: p.avatar,
      color: p.color, hex: hexes[p.id], bot: true, personality: p.id,
      cash: settings.startingCash, pos: 0, jailed: false, jailTurns: 0,
      doubles: 0, alive: true, portfolio: {}, getOut: 0, lastDelta: 0
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
    houses: {},             /* tileIndex → 0–5 (5 = hotel)   */
    mortgaged: {},          /* tileIndex → true              */
    stocks: MM.STOCKS.map((s) => Object.assign({}, s, { open: s.price, prev: s.price })),
    vacationPot: 0,
    log: [],
    chat: [],
    room: "room-" + Math.random().toString(36).slice(2, 7)
  };

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
  if (player.cash < 0) MM.bankrupt(s, player, reason);
  MM.bus.emit("state", s);
  return amount;
};

MM.debit = (s, player, amount, reason) => MM.credit(s, player, -amount, reason);

/* Phase 2 will force asset liquidation before this can push a player under. */
MM.transfer = function (s, from, to, amount, reason) {
  MM.debit(s, from, amount, reason);
  if (to) MM.credit(s, to, amount, reason);
  return amount;
};

MM.bankrupt = function (s, player, reason) {
  if (!player.alive) return;
  player.alive = false;
  player.cash = 0;
  Object.keys(s.ownership).forEach((k) => {
    if (s.ownership[k] === player.id) delete s.ownership[k];
  });
  MM.log(s, `<b>${player.name}</b> went bankrupt${reason ? " — " + reason : ""}`, player);
  MM.bus.emit("bankrupt", player);
};

MM.log = function (s, html, player) {
  const entry = { html, hex: player ? player.hex : null, t: Date.now() };
  s.log.push(entry);
  if (s.log.length > 60) s.log.shift();
  MM.bus.emit("log", entry);
};

MM.chat = function (s, name, text, hex) {
  const entry = { name, text, hex: hex || "#9068ff" };
  s.chat.push(entry);
  MM.bus.emit("chat", entry);
};

/* ── stock tape ──────────────────────────────
   Phase 1 only drifts prices so the ticker is alive.
   Phase 3 replaces this with event-driven repricing. */
MM.driftMarket = function (s) {
  const k = MM.VOLATILITY[s.settings.volatility] || 1;
  s.stocks.forEach((st) => {
    st.prev = st.price;
    const move = st.price * st.vol * k * s.rng.gauss() * 0.5;
    st.price = Math.max(5, Math.round((st.price + move) * 100) / 100);
  });
  MM.bus.emit("market", s.stocks);
};
