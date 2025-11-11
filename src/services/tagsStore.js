/** @typedef {{ produces: string[]; requires: string[]; mechanics: string[] }} Effects */

/**
 * @param {string} cardId
 * @param {Effects} effects
 * @param {{ notes?: string; reviewed?: boolean }=} meta
 */
export async function saveManualTags(cardId, effects, meta) {
  const raw = localStorage.getItem('synergy_tags');
  const file = raw ? JSON.parse(raw) : { meta: { version: 1, vocabVersion: 1 }, cards: {} };
  const prev = file.cards[cardId] || {};
  file.cards[cardId] = {
    ...prev,
    manual: { produces: effects.produces || [], requires: effects.requires || [], mechanics: effects.mechanics || [] },
    notes: meta?.notes ?? prev.notes,
    reviewed: meta?.reviewed ?? prev.reviewed,
    lastEditedAt: new Date().toISOString(),
  };
  localStorage.setItem('synergy_tags', JSON.stringify(file));
  return file.cards[cardId];
}
