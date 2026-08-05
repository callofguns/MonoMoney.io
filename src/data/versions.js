/* ═══════════════════════════════════════════
   Release ladder
   One entry per update. `status` drives the whole
   build-status UI, so adding a release here is all
   it takes to update what the game reports.
     shipped → playable right now
     next    → being built
     planned → queued
   ═══════════════════════════════════════════ */
window.MM = window.MM || {};

MM.VERSION = "V1.5";

MM.RELEASES = [
  {
    v: "V1", name: "Board & dice", status: "shipped",
    items: [
      "40-tile board with all 8 colour groups, airports, utilities and corners",
      "Two dice with doubles, and three doubles sending you to prison",
      "Turn engine: you play first, three bots play themselves",
      "Token movement, prison cell, bail and the just-passing lane",
      "START salary of $200 every lap",
      "Earnings Tax, Premium Tax and the vacation pot they feed",
      "Hover any tile for its price and full rent ladder",
      "Event log, chat, player balances and the live market tape"
    ]
  },
  {
    v: "V1.1", name: "Blue table & build status", status: "shipped",
    items: [
      "Whole table recoloured to a blue palette",
      "Updates numbered V1, V1.5, V2 instead of phases",
      "Build-status list in the lobby and on the home screen",
      "Tax tiles and player rows fixed after the first round of testing"
    ]
  },
  {
    v: "V1.5", name: "Property & rent", status: "shipped",
    items: [
      "Buy the tile you land on from a deed card showing its full rent ladder",
      "Rent collection, doubled on a completed colour group",
      "Airport rent that scales with how many you hold, utilities that scale with the dice",
      "Houses and hotels, built evenly across a set, shown on the board",
      "Mortgage for half the price, lift it later for 10% more",
      "Auctions when a deed is declined — you bid against the bots",
      "28 Surprise and Treasure cards: moves, fines, repairs, get-out-of-prison",
      "Short of cash? Buildings sell and deeds mortgage automatically before you fold",
      "Bankruptcy hands your whole estate to whoever broke you",
      "Baseline bot buying and building (personalities arrive in V2.5)"
    ]
  },
  {
    v: "V2", name: "The exchange", status: "next",
    items: [
      "Buy and sell shares in all five companies from the Market tab",
      "Dividends paid on every lap past START",
      "Prices that move on market events and Surprise cards",
      "Building on the board lifting the company that owns the sector",
      "Portfolio value folded into net worth"
    ]
  },
  {
    v: "V2.5", name: "Bot brains", status: "planned",
    items: [
      "The Tycoon buys and builds relentlessly",
      "The Banker hoards dividend stock and a cash buffer",
      "The Shark blocks monopolies and times volatile sells",
      "The Wildcard splits its bankroll on a coin flip",
      "Bot skill setting that actually sharpens their decisions"
    ]
  },
  {
    v: "V3", name: "Trades & dashboard", status: "planned",
    items: [
      "Player-to-player trades of cash, property and shares",
      "Live auctions when a property is declined",
      "Financial dashboard: net worth, holdings and rent income over time",
      "Win conditions, end-of-game summary and a rematch button"
    ]
  }
];

MM.STATUS_LABEL = { shipped: "Working", next: "Building next", planned: "Planned" };

MM.currentRelease = () => MM.RELEASES.find((r) => r.v === MM.VERSION);
MM.releasesBy = (status) => MM.RELEASES.filter((r) => r.status === status);
