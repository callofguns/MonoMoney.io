/* ═══ board geometry — index → rectangle, index → token anchor ═══ */
window.MM = window.MM || {};

MM.geom = {
  /* corner depth is 11.3% of the board; nine side tiles share the rest */
  build(size) {
    const corner = Math.round(size * 0.113);
    const tile = (size - corner * 2) / 9;
    const rects = [];

    for (let i = 0; i < 40; i++) {
      if (i === 0)       rects.push({ i, x: 0, y: 0, w: corner, h: corner, side: 0, corner: true });
      else if (i < 10)   rects.push({ i, x: corner + (i - 1) * tile, y: 0, w: tile, h: corner, side: 0 });
      else if (i === 10) rects.push({ i, x: corner + 9 * tile, y: 0, w: corner, h: corner, side: 1, corner: true });
      else if (i < 20)   rects.push({ i, x: corner + 9 * tile, y: corner + (i - 11) * tile, w: corner, h: tile, side: 1 });
      else if (i === 20) rects.push({ i, x: corner + 9 * tile, y: corner + 9 * tile, w: corner, h: corner, side: 2, corner: true });
      else if (i < 30)   rects.push({ i, x: corner + (29 - i) * tile, y: corner + 9 * tile, w: tile, h: corner, side: 2 });
      else if (i === 30) rects.push({ i, x: 0, y: corner + 9 * tile, w: corner, h: corner, side: 3, corner: true });
      else               rects.push({ i, x: 0, y: corner + (39 - i) * tile, w: corner, h: tile, side: 3 });
    }

    return {
      size, corner, tile, rects,
      inner: { x: corner, y: corner, w: size - corner * 2, h: size - corner * 2 }
    };
  },

  /* Local drawing frame: x runs along the outer edge, y runs into the board.
     Sides 0/1/3 are rotated so the inner edge is at y = depth; the bottom row
     stays upright and is flagged `flip` so content mirrors instead. */
  frame(ctx, r) {
    ctx.translate(r.x, r.y);
    if (r.side === 1) { ctx.translate(r.w, 0); ctx.rotate(Math.PI / 2); return { w: r.h, d: r.w, flip: false }; }
    if (r.side === 3) { ctx.translate(0, r.h); ctx.rotate(-Math.PI / 2); return { w: r.h, d: r.w, flip: false }; }
    if (r.side === 2) return { w: r.w, d: r.h, flip: true };
    return { w: r.w, d: r.h, flip: false };
  },

  /* Where a token sits on tile `i`, nudged toward the middle of the board. */
  anchor(i, L, jailed) {
    const r = L.rects[i];
    let x = r.x + r.w / 2;
    let y = r.y + r.h / 2;
    const pull = L.tile * 0.22;

    if (i === MM.JAIL_INDEX) {
      /* prison corner is split: cell inside, pavement outside */
      return jailed
        ? { x: r.x + r.w * 0.58, y: r.y + r.h * 0.44 }
        : { x: r.x + r.w * 0.24, y: r.y + r.h * 0.8 };
    }
    /* corners: nudge off the artwork, toward the middle of the board */
    if (r.corner) {
      const n = r.w * 0.12;
      return {
        x: x + (i === 0 || i === 30 ? n : -n),
        y: y + (i === 0 || i === 10 ? n : -n)
      };
    }

    if (r.side === 0) y += pull;
    else if (r.side === 1) x -= pull;
    else if (r.side === 2) y -= pull;
    else x += pull;
    return { x, y };
  },

  /* up to four tokens share a tile without stacking */
  slot(n, size) {
    const d = size * 0.62;
    return [
      { dx: -d / 2, dy: -d / 2 }, { dx: d / 2, dy: -d / 2 },
      { dx: -d / 2, dy: d / 2 },  { dx: d / 2, dy: d / 2 },
      { dx: 0, dy: 0 }
    ][Math.min(n, 4)];
  },

  hit(L, px, py) {
    for (const r of L.rects) {
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return r.i;
    }
    return -1;
  }
};
