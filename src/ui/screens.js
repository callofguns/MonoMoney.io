/* ═══ screen switching, modal, home-screen atmosphere ═══ */
window.MM = window.MM || {};

MM.screens = {
  init() {
    this.table = document.querySelector('[data-screen="table"]');
    this.modalEl = document.getElementById("modal");
    this.modalTitle = document.getElementById("modal-title");
    this.modalBody = document.getElementById("modal-body");

    this.scatter();

    this.modalEl.addEventListener("click", (e) => {
      if (e.target === this.modalEl || e.target.dataset.action === "close-modal") this.closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.closeModal();
    });
  },

  show(name) {
    document.querySelectorAll(".screen").forEach((s) => {
      s.classList.toggle("is-active", s.dataset.screen === name);
    });
    if (name === "table") requestAnimationFrame(() => MM.renderer.resize());
  },

  mode(m) { this.table.dataset.mode = m; },

  /* drifting props behind the home screen */
  scatter() {
    const box = document.querySelector(".home-scatter");
    if (!box) return;
    const glyphs = ["💵", "🎲", "🏦", "📈", "💎", "🏠", "🚉", "⚡", "💼", "🪙", "📉", "🔑", "🎩", "🦈"];
    glyphs.forEach((g, n) => {
      const s = document.createElement("span");
      s.textContent = g;
      s.style.left = (5 + ((n * 37) % 90)) + "%";
      s.style.top = (12 + ((n * 53) % 76)) + "%";
      s.style.fontSize = 26 + ((n * 13) % 34) + "px";
      s.style.setProperty("--rot", (n % 2 ? 1 : -1) * (5 + (n % 4) * 7) + "deg");
      s.style.animationDelay = (n * 0.7) + "s";
      box.appendChild(s);
    });
  },

  modal(title, html) {
    this.modalTitle.textContent = title;
    this.modalBody.innerHTML = html;
    this.modalEl.hidden = false;
  },

  closeModal() { this.modalEl.hidden = true; },

  rulesModal() {
    this.modal("How MonoMoney works", `
      <p>Two dice, forty tiles, and a stock exchange running alongside the board.
      Own tiles for rent, own shares for dividends — the winner is usually whoever
      balanced both.</p>
      <h3>This turn</h3>
      <ul>
        <li>Roll two dice and move clockwise from <code>START</code>.</li>
        <li>Doubles hand you another roll. Three in a row and you're in prison.</li>
        <li>Prison costs you three turns or <code>${MM.money(MM.BAIL)}</code> — doubles get you out early.</li>
        <li>Every lap past START pays <code>${MM.money(MM.GO_SALARY)}</code>, plus dividends on the shares you hold.</li>
      </ul>
      <h3>Built so far</h3>
      <ul>
        <li><b>Phase 1</b> — board, tiles, turn engine, dice, prison, taxes, the vacation pot. <i>You're here.</i></li>
        <li><b>Phase 2</b> — buying, rent, colour sets, houses, hotels, mortgages.</li>
        <li><b>Phase 3</b> — the exchange: orders, price shocks, dividends on every lap.</li>
        <li><b>Phase 4</b> — the four bot personalities make their own calls.</li>
        <li><b>Phase 5</b> — trades, auctions and the financial dashboard.</li>
      </ul>`);
  },

  marketModal() {
    const rows = MM.STOCKS.map((s) =>
      `<li><b style="color:${s.color}">${s.sym}</b> — ${s.name}. ${s.sector}, ${(s.yield * 100).toFixed(0)}% dividend, ${s.vol > 0.08 ? "high" : s.vol > 0.045 ? "medium" : "low"} volatility.</li>`
    ).join("");
    this.modal("The exchange", `
      <p>Five companies trade alongside the board. Prices move on random market
      events, on Surprise cards, and on what gets built where — a hotel row lifts
      the realty stock, a bought-up airport lifts the airline.</p>
      <ul>${rows}</ul>
      <p>Dividends land every time you pass START. The tape above the board is
      already live; trading opens in Phase 3.</p>`);
  }
};
