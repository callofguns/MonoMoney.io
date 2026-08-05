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

MM.VERSION = "V3.2";

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
    v: "V2", name: "The exchange", status: "shipped",
    items: [
      "Buy and sell shares in all five companies from the Market tab",
      "Dividends paid every time you pass START",
      "Price charts: a sparkline per listing, a full chart in the trade panel",
      "Twelve market headlines that move a company or the whole tape",
      "Four insider cards in the decks that move a share price",
      "Fundamentals: airports lift SKY, utilities lift VLT, houses lift BRK, cash in play lifts AUR",
      "Your own orders nudge the price — big trades cost you",
      "Shares sell before deeds get mortgaged when you're short",
      "Portfolio value and dividends folded into net worth"
    ]
  },
  {
    v: "V2.0.1", name: "Changelog order", status: "shipped",
    items: [
      "The update log now reads newest first, oldest at the bottom",
      "What's still being built sits below the line, in the order it'll arrive"
    ]
  },
  {
    v: "V2.5", name: "Bot brains", status: "shipped",
    items: [
      "The Tycoon buys almost anything and pours every spare dollar into buildings — it will sell shares to fund a hotel",
      "The Banker keeps a $500 cushion, buys the fattest dividend and holds it",
      "The Shark pays over the odds to deny you your last tile, and trades the dips",
      "The Wildcard coin-flips its way through both the board and the tape",
      "Bot skill now bites: casual keeps a bigger cushion and second-guesses, ruthless commits",
      "Auction limits follow personality — risk appetite, set-completion and blocking all move the ceiling",
      "Cost basis tracked per holding, so bots take profits and you see your P/L",
      "Bots say something when they do something characteristic"
    ]
  },
  {
    v: "V3", name: "Trades & dashboard", status: "shipped",
    items: [
      "Trades tab: build a bundle of cash, deeds and shares and put it to any bot",
      "Bots value every offer through their own personality — the Banker overpays for yield, the Shark won't hand over a set-completing tile for less than triple",
      "Bots occasionally offer to buy a property from you too, priced by who's asking",
      "Dashboard: a net-worth line for every player, round by round, plus a cash/property/shares/rent breakdown",
      "Game over now ends on a proper screen — final standings, a net-worth chart and a Play again button",
      "Rent collected per player tracked all game, shown on the dashboard"
    ]
  },
  {
    v: "V3.0.1", name: "Slower pace", status: "shipped",
    items: [
      "Every pause in a turn runs ~40% longer — landing on a tile, a bot deciding to buy, staying in prison, the gap before the next player",
      "Bots take longer to act on their turn, scaled by bot skill",
      "The dice tumble for a full second before settling",
      "Tokens now step across the board more slowly",
      "Auction bids and bot card reveals hold a beat longer too"
    ]
  },
  {
    v: "V3.1", name: "Built for phones", status: "shipped",
    items: [
      "The board itself was the problem: it was capped at 320px on a phone regardless of screen size — now it fills the width, sticks to the top of the screen as you scroll, and stays legible on anything from an iPhone SE to a Pro Max",
      "No hover on a touchscreen, so tapping a tile now shows the same price-and-rent card hover does on desktop",
      "Player list, actions and the Market/Properties/Trades tabs now come right after the board — chat and the share link moved below them",
      "Every button, tab and toggle sized up to a real touch target on a touchscreen, independent of screen width",
      "Text inputs no longer trigger iOS's zoom-on-focus",
      "No more 300ms tap delay or the grey flash Android/iOS show on every button press",
      "A widescreen table (net worth, game over) fades at the edge to signal it scrolls sideways, instead of just clipping"
    ]
  },
  {
    v: "V3.2", name: "Know your stock", status: "shipped",
    items: [
      "An ⓘ next to every listing in the Market tab, and another in its trade panel, opens what actually moves that stock",
      "Sector, dividend yield and a plain volatility read (low/medium/high) for all five companies",
      "The fundamental driver behind each price, in plain language — airports for SKY, utilities for VLT, buildings for BRK, cash on hand for AUR, and why TCH has none and runs on headlines alone",
      "Every headline and insider card that can move that specific stock, pulled live from the same data the market runs on — so the explanation can never drift out of sync with the game",
      "A note on order flow and random drift, so the price bar makes sense even on a quiet round"
    ]
  }
];

MM.STATUS_LABEL = { shipped: "Working", next: "Building next", planned: "Planned" };

MM.currentRelease = () => MM.RELEASES.find((r) => r.v === MM.VERSION);
MM.releasesBy = (status) => MM.RELEASES.filter((r) => r.status === status);

/* Reading order for the changelog: what shipped, newest first — then what's
   still coming, in the order it will arrive. RELEASES itself stays in build
   order, so a new entry only ever gets appended in the right place. */
MM.changelog = () => ({
  shipped: MM.releasesBy("shipped").slice().reverse(),
  upcoming: MM.RELEASES.filter((r) => r.status !== "shipped")
});
