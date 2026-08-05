/* ═══ vector tile icons — drawn, never fonts, so they look the same everywhere ═══
   Each icon draws inside a box of side `s` centred on the current origin. */
window.MM = window.MM || {};

MM.icons = {
  rrect(ctx, x, y, w, h, r) {
    const k = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + k, y);
    ctx.arcTo(x + w, y, x + w, y + h, k);
    ctx.arcTo(x + w, y + h, x, y + h, k);
    ctx.arcTo(x, y + h, x, y, k);
    ctx.arcTo(x, y, x + w, y, k);
    ctx.closePath();
  },

  plane(ctx, s, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.5);
    ctx.lineTo(s * 0.1, -s * 0.2);
    ctx.lineTo(s * 0.5, s * 0.1);
    ctx.lineTo(s * 0.5, s * 0.24);
    ctx.lineTo(s * 0.09, s * 0.12);
    ctx.lineTo(s * 0.06, s * 0.38);
    ctx.lineTo(s * 0.22, s * 0.5);
    ctx.lineTo(0, s * 0.46);
    ctx.lineTo(-s * 0.22, s * 0.5);
    ctx.lineTo(-s * 0.06, s * 0.38);
    ctx.lineTo(-s * 0.09, s * 0.12);
    ctx.lineTo(-s * 0.5, s * 0.24);
    ctx.lineTo(-s * 0.5, s * 0.1);
    ctx.lineTo(-s * 0.1, -s * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  bolt(ctx, s, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s * 0.12, -s * 0.5);
    ctx.lineTo(-s * 0.34, s * 0.08);
    ctx.lineTo(-s * 0.04, s * 0.08);
    ctx.lineTo(-s * 0.14, s * 0.5);
    ctx.lineTo(s * 0.34, -s * 0.1);
    ctx.lineTo(s * 0.02, -s * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  droplet(ctx, s, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.5);
    ctx.bezierCurveTo(s * 0.42, -s * 0.05, s * 0.34, s * 0.48, 0, s * 0.48);
    ctx.bezierCurveTo(-s * 0.34, s * 0.48, -s * 0.42, -s * 0.05, 0, -s * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  chest(ctx, s, color) {
    ctx.save();
    ctx.fillStyle = color;
    this.rrect(ctx, -s * 0.44, -s * 0.34, s * 0.88, s * 0.68, s * 0.1);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,.34)";
    ctx.fillRect(-s * 0.44, -s * 0.06, s * 0.88, s * 0.1);
    this.rrect(ctx, -s * 0.1, -s * 0.14, s * 0.2, s * 0.26, s * 0.05);
    ctx.fill();
    ctx.restore();
  },

  question(ctx, s, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `700 ${s}px ${MM.FONT_DISPLAY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", 0, s * 0.04);
    ctx.restore();
  },

  note(ctx, s, color) {
    ctx.save();
    ctx.fillStyle = color;
    this.rrect(ctx, -s * 0.5, -s * 0.3, s, s * 0.6, s * 0.08);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,.4)";
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  chevrons(ctx, s, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = s * 0.16;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let n = -1; n <= 1; n++) {
      ctx.beginPath();
      ctx.moveTo(n * s * 0.3 - s * 0.12, -s * 0.26);
      ctx.lineTo(n * s * 0.3 + s * 0.12, 0);
      ctx.lineTo(n * s * 0.3 - s * 0.12, s * 0.26);
      ctx.stroke();
    }
    ctx.restore();
  },

  bars(ctx, w, h, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, w * 0.055);
    for (let n = 1; n <= 4; n++) {
      const x = -w / 2 + (w * n) / 5;
      ctx.beginPath();
      ctx.moveTo(x, -h / 2);
      ctx.lineTo(x, h / 2);
      ctx.stroke();
    }
    ctx.restore();
  },

  umbrella(ctx, s, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, s * 0.02, s * 0.46, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = s * 0.09;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, s * 0.02);
    ctx.lineTo(0, s * 0.44);
    ctx.stroke();
    ctx.restore();
  },

  cuffs(ctx, s, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = s * 0.11;
    ctx.beginPath();
    ctx.arc(-s * 0.24, s * 0.06, s * 0.2, 0, Math.PI * 2);
    ctx.arc(s * 0.24, s * 0.06, s * 0.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.06, -s * 0.12);
    ctx.lineTo(s * 0.06, -s * 0.12);
    ctx.stroke();
    ctx.restore();
  },

  house(ctx, s, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.5);
    ctx.lineTo(s * 0.5, -s * 0.05);
    ctx.lineTo(s * 0.32, -s * 0.05);
    ctx.lineTo(s * 0.32, s * 0.5);
    ctx.lineTo(-s * 0.32, s * 0.5);
    ctx.lineTo(-s * 0.32, -s * 0.05);
    ctx.lineTo(-s * 0.5, -s * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
};
