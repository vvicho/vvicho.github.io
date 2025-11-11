#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import url from 'url';
import { inferTagsFromText } from '../src/utils/tagParser.js';

function uniq(arr) { return Array.from(new Set(arr)); }
function norm(s) { return (s || '').replace(/\s+/g, ' ').trim(); }

function splitIntoBlocks(text) {
  const t = text || '';
  const blocks = [];
  const regex = /\[[^\]]+\]/g;
  let lastIndex = 0;
  let current = { mechanics: [], text: '' };
  let m;
  while ((m = regex.exec(t)) !== null) {
    const token = m[0];
    const before = t.slice(lastIndex, m.index);
    if (before.trim().length > 0) {
      current.text += before;
    }
    if (current.text.trim().length > 0 || current.mechanics.length > 0) {
      blocks.push(current);
      current = { mechanics: [], text: '' };
    }
    const clean = token.replace(/[\[\]]/g, '').trim();
    if (/On Play/i.test(clean)) current.mechanics.push('OnPlay');
    else if (/When Attacking/i.test(clean)) current.mechanics.push('WhenAttacking');
    else if (/Activate:\s*Main/i.test(clean)) current.mechanics.push('ActivateMain');
    else if (/Counter/i.test(clean)) current.mechanics.push('CounterKeyword');
    else if (/Trigger/i.test(clean)) current.mechanics.push('Trigger');
    else if (/Opponent/i.test(clean)) current.mechanics.push('OnlyOppTurn');
    else if (/Your Turn/i.test(clean)) current.mechanics.push('OnlyYourTurn');
    lastIndex = regex.lastIndex;
  }
  const tail = t.slice(lastIndex);
  if (tail.trim().length > 0 || (current.mechanics.length > 0 && current.text.trim().length > 0)) {
    current.text += tail;
    blocks.push(current);
  }
  if (blocks.length === 0) blocks.push({ mechanics: [], text: t });

  // further split by sentences if large blocks
  const expanded = [];
  for (const b of blocks) {
    const parts = (b.text || '').split(/\.(?=\s|$)/).map(x => x.trim()).filter(Boolean);
    if (parts.length <= 1) expanded.push(b);
    else parts.forEach(p => expanded.push({ mechanics: b.mechanics.slice(), text: p }));
  }
  return expanded;
}

function perBlockTags(block) {
  const text = norm(block.text);
  const eff = inferTagsFromText(text);
  // timing flags in requires
  const requires = new Set(eff.requires);
  if (/Once per turn/i.test(text)) requires.add('OncePerTurn');
  if (/opponent's turn|opponent’s turn|opponent's attack/i.test(text)) requires.add('OnlyOppTurn');
  if (/your turn/i.test(text)) requires.add('OnlyYourTurn');
  return {
    produces: eff.produces,
    requires: Array.from(requires),
    mechanics: uniq([...(eff.mechanics || []), ...(block.mechanics || [])])
  };
}

function buildSynergyIndex(cards) {
  const byProduces = {};
  const byRequires = {};
  for (const [id, row] of Object.entries(cards)) {
    const m = row.manual || { produces: [], requires: [], mechanics: [] };
    for (const t of m.produces || []) (byProduces[t] ??= []).push(id);
    for (const r of m.requires || []) (byRequires[r] ??= []).push(id);
  }
  return { byProduces, byRequires };
}

function main() {
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const root = path.resolve(__dirname, '..');
  const allCardsPath = process.argv[2] || path.join(root, 'src/assets/allCards.json');
  const outPath = process.argv[3] || path.join(root, 'public/data/synergy_tags.json');
  const indexPath = process.argv[4] || path.join(root, 'public/data/synergy_index.json');

  const all = JSON.parse(fs.readFileSync(allCardsPath, 'utf8'));
  // Load existing synergy_tags for context (preserve manual/reviewed/notes)
  let existing = { meta: { version: 2 }, cards: {} };
  const existingPath = path.join(root, 'public/data/synergy_tags.json');
  if (fs.existsSync(existingPath)) {
    try { existing = JSON.parse(fs.readFileSync(existingPath, 'utf8')); } catch {}
  }
  const cardsOut = {};
  let count = 0;
  for (const [id, card] of Object.entries(all)) {
    // skip alt/parallel arts: ids containing "_"
    if (id.indexOf('_') !== -1) continue;
    const text = card?.text || '';
    const blocks = splitIntoBlocks(text).map(perBlockTags);
    const auto = {
      produces: uniq(blocks.flatMap(b => b.produces)),
      requires: uniq(blocks.flatMap(b => b.requires)),
      mechanics: uniq(blocks.flatMap(b => b.mechanics)),
    };
    const prev = existing.cards[id] || {};
    cardsOut[id] = {
      blocks,
      auto,
      manual: prev.manual || { produces: [], requires: [], mechanics: [] },
      reviewed: prev.reviewed === true ? true : false,
      notes: prev.notes || undefined,
      lastEditedAt: prev.lastEditedAt || undefined,
    };
    count++;
  }
  const out = { meta: { version: 2 }, cards: cardsOut };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

  // optional index
  const index = buildSynergyIndex(cardsOut);
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

  console.log(`Wrote ${outPath} for ${count} cards.`);
  console.log(`Wrote ${indexPath} (manual-only empty by default).`);
}

main();
