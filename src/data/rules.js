/* ═══ settings, personalities and the listed companies ═══ */
window.MM = window.MM || {};

/* Toggleable house rules. `phase` marks which build phase switches them on;
   anything past Phase 1 is shown but locked so the lobby reads honestly. */
MM.RULE_DEFS = [
  { id: "doubleRent", ico: "🪙", name: "x2 rent on full sets",
    desc: "Owning every tile in a colour group doubles the base rent", on: true, phase: 2 },
  { id: "vacationCash", ico: "🏝", name: "Vacation cash",
    desc: "Taxes and fees pile up on Vacation for whoever lands there", on: true, phase: 2 },
  { id: "auction", ico: "🔨", name: "Auction",
    desc: "A declined property goes to the highest bidder instead", on: false, phase: 2 },
  { id: "noRentInPrison", ico: "🚔", name: "No rent while in prison",
    desc: "Jailed owners collect nothing on their properties", on: false, phase: 2 },
  { id: "mortgage", ico: "🏦", name: "Mortgage",
    desc: "Raise 50% of a tile's cost, but stop earning rent on it", on: true, phase: 2 },
  { id: "evenBuild", ico: "🏘", name: "Even build",
    desc: "Houses go up and come down evenly across a set", on: true, phase: 2 },
  { id: "dividends", ico: "📊", name: "Dividends on GO",
    desc: "Passing START pays out on every share you hold", on: true, phase: 3 },
  { id: "insiderCards", ico: "🃏", name: "Insider Surprise cards",
    desc: "Some Surprise cards move a company's share price", on: true, phase: 3 }
];

/* Bot personalities — Phase 4 reads `weights`, Phase 1 only shows them off. */
MM.PERSONALITIES = [
  {
    id: "tycoon", tag: "Buys everything", name: "The Tycoon", avatar: "🎩", color: "var(--p2)",
    blurb: "Buys everything, builds fast, sells shares only to fund concrete.",
    weights: { buyProperty: 0.95, build: 0.9, buyStock: 0.1, cashFloor: 100, riskAppetite: 0.8 }
  },
  {
    id: "banker", tag: "Dividend hunter", name: "The Banker", avatar: "🏦", color: "var(--p3)",
    blurb: "Loads up on high-dividend stock early and sits on a fat cash buffer.",
    weights: { buyProperty: 0.5, build: 0.4, buyStock: 0.85, cashFloor: 500, riskAppetite: 0.25 }
  },
  {
    id: "shark", tag: "Monopoly blocker", name: "The Shark", avatar: "🦈", color: "var(--p4)",
    blurb: "Blocks monopolies, trades hard, cashes out volatility to raise hotels.",
    weights: { buyProperty: 0.75, build: 0.7, buyStock: 0.6, cashFloor: 300, riskAppetite: 0.65 }
  },
  {
    id: "wildcard", tag: "Coin-flip investor", name: "The Wildcard", avatar: "🃏", color: "var(--p5)",
    blurb: "Splits the bankroll between whatever it just landed on and a hot ticker.",
    weights: { buyProperty: 0.6, build: 0.5, buyStock: 0.7, cashFloor: 50, riskAppetite: 1 }
  }
];

/* The five listed companies. Phase 3 turns these into a live order book. */
MM.STOCKS = [
  { sym: "SKY", name: "Skyline Air Group", sector: "Airports",  color: "#3fa9ff",
    price: 120, yield: 0.05, vol: 0.05 },
  { sym: "VLT", name: "Voltaic Power",     sector: "Utilities", color: "#ffc24b",
    price: 95,  yield: 0.06, vol: 0.04 },
  { sym: "BRK", name: "Brickstone Realty", sector: "Property",  color: "#ff8a5c",
    price: 150, yield: 0.03, vol: 0.06 },
  { sym: "TCH", name: "Helix Tech",        sector: "Technology",color: "#a06bff",
    price: 210, yield: 0.01, vol: 0.11 },
  { sym: "AUR", name: "Aurum Bank",        sector: "Finance",   color: "#3dd68c",
    price: 80,  yield: 0.08, vol: 0.03 }
];

MM.VOLATILITY = { calm: 0.5, normal: 1, wild: 2.1 };

MM.DEFAULT_SETTINGS = {
  players: 4,
  startingCash: 1500,
  botSkill: "normal",
  volatility: "normal",
  botDelay: 900
};

/* Canned bot chatter — flavour only, keyed to what just happened. */
MM.BOT_LINES = {
  greet:    ["good luck all", "let's trade", "may the dice be kind", "easy money"],
  double:   ["doubles again 😎", "the dice like me", "one more"],
  jail:     ["ugh, prison", "someone post my bail", "this is a setup"],
  passGo:   ["dividend day", "salary secured", "another lap, another payout"],
  bigMoney: ["cash is king", "I'll take it", "noted."]
};
