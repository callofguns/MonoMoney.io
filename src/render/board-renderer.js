/* ═══════════════════════════════════════════
   Canvas board renderer
   Static furniture is painted once to an offscreen
   canvas; only tokens, hover and the turn ring are
   redrawn per frame.
   ═══════════════════════════════════════════ */
window.MM = window.MM || {};

MM.FONT_DISPLAY = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
MM.FONT_BODY = 'system-ui, "Segoe UI", Roboto, sans-serif';
MM.FONT_NUM = 'ui-monospace, "SF Mono", Consolas, monospace';

const CANVAS_COLORS = {
  plate: "#0d1728",
  tile: "#16243b",
  tileAlt: "#1a2b45",
  edge: "#2c4767",
  text: "#e6eefb",
  dim: "#9db3d1",
  mut: "#6f88a8",
  gold: "#ffc24b",
  green: "#3dd68c"
};

MM.renderer = {
  init(canvas, wrap, centerEl) {
    this.canvas = canvas;
    this.wrap = wrap;
    this.centerEl = centerEl;
    this.ctx = canvas.getContext("2d");
    this.static = document.createElement("canvas");
    this.sctx = this.static.getContext("2d");
    this.anims = {};
    this.hover = -1;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.tip = document.createElement("div");
    this.tip.className = "tile-tip";
    this.tip.hidden = true;
    wrap.appendChild(this.tip);

    new ResizeObserver(() => this.resize()).observe(wrap);
    canvas.addEventListener("mousemove", (e) => this.onHover(e));
    canvas.addEventListener("mouseleave", () => { this.hover = -1; this.tip.hidden = true; });

    MM.bus.on("state", () => this.invalidate());
    MM.bus.on("market", () => this.invalidate());

    this.resize();
    const loop = () => { this.draw(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  },

  /* ── sizing ─────────────────────────────── */
  resize() {
    const box = this.wrap.getBoundingClientRect();
    const size = Math.max(320, Math.floor(Math.min(box.width, box.height) - 4));
    if (size === this.size) return;

    this.size = size;
    this.L = MM.geom.build(size);

    [this.canvas, this.static].forEach((c) => {
      c.width = size * this.dpr;
      c.height = size * this.dpr;
      c.style.width = size + "px";
      c.style.height = size + "px";
    });
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.sctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const pad = Math.round(this.L.corner * 0.35);
    this.centerEl.style.width = this.L.inner.w - pad + "px";
    this.centerEl.style.height = this.L.inner.h - pad + "px";

    this.invalidate();
  },

  invalidate() { this.staticStale = true; },

  /* ── static layer ───────────────────────── */
  paintStatic() {
    const ctx = this.sctx;
    const L = this.L;
    const s = MM.state;
    ctx.clearRect(0, 0, L.size, L.size);

    /* plate */
    ctx.fillStyle = CANVAS_COLORS.plate;
    MM.icons.rrect(ctx, 0, 0, L.size, L.size, 14);
    ctx.fill();

    /* hollow centre */
    const g = ctx.createRadialGradient(L.size / 2, L.size / 2, L.size * 0.05, L.size / 2, L.size / 2, L.size * 0.5);
    g.addColorStop(0, "rgba(47,125,246,.12)");
    g.addColorStop(1, "rgba(6,11,20,0)");
    ctx.fillStyle = g;
    ctx.fillRect(L.inner.x, L.inner.y, L.inner.w, L.inner.h);

    ctx.strokeStyle = "rgba(255,255,255,.04)";
    ctx.lineWidth = 1;
    MM.icons.rrect(ctx, L.inner.x + 8, L.inner.y + 8, L.inner.w - 16, L.inner.h - 16, 10);
    ctx.stroke();

    L.rects.forEach((r) => {
      ctx.save();
      if (r.corner) this.drawCorner(ctx, r, s);
      else this.drawTile(ctx, r, s);
      ctx.restore();
    });

    this.staticStale = false;
  },

  /* ── one side tile ──────────────────────── */
  drawTile(ctx, r, s) {
    const t = MM.BOARD[r.i];
    const f = MM.geom.frame(ctx, r);
    const { w, d, flip } = f;
    const owner = s ? MM.ownerOf(s, r.i) : null;
    const L = this.L;

    ctx.fillStyle = r.i % 2 ? CANVAS_COLORS.tile : CANVAS_COLORS.tileAlt;
    ctx.fillRect(0, 0, w, d);

    if (owner) {
      ctx.fillStyle = owner.hex + "2e";
      ctx.fillRect(0, 0, w, d);
    }

    ctx.strokeStyle = "rgba(0,0,0,.55)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, d - 1);

    const nameSize = Math.max(8, L.tile * 0.2);
    const numSize = Math.max(8, L.tile * 0.17);
    const outerY = flip ? d - 5 : 5;
    const outerBase = flip ? "bottom" : "top";

    if (t.type === "property") {
      const grp = MM.GROUPS[t.group];
      const bandH = d * 0.24;
      const bandY = flip ? 0 : d - bandH;

      ctx.fillStyle = grp.color;
      ctx.fillRect(0, bandY, w, bandH);
      ctx.fillStyle = "rgba(0,0,0,.18)";
      ctx.fillRect(0, flip ? bandH - 2 : bandY, w, 2);

      const houses = s ? s.houses[r.i] || 0 : 0;
      if (houses) this.drawHouses(ctx, houses, w, bandY, bandH);
      else {
        ctx.fillStyle = "rgba(0,0,0,.55)";
        ctx.font = `700 ${Math.max(7, bandH * 0.5)}px ${MM.FONT_NUM}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(t.group, w / 2, bandY + bandH / 2 + 0.5);
      }

      this.text(ctx, MM.money(t.price), w / 2, outerY, numSize, CANVAS_COLORS.dim, outerBase, MM.FONT_NUM);

      const zoneTop = flip ? bandH + numSize : numSize + 6;
      const zoneBot = flip ? d - numSize - 6 : d - bandH;
      this.name(ctx, t.name, w, (zoneTop + zoneBot) / 2, nameSize);

      if (s && s.mortgaged[r.i]) this.stamp(ctx, w, d, "MORTGAGED");
    } else if (t.type === "airport" || t.type === "utility") {
      this.text(ctx, MM.money(t.price), w / 2, outerY, numSize, CANVAS_COLORS.dim, outerBase, MM.FONT_NUM);
      this.name(ctx, t.name, w, flip ? d * 0.68 : d * 0.34, nameSize);

      ctx.save();
      ctx.translate(w / 2, flip ? d * 0.28 : d * 0.72);
      const size = Math.min(w, d) * 0.36;
      if (t.type === "airport") MM.icons.plane(ctx, size, "#bcdcff");
      else if (t.util === "power") MM.icons.bolt(ctx, size, CANVAS_COLORS.gold);
      else MM.icons.droplet(ctx, size, "#5ec8f0");
      ctx.restore();
    } else {
      /* tax · surprise · treasure */
      const accent = t.type === "surprise" ? "#5ac8fa" : t.type === "treasure" ? CANVAS_COLORS.gold : "#8fb4e8";
      const isTax = t.type === "tax";
      this.name(ctx, t.name, w, flip ? d * 0.8 : d * 0.2, nameSize);

      if (isTax) {
        this.text(ctx, t.pct ? t.pct + "%" : MM.money(t.amount), w / 2, flip ? d * 0.6 : d * 0.4,
          numSize * 0.95, CANVAS_COLORS.mut, "middle", MM.FONT_NUM, 700, w - 8);
      }

      ctx.save();
      ctx.translate(w / 2, flip ? d * (isTax ? 0.28 : 0.4) : d * (isTax ? 0.72 : 0.6));
      const size = Math.min(w, d) * 0.4;
      if (t.type === "surprise") MM.icons.question(ctx, size * 1.4, accent);
      else if (t.type === "treasure") MM.icons.chest(ctx, size, accent);
      else MM.icons.note(ctx, size * 0.8, accent);
      ctx.restore();
    }

    if (owner) {
      ctx.fillStyle = owner.hex;
      const barY = flip ? d - 3 : 0;
      ctx.fillRect(0, barY, w, 3);
    }
  },

  drawHouses(ctx, n, w, bandY, bandH) {
    const size = bandH * 0.62;
    const hotel = n >= 5;
    const count = hotel ? 1 : n;
    const gap = size * 0.35;
    const total = count * size + (count - 1) * gap;
    let x = w / 2 - total / 2 + size / 2;
    for (let k = 0; k < count; k++) {
      ctx.save();
      ctx.translate(x, bandY + bandH / 2);
      MM.icons.house(ctx, size * (hotel ? 1.25 : 1), hotel ? "#ff5c6c" : "#ffffff");
      ctx.restore();
      x += size + gap;
    }
  },

  /* ── corners ────────────────────────────── */
  drawCorner(ctx, r, s) {
    const c = r.w;
    ctx.translate(r.x, r.y);
    ctx.fillStyle = CANVAS_COLORS.tileAlt;
    ctx.fillRect(0, 0, c, c);
    ctx.strokeStyle = "rgba(0,0,0,.55)";
    ctx.strokeRect(0.5, 0.5, c - 1, c - 1);

    const label = Math.max(9, c * 0.145);

    if (r.i === 0) {
      const g = ctx.createLinearGradient(0, 0, c, c);
      g.addColorStop(0, "rgba(61,214,140,.22)");
      g.addColorStop(1, "rgba(61,214,140,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, c, c);
      this.text(ctx, "START", c / 2, c * 0.3, label * 1.25, CANVAS_COLORS.green, "middle", MM.FONT_DISPLAY, 700);
      ctx.save();
      ctx.translate(c / 2, c * 0.56);
      MM.icons.chevrons(ctx, c * 0.3, "rgba(61,214,140,.75)");
      ctx.restore();
      this.text(ctx, "+" + MM.money(MM.GO_SALARY), c / 2, c * 0.82, label * 0.85, CANVAS_COLORS.dim, "middle", MM.FONT_NUM);
    }

    if (r.i === MM.JAIL_INDEX) {
      this.text(ctx, "Passing by", c / 2, c * 0.11, label * 0.72, CANVAS_COLORS.mut, "middle");
      const bx = c * 0.2, by = c * 0.2, bw = c * 0.68, bh = c * 0.56;
      ctx.fillStyle = "rgba(255,92,108,.14)";
      MM.icons.rrect(ctx, bx, by, bw, bh, 6);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,92,108,.5)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.save();
      ctx.translate(bx + bw / 2, by + bh / 2);
      MM.icons.bars(ctx, bw * 0.8, bh * 0.72, "rgba(255,140,150,.55)");
      ctx.restore();
      this.text(ctx, "In Prison", c / 2, c * 0.88, label * 0.85, "#ff8f9a", "middle", MM.FONT_BODY, 700);
    }

    if (r.i === 20) {
      ctx.save();
      ctx.translate(c / 2, c * 0.42);
      MM.icons.umbrella(ctx, c * 0.4, "#4ec8c1");
      ctx.restore();
      this.text(ctx, "Vacation", c / 2, c * 0.74, label, CANVAS_COLORS.text, "middle", MM.FONT_BODY, 700);
      const pot = s ? s.vacationPot : 0;
      this.text(ctx, pot > 0 ? MM.money(pot) : "empty", c / 2, c * 0.88, label * 0.8,
        pot > 0 ? CANVAS_COLORS.gold : CANVAS_COLORS.mut, "middle", MM.FONT_NUM);
    }

    if (r.i === 30) {
      ctx.save();
      ctx.translate(c / 2, c * 0.4);
      MM.icons.cuffs(ctx, c * 0.42, "#ff8f9a");
      ctx.restore();
      this.text(ctx, "Go to", c / 2, c * 0.7, label, CANVAS_COLORS.text, "middle", MM.FONT_BODY, 700);
      this.text(ctx, "Prison", c / 2, c * 0.85, label, CANVAS_COLORS.text, "middle", MM.FONT_BODY, 700);
    }
  },

  /* ── text helpers ───────────────────────── */
  text(ctx, str, x, y, size, color, baseline, font, weight, maxWidth) {
    ctx.save();
    ctx.fillStyle = color;
    let fs = size;
    const face = font || MM.FONT_BODY;
    ctx.font = `${weight || 600} ${fs}px ${face}`;
    while (maxWidth && fs > 6 && ctx.measureText(str).width > maxWidth) {
      fs -= 0.5;
      ctx.font = `${weight || 600} ${fs}px ${face}`;
    }
    ctx.textAlign = "center";
    ctx.textBaseline = baseline || "middle";
    ctx.fillText(str, x, y);
    ctx.restore();
  },

  /* tile name — shrinks, then wraps onto two lines */
  name(ctx, str, w, cy, size) {
    ctx.save();
    ctx.fillStyle = CANVAS_COLORS.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const max = w - 8;
    let fs = size;
    ctx.font = `700 ${fs}px ${MM.FONT_BODY}`;

    if (ctx.measureText(str).width > max) {
      const words = str.split(" ");
      if (words.length > 1) {
        const lines = [words[0], words.slice(1).join(" ")];
        fs = size * 0.92;
        ctx.font = `700 ${fs}px ${MM.FONT_BODY}`;
        while (fs > 6 && Math.max(...lines.map((l) => ctx.measureText(l).width)) > max) {
          fs -= 0.5;
          ctx.font = `700 ${fs}px ${MM.FONT_BODY}`;
        }
        ctx.fillText(lines[0], w / 2, cy - fs * 0.55);
        ctx.fillText(lines[1], w / 2, cy + fs * 0.55);
        ctx.restore();
        return;
      }
      while (fs > 6 && ctx.measureText(str).width > max) {
        fs -= 0.5;
        ctx.font = `700 ${fs}px ${MM.FONT_BODY}`;
      }
    }
    ctx.fillText(str, w / 2, cy);
    ctx.restore();
  },

  stamp(ctx, w, d, str) {
    ctx.save();
    ctx.translate(w / 2, d / 2);
    ctx.rotate(-0.35);
    ctx.fillStyle = "rgba(255,92,108,.75)";
    ctx.font = `700 ${Math.max(7, w * 0.15)}px ${MM.FONT_BODY}`;
    ctx.textAlign = "center";
    ctx.fillText(str, 0, 0);
    ctx.restore();
  },

  /* ── frame ──────────────────────────────── */
  draw() {
    if (!this.L) return;
    if (this.staticStale) this.paintStatic();

    const ctx = this.ctx;
    const L = this.L;
    const s = MM.state;
    ctx.clearRect(0, 0, L.size, L.size);
    ctx.drawImage(this.static, 0, 0, L.size, L.size);

    if (this.hover >= 0) {
      const r = L.rects[this.hover];
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,.07)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = "rgba(255,255,255,.28)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      ctx.restore();
    }

    if (!s) return;

    /* stationary tokens grouped per tile, movers drawn last on top */
    const groups = {};
    const movers = [];
    s.players.forEach((p) => {
      if (!p.alive) return;
      if (this.anims[p.id]) movers.push(p);
      else (groups[p.pos] = groups[p.pos] || []).push(p);
    });

    const size = L.tile * 0.46;
    Object.keys(groups).forEach((pos) => {
      const list = groups[pos];
      list.forEach((p, n) => {
        const a = MM.geom.anchor(+pos, L, p.jailed);
        const off = list.length > 1 ? MM.geom.slot(n, size) : { dx: 0, dy: 0 };
        this.token(ctx, p, a.x + off.dx, a.y + off.dy, size / 2, s);
      });
    });

    movers.forEach((p) => {
      const an = this.anims[p.id];
      const k = Math.min(1, (performance.now() - an.t0) / an.dur);
      const e = k * k * (3 - 2 * k);
      const from = MM.geom.anchor(an.from, L, false);
      const to = MM.geom.anchor(an.to, L, an.jailed);
      const lift = Math.sin(Math.PI * e) * (an.arc || L.tile * 0.3);
      this.token(ctx, p, from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e - lift, size / 2, s, true);
    });
  },

  token(ctx, p, x, y, r, s, lifted) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.85, r * (lifted ? 0.5 : 0.72), r * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,.45)";
    ctx.fill();

    if (s && MM.currentPlayer(s) === p && s.phase !== MM.PHASES.LOBBY) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 380);
      ctx.beginPath();
      ctx.arc(x, y, r + 3 + pulse * 3, 0, Math.PI * 2);
      ctx.strokeStyle = p.hex + "88";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = p.hex;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(6,11,20,.85)";
    ctx.stroke();

    ctx.font = `${r * 1.15}px ${MM.FONT_BODY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.avatar, x, y + r * 0.06);
    ctx.restore();
  },

  /* ── movement API ───────────────────────── */
  animate(p, from, to, dur, opts) {
    return new Promise((resolve) => {
      this.anims[p.id] = Object.assign({ from, to, t0: performance.now(), dur }, opts);
      setTimeout(() => { delete this.anims[p.id]; resolve(); }, dur);
    });
  },

  async travel(p, steps, onEnter) {
    const dur = Math.max(160, 340 - steps * 10);
    for (let n = 0; n < steps; n++) {
      const to = (p.pos + 1) % 40;
      await this.animate(p, p.pos, to, dur);
      p.pos = to;
      if (onEnter) onEnter(to);
      MM.bus.emit("moved", p);
    }
  },

  async teleport(p, index) {
    await this.animate(p, p.pos, index, 460, { arc: this.L.tile * 1.6, jailed: true });
    p.pos = index;
    MM.bus.emit("moved", p);
  },

  /* ── hover + tooltip ────────────────────── */
  onHover(e) {
    const box = this.canvas.getBoundingClientRect();
    const i = MM.geom.hit(this.L, e.clientX - box.left, e.clientY - box.top);
    this.hover = i;
    if (i < 0) { this.tip.hidden = true; return; }

    const t = MM.BOARD[i];
    const s = MM.state;
    const owner = s ? MM.ownerOf(s, i) : null;
    let html = `<b>${t.name}</b>`;

    if (t.type === "property") {
      const g = MM.GROUPS[t.group];
      html += `<i style="color:${g.color}">${g.name}</i>
        <span>Price ${MM.money(t.price)} · House ${MM.money(g.house)}</span>
        <span>Rent ${MM.money(t.rent[0])} → ${MM.money(t.rent[5])} with a hotel</span>`;
    } else if (t.type === "airport") {
      html += `<span>Price ${MM.money(t.price)}</span><span>Rent ${MM.AIRPORT_RENT.slice(1).map(MM.money).join(" · ")}</span>`;
    } else if (t.type === "utility") {
      html += `<span>Price ${MM.money(t.price)}</span><span>Rent 4× or 10× the dice</span>`;
    } else if (t.type === "tax") {
      html += `<span>${t.pct ? t.pct + "% of net worth, capped at " + MM.money(t.amount) : MM.money(t.amount)}</span>`;
    } else if (t.type === "go") {
      html += `<span>Collect ${MM.money(MM.GO_SALARY)} every lap</span>`;
    }
    if (owner) html += `<span style="color:${owner.hex}">Owned by ${owner.name}</span>`;

    this.tip.innerHTML = html;
    this.tip.hidden = false;

    const wrapBox = this.wrap.getBoundingClientRect();
    const w = 210, h = this.tip.offsetHeight;
    let x = e.clientX - wrapBox.left + 14;
    let y = e.clientY - wrapBox.top + 14;
    if (x + w > wrapBox.width) x = e.clientX - wrapBox.left - w - 14;
    if (y + h > wrapBox.height) y = Math.max(0, e.clientY - wrapBox.top - h - 14);
    this.tip.style.left = x + "px";
    this.tip.style.top = y + "px";
  }
};
