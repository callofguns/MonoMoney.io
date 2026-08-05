/* ═══ seedable RNG — same seed, same game (handy for bug reports) ═══ */
window.MM = window.MM || {};

MM.createRng = function (seed) {
  let s = seed >>> 0 || (Math.random() * 4294967296) >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    seed: s,
    float: next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    /* roughly normal, for price walks */
    gauss: () => (next() + next() + next() + next() - 2) / 1.5
  };
};
