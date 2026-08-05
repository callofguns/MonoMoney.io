/* ═══ the pair of dice in the middle of the board ═══ */
window.MM = window.MM || {};

const PIPS = {
  1: [[2, 2]],
  2: [[1, 1], [3, 3]],
  3: [[1, 1], [2, 2], [3, 3]],
  4: [[1, 1], [1, 3], [3, 1], [3, 3]],
  5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]],
  6: [[1, 1], [1, 3], [2, 1], [2, 3], [3, 1], [3, 3]]
};

MM.diceUI = {
  init(tray) {
    this.tray = tray;
    this.dice = [...tray.querySelectorAll(".die")];
    this.dice.forEach((el, n) => { el.dataset.side = n; });
    this.show(1, 1);
  },

  face(el, n) {
    el.textContent = "";
    PIPS[n].forEach(([row, col]) => {
      const pip = document.createElement("span");
      pip.className = "pip";
      pip.style.gridRow = row;
      pip.style.gridColumn = col;
      el.appendChild(pip);
    });
  },

  show(a, b) {
    this.face(this.dice[0], a);
    this.face(this.dice[1], b);
  },

  roll(d) {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const span = reduced ? 180 : 720;

    this.tray.classList.remove("is-double");
    this.tray.classList.add("is-rolling");

    return new Promise((resolve) => {
      const spin = reduced ? null : setInterval(() => {
        this.show(1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6));
      }, 85);

      setTimeout(() => {
        if (spin) clearInterval(spin);
        this.tray.classList.remove("is-rolling");
        this.show(d.a, d.b);
        if (d.isDouble) this.tray.classList.add("is-double");
        setTimeout(resolve, reduced ? 40 : 220);
      }, span);
    });
  }
};
