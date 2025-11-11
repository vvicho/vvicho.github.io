// Build edges_v2 from tags_v2
import * as fs from "fs";
import * as path from "path";

type Effects = { inbound?: string[]; outbound?: string[]; keywords?: string[] };
type TagsFileV2 = { meta: any; cards: Record<string, any> };
type EdgeV2 = { from: string; to: string; reason: string; score: number };

const inPath = path.resolve(process.cwd(), "public/data/synergy_tags_v2.json");
const outPath = path.resolve(process.cwd(), "public/data/synergy_edges_v2.json");
const cardsPath = path.resolve(process.cwd(), "src/assets/allCards.json");

const tags = JSON.parse(fs.readFileSync(inPath, "utf8")) as TagsFileV2;
const CARDS: any = JSON.parse(fs.readFileSync(cardsPath, "utf8"));

function effective(e: any): Effects {
  // Support new single-source format: { inbound, outbound, keywords }
  if (e && (e.inbound || e.outbound || e.keywords)) {
    return { inbound: e.inbound || [], outbound: e.outbound || [], keywords: e.keywords || [] };
  }
  // Back-compat with { manual, auto }
  const m = e?.manual || { inbound: [], outbound: [], keywords: [] };
  if ((m.inbound?.length || 0) + (m.outbound?.length || 0) + (m.keywords?.length || 0) > 0) return m;
  return e?.auto || { inbound: [], outbound: [], keywords: [] };
}

const prodIdx: Record<string, string[]> = {};
const reqIdx: Record<string, string[]> = {};

const effBy: Record<string, Effects> = {};
for (const [cid, rec] of Object.entries(tags.cards)) {
  if (cid.includes("_")) continue; // exclude underscore ids
  const eff = effective(rec);
  effBy[cid] = eff;
  for (const p of eff.outbound || []) (prodIdx[p] ||= []).push(cid);
  for (const r of eff.inbound || []) (reqIdx[r] ||= []).push(cid);
}

function firstNum(s: string): number | null { const m = s.match(/-?\d{1,6}/); return m ? parseInt(m[0], 10) : null; }

let edges: EdgeV2[] = [];

// NOTE: DON ladder removed per request (too dense).

// Cost windows vs reducers
(function costWindows(){
  const reducers = Object.keys(prodIdx).filter(k => /^CostMod:[-+]\d+$/.test(k));
  const kos = Object.keys(prodIdx).filter(k => /^KO:Cost<=\d+$/.test(k));
  const rests = Object.keys(prodIdx).filter(k => /^RestTarget:Cost<=\d+$/.test(k));
  for (const red of reducers) {
    const rVal = Math.abs(firstNum(red) || 0);
    for (const w of [...kos, ...rests]) {
      const wVal = firstNum(w) || 0;
      const ratio = wVal ? Math.min(1, rVal / wVal) : 0.5;
      for (const from of prodIdx[red]) for (const to of prodIdx[w]) if (from !== to) edges.push({ from, to, reason: w.startsWith("KO")?"Cost ladder (window)":"Cost ladder (window)", score: ratio });
    }
  }
})();

// Power windows
(function powerWindows(){
  const reducers: string[] = []; // placeholder if you add ReducePower in v2
  const kos = Object.keys(prodIdx).filter(k => /^KO:Power<=\d+$/.test(k));
  for (const red of reducers) {
    const rVal = Math.abs(firstNum(red) || 0);
    for (const w of kos) {
      const wVal = firstNum(w) || 0;
      const ratio = wVal ? Math.min(1, rVal / wVal) : 0.5;
      for (const from of prodIdx[red]) for (const to of prodIdx[w]) if (from !== to) edges.push({ from, to, reason: "Power ladder (window)", score: ratio });
    }
  }
})();

// CostMod with where filters → category/cost based links
(function costModWhere(){
  // Pattern: CostMod:-1[where=Category:{Celestial Dragons}; Cost>=2]
  const producers: Array<{ from: string; k: number; cat?: string; minCost?: number; name?: string; type?: string; attr?: string }> = [];
  for (const [cid, eff] of Object.entries(effBy)) {
    for (const p of eff.outbound || []) {
      const m = p.match(/^CostMod:([+-]?\d+)\[where=([^\]]+)\]$/);
      if (!m) continue;
      const k = parseInt(m[1], 10) || 0;
      const where = m[2];
      const catM = where.match(/Category:\{([^}]+)\}/i);
      const costM = where.match(/Cost>=\s*(\d+)/i);
      const nameM = where.match(/CardName:\{([^}]+)\}/i);
      const typeM = where.match(/(?:CardType|Type):\{([^}]+)\}/i);
      const attrM = where.match(/Attribute:\{([^}]+)\}/i);
      producers.push({ from: cid, k, cat: catM ? catM[1].trim() : undefined, minCost: costM ? parseInt(costM[1], 10) : undefined, name: nameM ? nameM[1].trim() : undefined, type: typeM ? typeM[1].trim() : undefined, attr: attrM ? attrM[1].trim() : undefined });
    }
  }
  if (producers.length === 0) return;

  function matchesFilters(id: string, cat?: string, minCost?: number, name?: string, type?: string, attr?: string): boolean {
    const meta = CARDS[id];
    if (!meta) return false;
    const t = (meta.cardType || '').toUpperCase();
    if (!(t === 'CHARACTER' || t === 'EVENT' || t === 'STAGE' || t === 'LEADER')) {
      return false;
    }
    if (type) {
      if (t !== type.toUpperCase()) return false;
    }
    if (cat) {
      const cats: string[] = Array.isArray(meta.category) ? meta.category : [];
      const ok = cats.some((c: string) => (c || '').toLowerCase() === cat.toLowerCase());
      if (!ok) return false;
    }
    if (typeof minCost === 'number') {
      const c = parseInt(meta.cost, 10);
      if (isFinite(c) && c < minCost) return false;
    }
    if (name) {
      const nm = (meta.name || '').toString().toLowerCase();
      if (!nm.includes(name.toLowerCase())) return false;
    }
    if (attr) {
      const raw = (meta.attribute || '').toString().toLowerCase();
      const tokens = raw.split(/[\/]/).map((s: string) => s.trim()).filter(Boolean);
      if (!tokens.includes(attr.toLowerCase())) return false;
    }
    return true;
  }

  for (const pr of producers) {
    const detail = pr.name ? pr.name : (pr.cat ? pr.cat : (pr.type ? pr.type : (pr.attr ? pr.attr : undefined)));
    const reason = detail ? `Cost reducer: ${detail}` : 'Cost reducer';
    const score = Math.min(1, Math.abs(pr.k) / 5);
    for (const to of Object.keys(CARDS)) {
      if (to.includes("_")) continue; // exclude underscore ids
      if (to === pr.from) continue;
      if (!matchesFilters(to, pr.cat, pr.minCost, pr.name, pr.type, pr.attr)) continue;
      edges.push({ from: pr.from, to, reason, score });
    }
  }
})();

// --- Leader/color constraints ---
type Meta = { cardType?: string; color?: string[] };
function getMeta(id: string): Meta {
  const c = CARDS[id];
  return { cardType: c?.cardType, color: Array.isArray(c?.color) ? c.color : [] };
}
function isLeader(id: string) { return (getMeta(id).cardType || "").toUpperCase() === "LEADER"; }
function isPlayableType(id: string) {
  const t = (getMeta(id).cardType || "").toUpperCase();
  return t === "CHARACTER" || t === "EVENT" || t === "STAGE";
}
function colorsSubset(a: string[] = [], b: string[] = []) {
  const setB = new Set((b||[]).map(x=>x?.toLowerCase()));
  return (a||[]).every(x => setB.has((x||"").toLowerCase()));
}
function leaderCompatible(e: EdgeV2): boolean {
  const aL = isLeader(e.from);
  const bL = isLeader(e.to);
  if (aL && bL) return false; // leaders cannot synergize with other leaders
  if (aL && isPlayableType(e.to)) {
    const L = getMeta(e.from).color || [];
    const O = getMeta(e.to).color || [];
    return colorsSubset(O, L);
  }
  if (bL && isPlayableType(e.from)) {
    const L = getMeta(e.to).color || [];
    const O = getMeta(e.from).color || [];
    return colorsSubset(O, L);
  }
  return true;
}

// Remove edges involving underscore ids, then apply leader compatibility
edges = edges.filter(e => !e.from.includes("_") && !e.to.includes("_"));
edges = edges.filter(leaderCompatible);

// Dedup keep max score
const best = new Map<string, EdgeV2>();
for (const e of edges) {
  const k = `${e.from}→${e.to}`;
  const prev = best.get(k);
  if (!prev || e.score > prev.score) best.set(k, e);
}

if (!fs.existsSync(path.dirname(outPath))) fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ meta: { generatedAt: new Date().toISOString() }, edges: Array.from(best.values()) }, null, 2));
console.log(`Wrote ${outPath} with ${Array.from(best.values()).length} edges`);


