/* ═══════════════════════════════════════════
   Net worth dashboard — a leaderboard, a line
   chart and a breakdown table. Shared by the
   Dashboard modal and the end-of-game screen,
   so "who's ahead" always looks the same.
   Player identity colours are reused as-is —
   they already mean "this player" everywhere
   else on the table (token, avatar, chat, log).
   ═══════════════════════════════════════════ */
window.MM = window.MM || {};

MM.dashboardUI = {
  breakdown(s, p) {
    let property = 0;
    MM.tilesOf(s, p.id).forEach((t) => {
      property += s.mortgaged[t.i] ? t.price / 2 : t.price;
      const h = s.houses[t.i] || 0;
      if (h && t.group) property += h * MM.GROUPS[t.group].house;
    });
    return { cash: p.cash, property, shares: MM.portfolioValue(s, p), rent: p.rentTotal || 0 };
  },

  leaderboard(s) {
    return s.players.slice().sort((a, b) => MM.netWorth(s, b) - MM.netWorth(s, a));
  },

  legend(s, rows) {
    return `
      <div class="net-legend">
        ${rows.map((p, i) => `
          <div class="net-row ${p.alive ? "" : "is-out"}">
            <span class="net-rank">${i + 1}</span>
            <span class="net-dot" style="background:${p.hex}"></span>
            <span class="net-name">${p.name}${p.alive ? "" : " · out"}</span>
            <b class="net-worth">${MM.money(MM.netWorth(s, p))}</b>
          </div>`).join("")}
      </div>`;
  },

  /* one line per player, shared linear $ axis — all four lines are the
     same unit, so a single scale is correct, not a small-multiples job */
  chart(s) {
    const hist = s.worthHistory || [];
    if (hist.length < 2) return `<p class="panel-note">Play a few rounds to see the trend.</p>`;

    const w = 460, h = 160, pad = 10;
    const vals = [];
    hist.forEach((pt) => s.players.forEach((p) => vals.push(pt.worths[p.id] ?? 0)));
    const lo = Math.min(0, ...vals);
    const hi = Math.max(1, ...vals);
    const xstep = hist.length > 1 ? (w - pad * 2) / (hist.length - 1) : 0;
    const y = (v) => pad + (1 - (v - lo) / (hi - lo || 1)) * (h - pad * 2);

    const lines = s.players.map((p) => {
      const pts = hist.map((pt, i) => `${(pad + i * xstep).toFixed(1)},${y(pt.worths[p.id] ?? 0).toFixed(1)}`).join(" ");
      const lastY = y(hist[hist.length - 1].worths[p.id] ?? 0);
      return `<polyline points="${pts}" fill="none" stroke="${p.hex}" stroke-width="2"
                stroke-linejoin="round" stroke-linecap="round" opacity="${p.alive ? 1 : 0.35}" />
              <circle cx="${(pad + (hist.length - 1) * xstep).toFixed(1)}" cy="${lastY.toFixed(1)}" r="3.5" fill="${p.hex}" />`;
    }).join("");

    return `
      <svg class="chart chart--net" viewBox="0 0 ${w} ${h}" role="img" aria-label="Net worth over ${hist.length} rounds">
        <line x1="0" y1="${y(0).toFixed(1)}" x2="${w}" y2="${y(0).toFixed(1)}" class="chart-grid" />
        ${lines}
      </svg>
      <div class="chart-scale"><span>round 1</span><span>round ${hist[hist.length - 1].round}</span></div>`;
  },

  table(s, rows) {
    const cell = (p) => {
      const b = this.breakdown(s, p);
      return `
        <div class="net-table-row">
          <span class="net-dot" style="background:${p.hex}"></span>
          <span class="net-table-name">${p.name}</span>
          <span>${MM.money(b.cash)}</span>
          <span>${MM.money(b.property)}</span>
          <span>${MM.money(b.shares)}</span>
          <span>${MM.money(b.rent)}</span>
        </div>`;
    };
    return `
      <div class="net-table-scroll">
        <div class="net-table">
          <div class="net-table-head">
            <span></span><span>Player</span><span>Cash</span><span>Property</span><span>Shares</span><span>Rent earned</span>
          </div>
          ${rows.map(cell).join("")}
        </div>
      </div>`;
  },

  render(s) {
    const rows = this.leaderboard(s);
    return `${this.legend(s, rows)}${this.chart(s)}${this.table(s, rows)}`;
  },

  open() {
    const s = MM.state;
    if (!s || s.phase === MM.PHASES.LOBBY) return;
    MM.screens.modal("Net worth", this.render(s));
  }
};
