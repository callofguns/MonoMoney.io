/* ═══ the one-line event bus every module talks over ═══ */
window.MM = window.MM || {};

MM.createBus = function () {
  const map = new Map();
  return {
    on(type, fn) {
      if (!map.has(type)) map.set(type, new Set());
      map.get(type).add(fn);
      return () => map.get(type).delete(fn);
    },
    emit(type, payload) {
      const set = map.get(type);
      if (set) set.forEach((fn) => fn(payload));
      const all = map.get("*");
      if (all) all.forEach((fn) => fn({ type, payload }));
    }
  };
};

MM.bus = MM.createBus();
