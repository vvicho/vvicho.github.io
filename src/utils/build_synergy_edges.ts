// build_synergy_edges.ts
// Usage:
//   npx tsx build_synergy_edges.ts <synergy_tags.json> <synergy_edges.json> [leaderTraitsCsv]
//   npx ts-node build_synergy_edges.ts <synergy_tags.json> <synergy_edges.json> [leaderTraitsCsv]
//
// Example:
//   npx tsx build_synergy_edges.ts ./data/synergy_tags.json ./data/synergy_edges.json "Land of Wano,Whitebeard Pirates"
//
// The scorer builds directed edges (from producer → consumer) with a reason and score.
// It uses MANUAL tags if present; otherwise falls back to AUTO for that card.

import * as fs from "fs";

type Effects = { produces: string[]; requires: string[]; mechanics: string[] };
type TagsForCard = {
  manual: Effects;
  auto: Effects;
  blocks?: Effects[];
  reviewed: boolean;
  lastEditedAt?: string;
};
type TagsFile = { meta: { version: number }; cards: Record<string, TagsForCard> };

type Edge = { from: string; to: string; reason: string; score: number };
type Graph = { meta: { scoring: string; leaderTraits: string[] }, edges: Edge[], nodes: string[] };

const [inPath, outPath, leaderCsv] = process.argv.slice(2);
if (!inPath || !outPath) {
  console.error("Usage: npx tsx build_synergy_edges.ts <synergy_tags.json> <synergy_edges.json> [leaderTraitsCsv]");
  process.exit(1);
}

const leaderTraits = (leaderCsv || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const tags = JSON.parse(fs.readFileSync(inPath, "utf8")) as TagsFile;

// Helper to get effective tags (manual or fallback to auto)
function effective(card: TagsForCard): Effects {
  const m = card.manual || { produces: [], requires: [], mechanics: [] };
  if ((m.produces?.length || 0) + (m.requires?.length || 0) + (m.mechanics?.length || 0) > 0) return m;
  return card.auto || { produces: [], requires: [], mechanics: [] };
}

// Leader filter: return false if a consumer's requires contradict leader traits
function leaderAllows(reqs: string[]): boolean {
  if (!reqs || reqs.length === 0 || leaderTraits.length === 0) return true;
  const must = reqs.filter(r => r.startsWith("LeaderIsTrait:")).map(r => r.split(":")[1]);
  const anyOf = reqs
    .filter(r => r.startsWith("LeaderIsTraitAnyOf:["))
    .flatMap(r => r.slice(r.indexOf("[") + 1, r.indexOf("]")).split(",").map(s => s.trim()));

  if (must.length > 0) {
    for (const t of must) if (!leaderTraits.includes(t)) return false;
  }
  if (anyOf.length > 0) {
    const ok = anyOf.some(t => leaderTraits.includes(t));
    if (!ok) return false;
  }
  return true;
}

// Build inverted indexes for fast matching
const produceIdx: Record<string, string[]> = {};
const requireIdx: Record<string, string[]> = {};
const effByCard: Record<string, Effects> = {};

for (const [cid, row] of Object.entries(tags.cards)) {
  const eff = effective(row);
  effByCard[cid] = eff;
  for (const p of eff.produces || []) (produceIdx[p] ||= []).push(cid);
  for (const r of eff.requires || []) (requireIdx[r] ||= []).push(cid);
}

// Utility to get first number in a token
function firstNumber(s: string): number | null {
  const m = s.match(/-?\d{1,6}/);
  return m ? parseInt(m[0], 10) : null;
}

const edges: Edge[] = [];

// --- Rules ---

// A) DON ladder: Attach/Add DON → NeedsDONAttachedToSelf>=k
(function donLadder() {
  const requireKeys = Object.keys(requireIdx).filter(k => /^NeedsDONAttachedToSelf>=(\d+)$/.test(k));
  const donors = Object.keys(produceIdx).filter(k => /^(AttachRestedDON:\d+|DONAdd:\d+|AttachDON:\d+)/.test(k));
  for (const rk of requireKeys) {
    const need = firstNumber(rk) || 1;
    const consumers = requireIdx[rk];
    for (const dk of donors) {
      const give = firstNumber(dk) || 1;
      const score = Math.min(1, give / need);
      for (const from of produceIdx[dk]) {
        for (const to of consumers) {
          if (from === to) continue;
          if (!leaderAllows(effByCard[to]?.requires || [])) continue;
          edges.push({ from, to, reason: "DON ladder", score });
        }
      }
    }
  }
})();

// B) Cost ladder: Reduce/Set Cost → Enable:LowerCost and KO/Rest (base cost) windows
(function costLadder() {
  const reducers = Object.keys(produceIdx).filter(k => /^ReduceCost:\d+:/i.test(k) || /^SetCost:\d+:/i.test(k));
  const enablers = Object.keys(requireIdx).filter(k => /^Enable:LowerCost$/i.test(k));
  const windows = Object.keys(produceIdx).filter(k => /^KO:(?:Cost|BaseCost)<=\d+$/i.test(k) || /^Rest:BaseCost<=\d+$/i.test(k));

  // reducers → Enable:LowerCost consumers
  for (const red of reducers) {
    const rVal = firstNumber(red) || 0;
    for (const toKey of enablers) {
      for (const from of produceIdx[red]) {
        for (const to of requireIdx[toKey]) {
          if (from === to) continue;
          if (!leaderAllows(effByCard[to]?.requires || [])) continue;
          edges.push({ from, to, reason: "Cost ladder (enable)", score: rVal > 0 ? 0.6 : 0.4 });
        }
      }
    }
  }

  // reducers enabling KO/Rest windows on other cards (indirect but valuable)
  for (const red of reducers) {
    const rVal = firstNumber(red) || 0;
    for (const win of windows) {
      const wVal = firstNumber(win) || 0;
      const ratio = wVal ? Math.min(1, rVal / wVal) : 0.5;
      for (const from of produceIdx[red]) {
        for (const winOwner of produceIdx[win]) {
          if (from === winOwner) continue;
          if (!leaderAllows(effByCard[winOwner]?.requires || [])) continue;
          edges.push({ from, to: winOwner, reason: "Cost ladder (window)", score: ratio });
        }
      }
    }
  }
})();

// C) Power ladder: ReducePower → Enable:LowerPower and KO:Power<=X
(function powerLadder() {
  const reducers = Object.keys(produceIdx).filter(k => /^ReducePower:\d+:/i.test(k));
  const enablers = Object.keys(requireIdx).filter(k => /^Enable:LowerPower$/i.test(k));
  const windows = Object.keys(produceIdx).filter(k => /^KO:(?:Power|BasePower)<=\d+$/i.test(k));

  // reducers → Enable:LowerPower consumers
  for (const red of reducers) {
    const rVal = firstNumber(red) || 0;
    for (const toKey of enablers) {
      for (const from of produceIdx[red]) {
        for (const to of requireIdx[toKey]) {
          if (from === to) continue;
          if (!leaderAllows(effByCard[to]?.requires || [])) continue;
          edges.push({ from, to, reason: "Power ladder (enable)", score: rVal > 0 ? 0.6 : 0.4 });
        }
      }
    }
  }

  // reducers enabling KO power windows
  for (const red of reducers) {
    const rVal = firstNumber(red) || 0;
    for (const win of windows) {
      const wVal = firstNumber(win) || 0;
      const ratio = wVal ? Math.min(1, rVal / wVal) : 0.5;
      for (const from of produceIdx[red]) {
        for (const winOwner of produceIdx[win]) {
          if (from === winOwner) continue;
          if (!leaderAllows(effByCard[winOwner]?.requires || [])) continue;
          edges.push({ from, to: winOwner, reason: "Power ladder (window)", score: ratio });
        }
      }
    }
  }
})();

// D) Top-deck stack ↔ PlayFromTop
(function topDeckLadder() {
  const stackers = Object.keys(produceIdx).filter(k => /^ArrangeTop:\d+$/.test(k) || /^PlaceRest:Top$/.test(k));
  const players = Object.keys(produceIdx).filter(k => /^PlayFromTop:/.test(k));
  for (const s of stackers) {
    for (const p of players) {
      for (const from of produceIdx[s]) {
        for (const to of produceIdx[p]) {
          if (from === to) continue;
          if (!leaderAllows(effByCard[to]?.requires || [])) continue;
          edges.push({ from, to, reason: "Top-deck stack → PlayFromTop", score: 1.0 });
        }
      }
    }
  }
})();

// E) Trash/Revive ladders
(function trashLadder() {
  const revivers = Object.keys(produceIdx).filter(k => /^PlayFromTrash:/.test(k) || /^ReturnFromTrashToHand:/.test(k));
  const gates = Object.keys(requireIdx).filter(k => /^NeedsTrash(?:Trait|Type|Cost<=\d+)>?=/.test(k));
  for (const r of revivers) {
    for (const g of gates) {
      for (const from of produceIdx[r]) {
        for (const to of requireIdx[g]) {
          if (from === to) continue;
          if (!leaderAllows(effByCard[to]?.requires || [])) continue;
          edges.push({ from, to, reason: "Trash ladder", score: 0.8 });
        }
      }
    }
  }
})();

// F) Trait/Ally board gates
(function allyTraitLadder() {
  const needers = Object.keys(requireIdx).filter(k => /^NeedsAllyTrait:/.test(k));
  if (needers.length === 0) return;

  const traitSearchers = Object.keys(produceIdx).filter(k => /^SearchTrait:/.test(k));
  const traitPlayers  = Object.keys(produceIdx).filter(k => /^PlayFrom(Hand|Top|Trash):/.test(k) || /^PlayFromTop:/.test(k));
  const enablers = Object.keys(produceIdx).filter(k => /^ReduceCost:\d+/.test(k) || /^DON(Add|Active|Attach|AttachRestedDON):\d+/.test(k));

  for (const need of needers) {
    const trait = need.split(":")[1];
    const consumers = requireIdx[need];

    // Direct play/search mentioning the trait in the token
    const direct = [...traitPlayers, ...traitSearchers].filter(t => t.includes(trait));
    for (const d of direct) {
      for (const from of produceIdx[d]) {
        for (const to of consumers) {
          if (from === to) continue;
          if (!leaderAllows(effByCard[to]?.requires || [])) continue;
          edges.push({ from, to, reason: `Enable ally ${trait} (direct)`, score: 1.0 });
        }
      }
    }

    // Indirect enablers (cost reducers, DON ramp)
    for (const e of enablers) {
      for (const from of produceIdx[e]) {
        for (const to of consumers) {
          if (from === to) continue;
          if (!leaderAllows(effByCard[to]?.requires || [])) continue;
          const reason = /^ReduceCost/.test(e) ? "Enable ally (cost)" : "Enable ally (DON)";
          edges.push({ from, to, reason, score: 0.6 });
        }
      }
    }
  }
})();

// G) Trigger ladder: trigger-identity cards → effects that require trigger cards
(function triggerLadder() {
  // Consumers: needs trigger in hand / as discard cost / played this turn
  const consumersKeys = Object.keys(requireIdx).filter(k =>
    /^NeedsHand:HasTrigger>=(\d+)$/.test(k) ||
    /^CostDiscardFromHand:HasTrigger>=(\d+)$/.test(k) ||
    /^NeedsPlayedThisTurn:HasTrigger>=(\d+)$/.test(k)
  );
  if (consumersKeys.length === 0) return;

  // Sources: any card that advertises it has Trigger (identity)
  const triggerSources = Object.keys(produceIdx).filter(k => k === "HasTrigger" || k === "Character:HasTrigger");
  if (triggerSources.length === 0) return;

  for (const rk of consumersKeys) {
    const consumers = requireIdx[rk];
    for (const src of triggerSources) {
      for (const from of produceIdx[src]) {
        for (const to of consumers) {
          if (from === to) continue;
          if (!leaderAllows(effByCard[to]?.requires || [])) continue;
          const reason =
            rk.startsWith("NeedsPlayedThisTurn") ? "Trigger ladder (played trigger enabler)" :
            rk.startsWith("CostDiscardFromHand") ? "Trigger ladder (discard trigger enabler)" :
            "Trigger ladder (hand contains trigger)";
          const score = rk.startsWith("NeedsPlayedThisTurn") ? 0.9 : 0.8;
          edges.push({ from, to, reason, score });
        }
      }
    }
  }
})();

// Deduplicate: keep max score per (from,to), merge reasons if same score
const best = new Map<string, Edge>();
for (const e of edges) {
  const k = `${e.from}→${e.to}`;
  const prev = best.get(k);
  if (!prev || e.score > prev.score) best.set(k, e);
  else if (prev && prev.score === e.score && prev.reason !== e.reason) {
    prev.reason = prev.reason + " + " + e.reason;
    best.set(k, prev);
  }
}

const out: Graph = {
  meta: {
    scoring: "Rules: DON ladder; Cost ladder; Power ladder; Top-deck stack; Trash ladder; Ally trait gates; Trigger ladder. Manual preferred; auto fallback. Optional leader filter.",
    leaderTraits
  },
  edges: Array.from(best.values()).sort((a, b) => b.score - a.score),
  nodes: Object.keys(tags.cards)
};

fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`Wrote ${outPath} with ${out.edges.length} edges`);
