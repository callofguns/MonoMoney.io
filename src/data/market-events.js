/* ═══ headlines that move the tape ═══
   `sym` moves one company; `all` moves every listing. */
window.MM = window.MM || {};

MM.MARKET_EVENTS = [
  { sym: "SKY", pct: 0.09,  head: "Open-skies deal signed — Skyline Air adds four routes" },
  { sym: "SKY", pct: -0.10, head: "Fuel prices spike and the airlines get squeezed" },
  { sym: "VLT", pct: 0.07,  head: "Heatwave drives record demand at Voltaic Power" },
  { sym: "VLT", pct: -0.06, head: "Regulator caps household tariffs" },
  { sym: "BRK", pct: 0.11,  head: "Housing boom — Brickstone lands a city contract" },
  { sym: "BRK", pct: -0.09, head: "Construction costs bite into Brickstone margins" },
  { sym: "TCH", pct: 0.16,  head: "Helix Tech ships the chip everyone was waiting for" },
  { sym: "TCH", pct: -0.14, head: "Helix Tech guidance disappoints the street" },
  { sym: "AUR", pct: 0.06,  head: "Aurum Bank beats on lending income" },
  { sym: "AUR", pct: -0.07, head: "A rate cut squeezes Aurum Bank's margins" },
  { all: 0.05,  head: "Risk-on session — the whole board rallies" },
  { all: -0.06, head: "Profit taking hits every listing" }
];
