/* ═══ settings, personalities and the listed companies ═══ */
window.MM = window.MM || {};

/* Toggleable house rules. `since` is the release that switches a rule on;
   anything later than the current build is shown but inert, so the lobby
   never promises more than the game does. */
MM.RULE_DEFS = [
  { id: "doubleRent", ico: "🪙", name: "x2 rent on full sets",
    desc: "Owning every tile in a colour group doubles the base rent", on: true, since: "V1.5" },
  { id: "vacationCash", ico: "🏝", name: "Vacation cash",
    desc: "Taxes and fees pile up on Vacation for whoever lands there", on: true, since: "V1.5" },
  { id: "auction", ico: "🔨", name: "Auction",
    desc: "A declined property goes to the highest bidder instead", on: false, since: "V1.5" },
  { id: "noRentInPrison", ico: "🚔", name: "No rent while in prison",
    desc: "Jailed owners collect nothing on their properties", on: false, since: "V1.5" },
  { id: "mortgage", ico: "🏦", name: "Mortgage",
    desc: "Raise 50% of a tile's cost, but stop earning rent on it", on: true, since: "V1.5" },
  { id: "evenBuild", ico: "🏘", name: "Even build",
    desc: "Houses go up and come down evenly across a set", on: true, since: "V1.5" },
  { id: "dividends", ico: "📊", name: "Dividends on GO",
    desc: "Passing START pays out on every share you hold", on: true, since: "V2" },
  { id: "insiderCards", ico: "🃏", name: "Insider Surprise cards",
    desc: "Some Surprise cards move a company's share price", on: true, since: "V2" },
  { id: "botTrades", ico: "🤝", name: "Bot-initiated trades",
    desc: "Bots occasionally offer to buy a property from you", on: true, since: "V3" }
];

/* Bot personalities. `weights` is the whole brain — src/core/bots.js reads
   nothing else — and `style` picks how each one treats the tape:
     none     ignores shares, sells them only to pour concrete
     income   buys the fattest dividend and sits on it
     momentum buys what's fallen, sells what's run
     random   coin-flips its way through the market  */
MM.PERSONALITIES = [
  {
    id: "tycoon", tag: "Buys everything", name: "The Tycoon", avatar: "\ud83c\udfa9", color: "var(--p2)",
    blurb: "Buys everything, builds fast, sells shares only to fund concrete.",
    weights: { buyProperty: 0.95, build: 0.9, buyStock: 0.1, cashFloor: 100,
               riskAppetite: 0.8, block: 0.4, style: "none", stockTarget: 0 },
    lines: ["another one for the portfolio", "hotels don't build themselves", "concrete beats paper"]
  },
  {
    id: "banker", tag: "Dividend hunter", name: "The Banker", avatar: "\ud83c\udfe6", color: "var(--p3)",
    blurb: "Loads up on high-dividend stock early and sits on a fat cash buffer.",
    weights: { buyProperty: 0.5, build: 0.4, buyStock: 0.85, cashFloor: 500,
               riskAppetite: 0.25, block: 0.2, style: "income", stockTarget: 0.4 },
    lines: ["dividends over dice", "compounding, quietly", "I'll keep the cash, thanks"]
  },
  {
    id: "shark", tag: "Monopoly blocker", name: "The Shark", avatar: "\ud83e\udd88", color: "var(--p4)",
    blurb: "Blocks monopolies, trades hard, cashes out volatility to raise hotels.",
    weights: { buyProperty: 0.75, build: 0.7, buyStock: 0.6, cashFloor: 300,
               riskAppetite: 0.65, block: 0.95, style: "momentum", stockTarget: 0.25 },
    lines: ["not on my board", "you needed that one, didn't you", "buying the dip"]
  },
  {
    id: "wildcard", tag: "Coin-flip investor", name: "The Wildcard", avatar: "\ud83c\udccf", color: "var(--p5)",
    blurb: "Splits the bankroll between whatever it just landed on and a hot ticker.",
    weights: { buyProperty: 0.6, build: 0.5, buyStock: 0.7, cashFloor: 50,
               riskAppetite: 1, block: 0.3, style: "random", stockTarget: 0.3 },
    lines: ["why not", "feels like a green day", "all in on a hunch"]
  }
];

/* The five listed companies. V2 turns these into a live order book. */
/* Identity colours are the first five slots of the validated categorical
   palette, in this order — swapping them around fails the CVD checks. */
MM.STOCKS = [
  { sym: "SKY", name: "Skyline Air Group", sector: "Airports",   color: "#3987e5",
    price: 120, yield: 0.05, vol: 0.05 },
  { sym: "VLT", name: "Voltaic Power",     sector: "Utilities",  color: "#d95926",
    price: 95,  yield: 0.06, vol: 0.04 },
  { sym: "BRK", name: "Brickstone Realty", sector: "Property",   color: "#199e70",
    price: 150, yield: 0.03, vol: 0.06 },
  { sym: "TCH", name: "Helix Tech",        sector: "Technology", color: "#c98500",
    price: 210, yield: 0.01, vol: 0.11 },
  { sym: "AUR", name: "Aurum Bank",        sector: "Finance",    color: "#d55181",
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
