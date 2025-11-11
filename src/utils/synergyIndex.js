/** @typedef {{ produces: string[]; requires: string[]; mechanics: string[] }} Effects */

/**
 * @param {Record<string, Effects>} manualById
 */
export function buildSynergyIndex(manualById) {
  const byProduces = {};
  const byRequires = {};
  for (const [id, eff] of Object.entries(manualById)) {
    for (const t of eff.produces || []) (byProduces[t] ??= []).push(id);
    for (const t of eff.requires || []) (byRequires[t] ??= []).push(id);
  }
  return { byProduces, byRequires };
}

/**
 * @param {string} cardId
 * @param {Effects} eff
 * @param {{ byProduces: Record<string,string[]>; byRequires: Record<string,string[]> }} index
 */
export function findSynergiesFor(cardId, eff, index) {
  const inbound = [];
  const outbound = [];
  const needsLowerCost = index.byRequires['Enable:LowerCost'] || [];
  if ((eff.produces || []).some(t => /^KO:Cost(<=|==)/.test(t))) {
    for (const id of needsLowerCost) if (id !== cardId) outbound.push({ to: id, reason: 'Enables KO:Cost via cost reduction' });
  }
  if ((eff.requires || []).includes('Enable:LowerCost')) {
    const reducers = Object.keys(index.byProduces).filter(t => /^ReduceCost:\d+:/.test(t));
    for (const r of reducers) for (const from of index.byProduces[r]) if (from !== cardId) inbound.push({ from, reason: `Producer ${r}` });
  }
  return { inbound, outbound };
}
