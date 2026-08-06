# MonoMoney.io

A browser board game where the board is only half the economy. Forty tiles, two dice,
a bot for every empty seat — and a stock exchange running alongside the rents. Play
solo against the bots, or open a room and split the seats with actual people.

Vanilla HTML5 Canvas, CSS and JavaScript. No frameworks, no build step to play solo.

## Run it

```bash
npx serve .          # or: python3 -m http.server
```

Open `index.html`. That's it — the scripts are plain `<script>` tags in load order.

To produce the single-file shareable build:

```bash
node tools/build-artifact.mjs   # → dist/monomoney.html
```

## What works today (V4.1)

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
- **The exchange** — buy and sell shares in five listed companies from the Market
  tab, each with a sparkline and a full price chart. Dividends pay out every lap
  past START.
- **Prices that mean something** — twelve headlines move a company or the whole
  tape, four insider cards sit in the decks, and fundamentals pull prices toward
  what's actually happened on the board: airports lift SKY, utilities lift VLT,
  houses lift BRK, cash in play lifts AUR. Your own orders nudge the price too.
- **Table UI** — blue trading-floor palette, player rail with balances and holdings,
  a property manager for building and mortgaging, event log, chat, and the market tape.

- **Four bot brains** — every decision (buy, bid, build, trade) reads the
  personality's weights, so the Tycoon builds while the Banker compounds and the
  Shark pays over the odds to deny you a set. Bot skill scales their cushion and
  their conviction.
- **Trades** — build a bundle of cash, deeds and shares from the Trades tab and put
  it to any bot. Every bot values the offer through its own personality: the Banker
  overpays for yield, the Shark won't hand over a set-completing tile for less than
  triple its price. Bots occasionally offer to buy a property from you too, priced
  by who's asking and how badly they want it.
- **Dashboard** — a net-worth line for every player, round by round, plus a
  cash / property / shares / rent breakdown. Opens from the rail or the game-over
  screen, which now shows final standings and a chart the moment the game ends.
- **A calmer pace** — every pause in a turn runs about 40% longer: landing on a
  tile, a bot deciding whether to buy, staying in prison, the gap before the next
  player. The dice tumble a full second before settling, tokens step across the
  board more slowly, and bots take longer to act, scaled by bot skill.
- **Built for phones** — the board fills the screen width and stays pinned to the
  top as you scroll, instead of being capped at a fixed 320px square. Tapping a
  tile shows the same price/rent card hover does on desktop. Player list and the
  Market/Properties/Trades tabs sit right below the board; chat moved down. Every
  button, tab and toggle sizes up to a real touch target on a touchscreen, and
  text inputs no longer trigger iOS's zoom-on-focus.
- **Know your stock** — an ⓘ next to every listing (and another in its trade
  panel) opens what actually moves that price: sector, dividend yield, a plain
  volatility read, the fundamental driver behind it, and every headline or
  insider card that can swing it, all pulled live from the same data the market
  runs on.
- **Play with friends** — create a room from the home screen and get a code, or
  join one someone sent you. Up to three other people can take the seats bots
  used to fill, seeing the same board, dice, market and chat in real time, with
  their own decisions showing up on their own screen. A dropped connection
  reconnects on its own, and anything sent while briefly offline is delivered
  once it's back rather than lost. Needs a small relay server to actually
  connect two devices — see `server/README.md`.
- **Trade with anyone** — the Trades tab lists every live player now, not just
  bots. A person gets asked on their own screen, the same accept/decline card a
  bot's own offers use; proposing shows an immediate "offer sent" note and the
  eventual answer lands in the event log.

The full working / coming list lives in `src/data/versions.js` and is rendered
in-game: **Build status** in the lobby rail, or *See what works today* on the
home screen. Keep that array in build order and append new releases to the end —
`MM.changelog()` reverses the shipped ones so the log always reads newest first,
with what's still coming pinned below the line (hidden entirely once nothing's
queued, as it is right now).

## Roadmap

| Version | Scope | Status |
| ------- | ----- | ------ |
| V1 | Board, tile dataset, turn engine, dice, prison, taxes | ✅ Working |
| V1.1 | Blue palette, version naming, in-game build status | ✅ Working |
| V1.5 | Buying, rent, colour sets, houses/hotels, mortgages, auctions, cards, bankruptcy | ✅ Working |
| V2 | The exchange: trading, price shocks, dividends every lap | ✅ Working |
| V2.0.1 | Changelog reads newest first | ✅ Working |
| V2.5 | Bot personalities make their own property and portfolio calls | ✅ Working |
| V3 | Trades and a net-worth dashboard | ✅ Working |
| V3.0.1 | Slower, more readable turn pacing | ✅ Working |
| V3.1 | Built for phones — a bigger board, real touch targets, tap-to-inspect | ✅ Working |
| V3.2 | Know your stock — an info icon explaining what moves each price | ✅ Working |
| V4 | Play with friends — real rooms, real people in the seats bots used to fill | ✅ Working |
| V4.1 | Trade with anyone, a sturdier reconnect, a confirmed Bankrupt button | ✅ Working |

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
  data/market-events.js the headlines that move the tape
  core/rng.js           seedable RNG — same seed, same game
  core/emitter.js       event bus
  core/state.js         game state, every mutation, net-worth snapshots
  net/net.js            the only file that knows a seat might be networked
  core/dice.js          dice rolls
  core/market.js        the exchange: pricing, trading, dividends, fundamentals
  core/property.js      deeds: buying, rent, building, mortgaging, forced sales
  core/cards.js         drawing and resolving cards
  core/bots.js          the four personalities: buying, bidding, building, trading
  core/auction.js       ascending auction for a declined deed
  core/trades.js        player-to-player trades: valuation, evaluation, execution
  core/turn.js          the turn state machine
  render/geometry.js    index → rectangle, index → token anchor
  render/icons.js       vector tile icons
  render/board-renderer.js  canvas painting, token movement, tooltips
  ui/dice-ui.js         the pair of dice
  ui/deal.js            deed offers, card faces, auction and trade prompts
  ui/market-ui.js       the Market tab: listings, charts and the trade panel
  ui/trade-ui.js        the Trades tab: partner picker and bundle composer
  ui/dashboard-ui.js    net-worth chart and breakdown, shared with game-over
  ui/panels.js          rails, log, chat, market tape
  ui/screens.js         screen switching and modals
  main.js               bootstrap and wiring
tools/build-artifact.mjs  bundles everything into one HTML file
server/relay.mjs        optional — the WebSocket relay that makes rooms work
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
| 🎩 The Tycoon | Buys almost anything, keeps only $100 back, pours everything into buildings — sells shares to fund a hotel, never buys them |
| 🏦 The Banker | Keeps a $500 cushion, buys the fattest dividend up to 40% of net worth, holds it |
| 🦈 The Shark | Pays over the odds for the tile that denies you a set; buys the dips, takes profits above +12% |
| 🃏 The Wildcard | Coin-flips both halves of the game — 90% buy rate on the board, random dumps on the tape |

Weights live in `src/data/rules.js` and are the whole brain: `core/bots.js` reads
nothing else. `style` picks the trading behaviour (`none` / `income` / `momentum` /
`random`), and the **Bot skill** setting scales the cushion each one keeps and how
often it second-guesses a buy.

Measured over a self-playing 24-round game: the Tycoon finished with 6 houses and
no shares, the Banker with 21 shares and $376 of dividends, the Shark holding
seven deeds it mostly bought to block, the Wildcard with the deeds and nothing
else.

## The exchange

Five companies trade alongside the board — SKY (airports), VLT (utilities),
BRK (property), TCH (technology, high volatility) and AUR (finance, high dividend).
Each price is pulled by three forces: **fundamentals** (what's been built and
bought on the board), **headlines** (random events and insider cards), and **flow**
(the price impact of orders, including yours). Dividends pay every lap past START,
and shares are the first thing sold when someone can't cover a debt.

Identity colours for the five listings come from the validated categorical palette
and are in a fixed order — reordering them fails the colour-blindness checks.

## Trades

A bundle is cash, deeds and shares in one offer — `{ cash, tiles: [...], shares: {...} }`.
Only bare tiles (no houses) can go on the table. `core/trades.js` prices a bundle
twice: `marketValue()` for what the bank would pay, and `personalValue()` for what
it's worth to the specific bot on the other side of the table, using the same
`weights` that drive its buying and building.

A bot's one hard rule sits outside the value math: handing over the last tile of a
colour group to whoever's asking gets a 1.7×–3× cost penalty depending on how much
the bot cares about blocking (`weights.block`) — checked against the whole bundle at
once, so splitting two set-completing tiles across one trade doesn't slip past it.
Everything else nets out to a margin-over-threshold decision, the threshold set by
risk appetite and bot skill.

Bots also initiate one canonical offer of their own: cash for the single tile they
need to complete a set, if you own it. Frequency and premium both come from
personality — the Shark asks often and pays well over price; the Banker rarely
bothers.

A live human partner skips the value math entirely — `core/trades.js`'s
`proposeToHuman()` just asks them, through the exact same `MM.net.ask()` seat-
routed prompt every other decision in the game already uses, and shows the
answer in `MM.deal.humanTradeOffer()`, a read-only mirror of the composer's own
bundle summary. Since a person's answer isn't instant the way a bot's is, the
proposer's own screen shows an immediate "offer sent" note rather than a
resolved result, and the eventual accept or decline surfaces through the event
log instead — the same place a bot's answer already gets logged.

## Net worth

`MM.snapshotWorth()` records every player's net worth once at kickoff and once per
completed round, feeding a shared line chart used by both the Dashboard button and
the game-over screen. Player identity colours are reused as-is, not freshly chosen —
they already mean "this player" everywhere else on the table (token, avatar, chat),
so the chart draws on an encoding that exists rather than inventing a new one.

## Phones

The board's size used to come from `.board-wrap { flex: 1 }` filling whatever
vertical space its flex column had left — true on desktop, where the layout fills
the viewport, but meaningless once the phone breakpoint drops that column to
`height: auto` so the page can scroll instead. With no real space to fill, the
renderer's own `Math.max(320, …)` floor was the only thing stopping the board from
collapsing, and it fired every time: the board was hard-capped at 320px on every
phone regardless of screen size. Below `640px` `.board-wrap` switches to
`aspect-ratio: 1` instead, so its height comes from its width — a dimension the
grid actually constrains — and the board now uses the full screen width on
anything from an iPhone SE to a Pro Max.

`.table-main` (ticker + board + dice/log) is `position: sticky; top: 0` on that
same breakpoint, so it's still in view while the player list, market and
properties — what you're actually reaching for between rolls — scroll underneath
it. Chat and the share-link card, both lower priority once a game is running,
moved below those in the stacking order.

There's no hover on a touchscreen, so `board-renderer.js` binds `touchstart`/
`touchend` alongside the existing `mousemove` and shows the same tile tooltip on a
tap, held open for a few seconds rather than requiring continuous contact. A tap
that turns out to be the start of a scroll (moved more than 12px) is left alone,
so swiping the sticky board out of the way still works.

Touch-target sizing lives under `@media (pointer: coarse)` rather than a width
breakpoint — it's a touch laptop or a tablet in a wide window that needs a bigger
switch or tab just as much as a phone does, regardless of how much horizontal
space happens to be available.

## Multiplayer

Every piece of this game — the turn engine, the bots, the market — was written
as if seat 0 is always the one local human. Rather than rewrite all of that to
be aware of a network, `src/net/net.js` is the one seam: whoever creates a room
runs the entire simulation in their own browser, exactly like a solo game
always has, and every other connected browser is a thin view that sends its
intent (roll, buy, bid, trade) to be applied there for real. `MM.bus` already
announces every mutation the engine makes, so replicating a game to every
connected screen is just forwarding those same events over the wire — the
renderer, the panels and the sound effects need no networking awareness of
their own on either side.

Two shapes of message cover everything a person can do. `MM.net.ask()` is an
awaited decision — buy this deed? bid this much? — that already just shows a
modal and resolves a promise on click; networked, the *same* call shows the
*same* modal, just on the deciding player's own screen, with the click sent
back over the wire instead of resolved on the spot. `MM.net.act()` is a
fire-and-forget intent — roll, build, chat — that a guest can't apply to its
own mirrored copy of the state, so it's sent to whoever's actually running the
game to apply instead.

`server/relay.mjs` is deliberately dumb: it tracks which connection is which
seat in which room and forwards messages between them, and never once reads a
rule of the game — the whole simulation still lives in exactly one browser.
See `server/README.md` to run one locally or deploy it for real. A sandboxed
preview link (an `Artifact` share URL, for instance) blocks outbound
WebSocket connections for security, so **Play with friends** only works once
the game is actually hosted somewhere you control, alongside a relay you or
someone else is running.

A seat's identity colour and avatar come from its position, not from whether
a bot or a person is sitting in it (`MM.SEAT_META` in `core/state.js`) — a
human taking over the seat the Banker would have filled shows up in the
Banker's teal, not a freshly invented colour, so "seat 2 is teal" stays true
all game. Not yet built: trading directly with another connected person (the
Trades tab still only offers a bundle to a bot), and a seat that goes quiet
doesn't hand itself to a bot — the table just waits for it to come back,
which it can, with the same room code and a persisted client id reclaiming
the same seat.
