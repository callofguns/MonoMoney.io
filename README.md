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

## What's built (Phase 1)

- **40-tile board** rendered on canvas: 8 colour groups, 4 airports, 2 utilities,
  2 taxes, Surprise and Treasure tiles, and the four corners (START, In Prison,
  Vacation, Go to Prison). Tiles rotate per side; hovering one shows its price and
  rent ladder.
- **Turn state machine** — `awaiting-roll → rolling → moving → resolving → turn-end`,
  with the human first and three bots auto-playing behind them.
- **Dice** — two d6, doubles grant another roll, three doubles sends you to prison.
  Prison costs three turns or $50 bail; doubles get you out early.
- **Money already moves** — START salary, both taxes, and the vacation pot that
  taxes feed into.
- **Table UI** — player rail with live balances, event log, chat, and the market
  tape above the board.

Purchases, rent and buildings land in Phase 2 — landing on an unclaimed tile
currently just reports its price.

## Roadmap

| Phase | Scope |
| ----- | ----- |
| 1 ✅ | Board, tile dataset, turn engine, dice, prison, taxes |
| 2 | Buying, rent, colour sets, houses/hotels, mortgages, auctions |
| 3 | The exchange: orders, price shocks, dividends on every lap |
| 4 | Bot personalities make their own property and portfolio calls |
| 5 | Trades, financial dashboard, animation polish |

## Layout

```
index.html              app shell — home, lobby and table screens
assets/css/
  theme.css             design tokens, base type, wordmark
  layout.css            screens and the three-column table shell
  components.css        cards, buttons, fields, rails, modal
  board.css             ticker, board wrap, centre console, dice
src/
  data/board.js         the 40 tiles, colour groups, rent tables
  data/rules.js         house rules, bot personalities, listed companies
  core/rng.js           seedable RNG — same seed, same game
  core/emitter.js       event bus
  core/state.js         game state and every mutation that touches it
  core/dice.js          dice rolls
  core/turn.js          the turn state machine
  render/geometry.js    index → rectangle, index → token anchor
  render/icons.js       vector tile icons
  render/board-renderer.js  canvas painting, token movement, tooltips
  ui/dice-ui.js         the pair of dice
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

Personalities and their weights are declared in `src/data/rules.js`; Phase 4 reads
them to make decisions.

## The exchange

Five companies trade alongside the board — SKY (airports), VLT (utilities),
BRK (property), TCH (technology, high volatility) and AUR (finance, high dividend).
Prices drift on the tape today; Phase 3 wires them to development on the board,
to Surprise cards, and to dividends paid every lap past START.
