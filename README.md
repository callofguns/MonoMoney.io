# MonoMoney.io

A browser board game where the board is only half the economy. Forty tiles, two dice,
three bots — and a stock exchange running alongside the rents.

Vanilla HTML5 Canvas, CSS and JavaScript. No frameworks, no build step to play.

## Run it

```bash
npx serve .          # or: python3 -m http.server
```

Open `index.html`. That's it — the scripts are plain `<script>` tags in load order.

To produce the single-file shareable build:

```bash
node tools/build-artifact.mjs   # → dist/monomoney.html
```

## What works today (V1.5)

- **40-tile board** rendered on canvas: 8 colour groups, 4 airports, 2 utilities,
  2 taxes, Surprise and Treasure tiles, and the four corners (START, In Prison,
  Vacation, Go to Prison). Hovering a tile shows its price and rent ladder.
- **Turn state machine** — `awaiting-roll → rolling → moving → resolving → turn-end`,
  with the human first and three bots auto-playing behind them.
- **Dice** — two d6, doubles grant another roll, three doubles sends you to prison.
  Prison costs three turns or $50 bail; doubles or a kept card get you out early.
- **Property** — land on an unclaimed deed and a card offers it to you, showing the
  whole rent ladder. Decline it and (with the rule on) it goes to auction, where you
  bid against the bots.
- **Rent** — base rent, doubled on a completed colour group, scaled by buildings.
  Airports pay by how many you hold; utilities pay a multiple of the dice.
- **Buildings** — houses and hotels, built evenly across a set, drawn on the board.
- **Mortgages** — raise half the price, lift it later for 10% more; a mortgaged tile
  pays no rent.
- **Cards** — 28 Surprise and Treasure cards: moves, fines, collections, per-building
  repairs and get-out-of-prison.
- **Bankruptcy** — a player who's short sells buildings and mortgages deeds first;
  if that isn't enough their whole estate passes to whoever broke them.
- **Table UI** — blue trading-floor palette, player rail with balances and holdings,
  a property manager for building and mortgaging, event log, chat, and the market tape.

Bots use one shared baseline brain for now (buy what they can afford, build on
completed sets). The four personalities take over in **V2.5**.

The full working / coming list lives in `src/data/versions.js` and is rendered
in-game: **Build status** in the lobby rail, or *See what works today* on the
home screen. Add a release there and the UI updates itself.

## Roadmap

| Version | Scope | Status |
| ------- | ----- | ------ |
| V1 | Board, tile dataset, turn engine, dice, prison, taxes | ✅ Working |
| V1.1 | Blue palette, version naming, in-game build status | ✅ Working |
| V1.5 | Buying, rent, colour sets, houses/hotels, mortgages, auctions, cards, bankruptcy | ✅ Working |
| V2 | The exchange: trading, price shocks, dividends every lap | Building next |
| V2.5 | Bot personalities make their own property and portfolio calls | Planned |
| V3 | Trades, auctions, financial dashboard | Planned |

## Layout

```
index.html              app shell — home, lobby and table screens
assets/css/
  theme.css             design tokens, base type, wordmark
  layout.css            screens and the three-column table shell
  components.css        cards, buttons, fields, rails, modal
  board.css             ticker, board wrap, centre console, dice
src/
  data/versions.js      the release ladder that drives the build-status UI
  data/board.js         the 40 tiles, colour groups, rent tables
  data/rules.js         house rules, bot personalities, listed companies
  data/cards.js         the Surprise and Treasure decks
  core/rng.js           seedable RNG — same seed, same game
  core/emitter.js       event bus
  core/state.js         game state and every mutation that touches it
  core/dice.js          dice rolls
  core/property.js      deeds: buying, rent, building, mortgaging, forced sales
  core/cards.js         drawing and resolving cards
  core/bots.js          baseline bot decisions (V2.5 replaces this)
  core/auction.js       ascending auction for a declined deed
  core/turn.js          the turn state machine
  render/geometry.js    index → rectangle, index → token anchor
  render/icons.js       vector tile icons
  render/board-renderer.js  canvas painting, token movement, tooltips
  ui/dice-ui.js         the pair of dice
  ui/deal.js            deed offers, card faces and auction bidding
  ui/panels.js          rails, log, chat, market tape
  ui/screens.js         screen switching and modals
  main.js               bootstrap and wiring
tools/build-artifact.mjs  bundles everything into one HTML file
```

### How the modules talk

State lives in `MM.state` and only changes through functions in `core/state.js`,
each of which announces itself on `MM.bus`. The renderer and the panels subscribe;
neither reaches into the other. `core/turn.js` drives the game and `await`s the
renderer for movement, so animation timing and game logic stay in step without
either owning the other.

## Bot personalities

| Bot | Plays like |
| --- | ---------- |
| 🎩 The Tycoon | Buys everything, builds fast, sells shares only to fund concrete |
| 🏦 The Banker | High-dividend stock early, fat cash buffer, patient |
| 🦈 The Shark | Blocks monopolies, trades hard, times volatility to raise hotels |
| 🃏 The Wildcard | Splits the bankroll between the tile it just hit and a hot ticker |

Personalities and their weights are declared in `src/data/rules.js`; V2.5 reads
them to make decisions.

## The exchange

Five companies trade alongside the board — SKY (airports), VLT (utilities),
BRK (property), TCH (technology, high volatility) and AUR (finance, high dividend).
Prices drift on the tape today; V2 wires them to development on the board,
to Surprise cards, and to dividends paid every lap past START.
