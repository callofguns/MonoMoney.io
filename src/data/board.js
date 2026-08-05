/* ═══════════════════════════════════════════════════════════
   MonoMoney.io · board dataset
   40 tiles laid out clockwise from the top-left corner:
     0  START            (top-left)
     1–9  top row        left → right
     10 In Prison        (top-right)
     11–19 right column  top → bottom
     20 Vacation         (bottom-right)
     21–29 bottom row    right → left
     30 Go to Prison     (bottom-left)
     31–39 left column   bottom → top
   ═══════════════════════════════════════════════════════════ */
window.MM = window.MM || {};

/* Colour groups. `corp` ties a group to a listed company so that
   development on the board can move the share price (Phase 3). */
MM.GROUPS = {
  NG: { name: "Nigeria",   color: "#a2653f", house: 50,  corp: "BRK" },
  IN: { name: "India",     color: "#58c6ee", house: 50,  corp: "BRK" },
  GR: { name: "Greece",    color: "#e4457e", house: 100, corp: "BRK" },
  PL: { name: "Poland",    color: "#f0913a", house: 100, corp: "BRK" },
  CA: { name: "Canada",    color: "#e8453c", house: 150, corp: "BRK" },
  JP: { name: "Japan",     color: "#f3d33c", house: 150, corp: "BRK" },
  AU: { name: "Australia", color: "#3fb96b", house: 200, corp: "BRK" },
  US: { name: "USA",       color: "#3c60e8", house: 200, corp: "BRK" }
};

/* rent[0] = bare · rent[1..4] = 1–4 houses · rent[5] = hotel */
const P = (i, name, group, price, rent) =>
  ({ i, type: "property", name, group, price, rent, mortgage: price / 2 });

MM.BOARD = [
  { i: 0,  type: "go",       name: "START",         pay: 200 },
  P(1,  "Lagos",      "NG", 60,  [2, 10, 30, 90, 160, 250]),
  { i: 2,  type: "treasure", name: "Treasure" },
  P(3,  "Abuja",      "NG", 60,  [4, 20, 60, 180, 320, 450]),
  { i: 4,  type: "tax",      name: "Earnings Tax",  amount: 200, pct: 10 },
  { i: 5,  type: "airport",  name: "LHR Airport",   price: 200, code: "LHR" },
  P(6,  "Mumbai",     "IN", 100, [6, 30, 90, 270, 400, 550]),
  P(7,  "Delhi",      "IN", 100, [6, 30, 90, 270, 400, 550]),
  { i: 8,  type: "surprise", name: "Surprise" },
  P(9,  "Jaipur",     "IN", 120, [8, 40, 100, 300, 450, 600]),
  { i: 10, type: "jail",     name: "In Prison" },
  P(11, "Athens",     "GR", 140, [10, 50, 150, 450, 625, 750]),
  { i: 12, type: "utility",  name: "Power Company", price: 150, util: "power" },
  P(13, "Patras",     "GR", 140, [10, 50, 150, 450, 625, 750]),
  P(14, "Rhodes",     "GR", 160, [12, 60, 180, 500, 700, 900]),
  { i: 15, type: "airport",  name: "DXB Airport",   price: 200, code: "DXB" },
  P(16, "Warsaw",     "PL", 180, [14, 70, 200, 550, 750, 950]),
  { i: 17, type: "treasure", name: "Treasure" },
  P(18, "Krakow",     "PL", 180, [14, 70, 200, 550, 750, 950]),
  P(19, "Gdansk",     "PL", 200, [16, 80, 220, 600, 800, 1000]),
  { i: 20, type: "vacation", name: "Vacation" },
  P(21, "Toronto",    "CA", 220, [18, 90, 250, 700, 875, 1050]),
  { i: 22, type: "surprise", name: "Surprise" },
  P(23, "Montreal",   "CA", 220, [18, 90, 250, 700, 875, 1050]),
  P(24, "Vancouver",  "CA", 240, [20, 100, 300, 750, 925, 1100]),
  { i: 25, type: "airport",  name: "HND Airport",   price: 200, code: "HND" },
  P(26, "Osaka",      "JP", 260, [22, 110, 330, 800, 975, 1150]),
  P(27, "Kyoto",      "JP", 260, [22, 110, 330, 800, 975, 1150]),
  { i: 28, type: "utility",  name: "Water Company", price: 150, util: "water" },
  P(29, "Tokyo",      "JP", 280, [24, 120, 360, 850, 1025, 1200]),
  { i: 30, type: "gotojail", name: "Go to Prison" },
  P(31, "Perth",      "AU", 300, [26, 130, 390, 900, 1100, 1275]),
  P(32, "Melbourne",  "AU", 300, [26, 130, 390, 900, 1100, 1275]),
  { i: 33, type: "treasure", name: "Treasure" },
  P(34, "Sydney",     "AU", 320, [28, 150, 450, 1000, 1200, 1400]),
  { i: 35, type: "airport",  name: "JFK Airport",   price: 200, code: "JFK" },
  { i: 36, type: "surprise", name: "Surprise" },
  P(37, "Chicago",    "US", 350, [35, 175, 500, 1100, 1300, 1500]),
  { i: 38, type: "tax",      name: "Premium Tax",   amount: 75 },
  P(39, "New York",   "US", 400, [50, 200, 600, 1400, 1700, 2000])
];

MM.TILE_COUNT = MM.BOARD.length;
MM.JAIL_INDEX = 10;
MM.GO_SALARY = 200;
MM.BAIL = 50;

/* Airport rent doubles with each one owned; utility rent is a dice multiplier. */
MM.AIRPORT_RENT = [0, 25, 50, 100, 200];
MM.UTILITY_MULT = [0, 4, 10];

MM.tile = (i) => MM.BOARD[((i % 40) + 40) % 40];

MM.groupTiles = (groupId) =>
  MM.BOARD.filter((t) => t.type === "property" && t.group === groupId);
