/* ═══ two six-sided dice ═══ */
window.MM = window.MM || {};

MM.rollDice = function (rng) {
  const a = rng.int(1, 6);
  const b = rng.int(1, 6);
  return { a, b, sum: a + b, isDouble: a === b, rolled: true };
};

/* Rig a roll — used by tests and by the "3 doubles" demo in the rules modal. */
MM.fixedRoll = (a, b) => ({ a, b, sum: a + b, isDouble: a === b, rolled: true });
