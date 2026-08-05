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

  /* the plain-language answer to "what works, what's coming" */
  statusModal() {
    const group = (r) => `
      <div class="vgroup">
        <div class="vhead">
          <span class="status-dot ${r.status}"></span>
          <b>${r.v}</b> ${r.name}
          <span class="vtag vtag--${r.status}">${r.v === MM.VERSION ? "you're playing this" : MM.STATUS_LABEL[r.status]}</span>
        </div>
        <ul class="vlist">
          ${r.items.map((i) => `<li class="v-${r.status}">${i}</li>`).join("")}
        </ul>
      </div>`;

    this.modal(`What works today · ${MM.VERSION}`, `
      <p>Everything with a green tick is playable right now. Everything below it
      is on the way, in the order it'll arrive.</p>
      ${MM.RELEASES.map(group).join("")}`);
  },

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
        ${MM.RELEASES.map((r) => `<li><b>${r.v}</b> — ${r.name}${r.v === MM.VERSION ? " <i>You're here.</i>" : ""}</li>`).join("")}
      </ul>
      <p>Open <b>Build status</b> in the lobby for the full working / coming list.</p>`);
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
      already live; trading opens in V2.</p>`);
  }
};
