// generate_synergies.ts
// Usage:
//   npx ts-node generate_synergies.ts path/to/allCards.json path/to/synergy_tags.json
//
// Reads allCards.json and emits synergy_tags.json with:
// - blocks[]: per-clause produces/requires/mechanics
// - auto: flat union of tokens
// - manual: empty placeholders (you will curate later)
// - reviewed: false

import * as fs from "fs";
import * as path from "path";

type Effects = { produces: string[]; requires: string[]; mechanics: string[] };
type Card = { id: string; name: string; text?: string; cardSetCode?: string; cardType?: string; trigger?:string; };

type TagsForCard = {
  manual: Effects;
  auto: Effects;
  blocks: Effects[];
  reviewed: boolean;
  lastEditedAt?: string;
};

type TagsFile = {
  meta: { version: number };
  cards: Record<string, TagsForCard>;
};

function norm(s?: string) { return (s || "").replace(/\s+/g, " ").trim(); }
function uniq(a: string[]) { return Array.from(new Set(a)); }
function nowIso() { return new Date().toISOString(); }

// --- Clause segmentation ---
const TIMING_MARKERS = [
  "On Play",
  "When Attacking",
  "When Blocking",
  "On Your Opponent's Attack",
  "On Opponent's Attack",
  "On K.O.",
  "Activate: Main",
  "Your Turn",
  "Opponent's Turn",
  "End of Your Turn",
  "Start of Your Next Turn",
  "Trigger"
];

function splitIntoClauses(text?: string): { raw: string; mechanics: string[] }[] {
  const t = norm(text);
  if (!t) return [];
  // Split by bracket boundaries but keep the bracketed header with the segment
  const parts = t
    .replace(/\]\s*\[/g, "]|[")
    .replace(/\]\s*\.\s*\[/g, "]|[")
    .split("|")
    .map(s => s.trim())
    .filter(Boolean);

  const clauses: { raw: string; mechanics: string[] }[] = [];
  for (const p of parts) {
    const mech: string[] = [];
    for (const mk of TIMING_MARKERS) {
      const re = new RegExp(`\\[\\s*${mk.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\s*\\]`, "i");
      if (re.test(p)) mech.push(mk.replace(/\s+/g, "")); // normalize e.g. "OnPlay"
    }
    clauses.push({ raw: p, mechanics: mech });
  }
  // If nothing split, return single clause
  if (clauses.length === 0) return [{ raw: t, mechanics: [] }];
  return clauses;
}

// --- Token emitters ---
function emitTokensFromClause(clause: string): Effects {
  const t = norm(clause);
  const prod: string[] = [];
  const req: string[] = [];
  const mech: string[] = [];

  // Mechanics from clause header
  if (/\[\s*On Play\s*\]/i.test(t)) mech.push("OnPlay");
  if (/\[\s*When Attacking\s*\]/i.test(t)) mech.push("WhenAttacking");
  if (/\[\s*When Blocking\s*\]/i.test(t)) mech.push("WhenBlocking");
  if (/\[\s*On (?:Your )?Opponent's Attack\s*\]/i.test(t)) mech.push("OnOppAttack");
  if (/\[\s*Activate:\s*Main\s*\]/i.test(t)) mech.push("ActivateMain");
  if (/\[\s*Trigger\s*\]/i.test(t)) mech.push("Trigger");
  if (/\bOnce Per Turn\b/i.test(t)) req.push("OncePerTurn");
  if (/\bOnly during your opponent'?s turn\b/i.test(t)) req.push("OnlyOppTurn");
  // --- Trigger cards in hand / costs / play-conditions ---

  // Discard/trash a card with Trigger from hand (Nami-type)
  if (/\btrash\s*1\s*card\s*with\s*(?:a\s*)?\[?\s*trigger\s*\]?\s*from your hand/i.test(t) ||
  /\bdiscard\s*1\s*trigger\s*card\s*from your hand/i.test(t)) {
  req.push("NeedsHand:HasTrigger>=1");
  req.push("CostDiscardFromHand:HasTrigger>=1");
  }

  // “If you play a card with Trigger …” (Bonney-type gate)
  if (/\bif you (?:play|played) (?:a|1)\s*card\s*with\s*(?:a\s*)?\[?\s*trigger\s*\]?/i.test(t)) {
  req.push("NeedsPlayedThisTurn:HasTrigger>=1");
  }

  // “When you play a card with Trigger …” (timing form)
  if (/\bwhen you play (?:a|1)\s*card\s*with\s*(?:a\s*)?\[?\s*trigger\s*\]?/i.test(t)) {
  req.push("NeedsPlayedThisTurn:HasTrigger>=1");
  mech.push("OnPlayCardWithTrigger");
  }

  // Optional: explicit producers if text says “play a card with Trigger”
  if (/\bplay (?:a|1)\s*card\s*with\s*(?:a\s*)?\[?\s*trigger\s*\]?/i.test(t)) {
  prod.push("PlayFromHand:Filter:HasTrigger");
  }


  // Leader trait gates (supports OR)
  const mLeaderAny = t.match(/your leader (?:has|is)(?: the)? (?:\{?([A-Za-z ’'\-\.]+)\}?)(?:\s*or\s*\{?([A-Za-z ’'\-\.]+)\}?)?\s*type/i);
  if (mLeaderAny) {
    const traits = [mLeaderAny[1], mLeaderAny[2]].filter(Boolean).map(s => (s || "").trim());
    if (traits.length > 1) req.push(`LeaderIsTraitAnyOf:[${traits.join(", ")}]`);
    else if (traits.length === 1) req.push(`LeaderIsTrait:${traits[0]}`);
  }

  // DON: cost/gates
  for (const m of t.matchAll(/\[ ?DON!! ?x(\d+) ?\]/gi)) {
    req.push(`NeedsDONAttachedToSelf>=${m[1]}`);
  }

  // Costs: discard from hand
  if (/you may trash\s*(\d+)\s*card/i.test(t) || /trash\s*1\s*card from your hand/i.test(t)) {
    const m = t.match(/trash\s*(\d+)\s*card/i);
    req.push(`CostDiscardFromHand>=${m ? m[1] : 1}`);
  }

  // DON manipulation / give rested
  let m: RegExpExecArray | null;
  if ((m = /give up to\s*(\d+)\s*rested\s*don!! card/i.exec(t))) {
    prod.push(`AttachRestedDON:${m[1]}:Targets:Leader|Character`);
  }
  if ((m = /add up to\s*(\d+)\s*don!! card/i.exec(t))) {
    prod.push(`DONAdd:${m[1]}:Active`);
  }
  if ((m = /set up to\s*(\d+)\s*of your don!! cards as active/i.exec(t))) {
    prod.push(`DONActive:${m[1]}`);
  }
  for (const dm of t.matchAll(/don!!\s*[-−]\s*(\d+)/gi)) {
    prod.push(`DONRemove:${dm[1]}`);
  }

  // Power modifiers
  for (const r of t.matchAll(/give\s+up\s+to\s+1\s+of\s+(?:your\s+opponent'?s\s+)?(?:leaders?|characters?)[^.\n]*[-−]\s*(\d{3,5})\s*power/gi)) {
    prod.push(`ReducePower:${r[1]}:ThisTurn:Scope:EnemyAny`);
  }
  for (const r of t.matchAll(/gains?\s*\+(\d{3,5})\s*power/gi)) {
    if (/leader gains/i.test(t)) prod.push(`BuffSelfPower:+${r[1]}:UntilStartOfYourNextTurn`);
    else prod.push(`BuffPower:+${r[1]}:Scope:Allies`);
  }

  // Counter buffs / auras
  const aura = t.match(/all of your\s*\{?\s*([A-Za-z ’'\-\.]+)\s*\}?\s*type character cards without a counter have a \+(\d+)\s*counter/i);
  if (aura) {
    prod.push(`GrantCounterToAllies:+${aura[2]}:Trait:${aura[1]}:Filter:NoCounter:Persistent`);
  }

  // KO / Rest windows (verb-only rest; exclude "the rest")
  const isRestVerb = /\b(?:you may )?rest\b/i.test(t) && /character/i.test(t) && !/\bthe rest\b/i.test(t);
  const mRestBase = t.match(/\brest[^.]*?base cost(?: of)?\s*(\d+)\s*or less/i);
  if (mRestBase && isRestVerb) prod.push(`Rest:BaseCost<=${mRestBase[1]}`);
  else if (isRestVerb) prod.push("Rest");

  if ((m = /k\.?o\.?[^.]*cost(?: of)?\s*(\d+)\s*or less/i.exec(t))) prod.push(`KO:Cost<=${m[1]}`);
  if ((m = /k\.?o\.?[^.]*base cost(?: of)?\s*(\d+)\s*or less/i.exec(t))) prod.push(`KO:BaseCost<=${m[1]}`);
  if ((m = /k\.?o\.?[^.]*?(\d{3,5})\s*(?:base )?power\s*or less/i.exec(t))) prod.push(`KO:Power<=${m[1]}`);

  // Play/Return from trash
  if ((m = /play[^.]*?with a cost of\s*(\d+)\s*(?:to|[-–])\s*(\d+)[^.]*?from your trash/i.exec(t))) {
    const a = Math.min(parseInt(m[1],10), parseInt(m[2],10));
    const b = Math.max(parseInt(m[1],10), parseInt(m[2],10));
    prod.push(`PlayFromTrash:CostRange:${a}-${b}`);
  }
  if ((m = /play[^.]*?with a cost of\s*(\d+)\s*or less[^.]*?from your trash/i.exec(t))) {
    prod.push(`PlayFromTrash:Cost<=${m[1]}`);
  }
  if (/play[^.]*from your trash/i.test(t) && !prod.some(p=>p.startsWith("PlayFromTrash"))) {
    prod.push("PlayFromTrash:Generic");
  }
  if (/return[^.]*from your trash[^.]*to your hand/i.test(t)) prod.push("ReturnFromTrashToHand:Generic");

  // Deck interaction: look top, arrange, place rest, play from top
  const mLookTop = t.match(/look at\s*(\d+)\s*cards? from the top of your deck/i);
  if (mLookTop) prod.push(`LookTop:${mLookTop[1]}`);
  if (/(?:put|place) (?:them|those cards) in any order on top of your deck/i.test(t)) {
    const n = mLookTop?.[1] ?? "0";
    prod.push(`ArrangeTop:${n}`);
  }
  if (/(?:put|place) (?:them|those cards) in any order on the bottom of your deck/i.test(t)) {
    const n = mLookTop?.[1] ?? "0";
    prod.push(`ArrangeBottom:${n}`);
  }
  if (/place the rest (?:of (?:those )?cards )?on top of your deck/i.test(t)) prod.push("PlaceRest:Top");
  if (/place the rest (?:of (?:those )?cards )?on the bottom of your deck/i.test(t)) prod.push("PlaceRest:Bottom");

  const mPlayTopCost = t.match(/play [^.]* from the top of your deck[^.]*cost(?: of)?\s*(\d+)\s*or less/i);
  if (mPlayTopCost) {
    prod.push(`PlayFromTop:Cost<=${mPlayTopCost[1]}`);
    req.push("NeedsTopDeckManipulation");
  } else if (/play [^.]* from the top of your deck/i.test(t)) {
    const n = mLookTop?.[1] ?? "1";
    prod.push(`PlayFromTop:${n}`);
    req.push("NeedsTopDeckManipulation");
  }

  // Trait/ally board gates
  const mNeedsAllyTraitCost = t.match(/if you have a\s*\{?\s*([A-Za-z ’'\-\.]+)\s*\}?\s*type character[^.]*cost(?: of)?\s*(\d+)\s*or more/i);
  if (mNeedsAllyTraitCost) {
    req.push(`NeedsAllyTrait:${mNeedsAllyTraitCost[1]}:Cost>=${mNeedsAllyTraitCost[2]}>=1`);
  }

  // Life-removed (Nami-like)
  if (/removed from (?:either|any) player's life|removed from (?:your|their|the) life/i.test(t)) {
    const d = t.match(/draw\s*(\d+)\s*card/i);
    if (d) prod.push(`OnLifeRemoved:Draw:${d[1]}`);
    else prod.push("OnLifeRemoved:Effect");
  }

  // Ladder helpers
  if (prod.some(p => /^KO:Cost(<=|==)/.test(p))) req.push("Enable:LowerCost");
  if (prod.some(p => /^KO:(?:Power|BasePower)(<=|==)/.test(p))) req.push("Enable:LowerPower");

  return { produces: uniq(prod), requires: uniq(req), mechanics: uniq(mech) };
}

// Aggregate flat auto from blocks
function aggregateAuto(blocks: Effects[]): Effects {
  const p = new Set<string>(), r = new Set<string>(), m = new Set<string>();
  for (const b of blocks) {
    for (const x of b.produces) p.add(x);
    for (const x of b.requires) r.add(x);
    for (const x of b.mechanics) m.add(x);
  }
  return { produces: Array.from(p), requires: Array.from(r), mechanics: Array.from(m) };
}

// Main
const [inPath, outPath] = process.argv.slice(2);
if (!inPath || !outPath) {
  console.error("Usage: npx ts-node generate_synergies.ts <allCards.json> <synergy_tags.json>");
  process.exit(1);
}

const cardsRaw = JSON.parse(fs.readFileSync(inPath, "utf8")) as Record<string, Card>;
const out: TagsFile = { meta: { version: 2 }, cards: {} };

for (const [cid, card] of Object.entries(cardsRaw)) {
  // skip alt arts / non-regular: ids with underscore
  if (cid.includes("_")) continue;
  const clauses = splitIntoClauses(card.text || "");
  const blocks = clauses.map(c => {
    const eff = emitTokensFromClause(c.raw);
    // Attach clause mechanics detected via header parsing
    eff.mechanics = uniq([...eff.mechanics, ...c.mechanics]);
    return eff;
  }).filter(b => b.produces.length || b.requires.length || b.mechanics.length);

  

  // --- Trigger identity for cards that have a trigger box (even if textless)
  const typeNorm =
  (card as any).cardType?.toString().toLowerCase() ||
  (card as any).type?.toString().toLowerCase() || "";

  const triggerRaw = (card as any).trigger ?? (card as any).triggerText ?? "";
  const hasTriggerProp = typeof triggerRaw === "string" && triggerRaw.trim().length > 0;

  if (hasTriggerProp) {
  const ids: string[] = ["HasTrigger"];
  if (typeNorm === "character") ids.push("Character:HasTrigger");
  // identity block — do not filter out; blocks was already filtered above
  blocks.push({ produces: ids, requires: [], mechanics: [] });
  }

  // --- Strict NoBaseEffect: Character with no text and no trigger
  const hasNoText =
  !("text" in card) ||
  typeof card.text !== "string" ||
  card.text.trim().length === 0;

  if (typeNorm === "character" && hasNoText && !hasTriggerProp) {
  blocks.push({ produces: ["NoBaseEffect"], requires: [], mechanics: [] });
  }


  const auto = aggregateAuto(blocks);
  out.cards[cid] = {
    manual: { produces: [], requires: [], mechanics: [] },
    auto,
    blocks,
    reviewed: false,
    lastEditedAt: nowIso()
  };
}

fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`Wrote ${outPath} with ${Object.keys(out.cards).length} cards`);
