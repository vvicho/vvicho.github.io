// src/utils/tagParser.ts
// Deterministic parser for OPTCG card text → auto tags.
// Covers: KO/Bounce/Bottom/Top, Reduce/Set, Rest (verb only), BaseCost/BasePower,
// Play/Return from Trash, DON, Life-removed (Nami), Leader locks, Trash counts,
// Deck stacking (ArrangeTop/Bottom, PlaceRest:*), PlayFromTop.

export type Effects = { produces: string[]; requires: string[]; mechanics: string[] };
export type Card = { id: string; name: string; text?: string };

const DUR = {
  OPP_NEXT: /until the end of your opponent's next turn/i,
  END_THIS: /until (?:the )?end of (?:this|your) turn/i,
  START_NEXT: /until the start of your next turn/i,
  THIS_TURN: /(?:during|this) turn/i,
};

function uniq(a: string[]) { return Array.from(new Set(a)); }
function norm(s?: string) { return (s || "").replace(/\s+/g, " ").trim(); }

export function inferTagsFromText(text?: string): Effects {
  const T: Effects = { produces: [], requires: [], mechanics: [] };
  if (!text) return T;
  const t = norm(text);

  // mechanics / timings / keywords
  if (/\[\s*On Play\s*\]/i.test(t)) T.mechanics.push("OnPlay");
  if (/\[\s*When Attacking\s*\]/i.test(t)) T.mechanics.push("WhenAttacking");
  if (/\[\s*Activate:\s*Main\s*\]/i.test(t)) T.mechanics.push("ActivateMain");
  if (/\bTrigger\b/i.test(t)) T.mechanics.push("Trigger");
  if (/\bBlocker\b/i.test(t)) T.mechanics.push("Blocker");
  if (/\bRush\b/i.test(t)) T.mechanics.push("Rush");
  if (/\bDouble Attack\b/i.test(t)) T.mechanics.push("DoubleAttack");
  if (/^\s*\[\s*Counter\s*\]/i.test(t)) T.mechanics.push("CounterKeyword");

  // duration upgrade helper
  const upgradeDuration = (token: string) => {
    if (DUR.OPP_NEXT.test(t)) return token.replace(/:ThisTurn$/, ":UntilEndOfOppNextTurn");
    if (DUR.END_THIS.test(t)) return token.replace(/:ThisTurn$/, ":UntilEndOfTurn");
    if (DUR.START_NEXT.test(t)) return token.replace(/:ThisTurn$/, ":UntilStartOfYourNextTurn");
    return token;
  };

  // KO windows
  let m: RegExpExecArray | null;
  if ((m = /K\.?O\.?[^.]*cost(?: of)?\s*(\d+)\s*or less/i.exec(t))) T.produces.push(`KO:Cost<=${m[1]}`);
  if ((m = /K\.?O\.?[^.]*cost(?: of)?\s*(\d+)\b(?!\s*or)/i.exec(t))) T.produces.push(`KO:Cost==${m[1]}`);
  if ((m = /K\.?O\.?[^.]*base cost(?: of)?\s*(\d+)\s*or less/i.exec(t))) T.produces.push(`KO:BaseCost<=${m[1]}`);
  if ((m = /K\.?O\.?[^.]*?(\d{3,5})\s*(?:base )?power\s*or less/i.exec(t))) T.produces.push(`KO:Power<=${m[1]}`);
  if (/K\.?O\.?[^.]*cost\s*0/i.test(t)) T.produces.push("KO:Cost==0");

  // Reducers/Setters (default ThisTurn, upgrade via phrases)
  if ((m = /reduce[^.]*cost[^.]*by\s*(\d+)/i.exec(t))) T.produces.push(upgradeDuration(`ReduceCost:${m[1]}:ThisTurn`));
  if ((m = /give[^.]*?(-?\d+)\s*cost/i.exec(t))) T.produces.push(upgradeDuration(`ReduceCost:${Math.abs(parseInt(m[1],10))}:ThisTurn`));
  if ((m = /reduce[^.]*power[^.]*by\s*(\d{3,5})/i.exec(t))) T.produces.push(upgradeDuration(`ReducePower:${m[1]}:ThisTurn`));
  if ((m = /give[^.]*?(-?\d{3,5})\s*power/i.exec(t))) T.produces.push(upgradeDuration(`ReducePower:${Math.abs(parseInt(m[1],10))}:ThisTurn`));
  if ((m = /set[^.]*cost(?: to| as)?\s*(\d+)/i.exec(t))) T.produces.push(upgradeDuration(`SetCost:${m[1]}:ThisTurn`));
  if ((m = /set[^.]*power(?: to| as)?\s*(\d+)/i.exec(t))) T.produces.push(upgradeDuration(`SetPower:${m[1]}:ThisTurn`));

  // Return / Displace / Rest
  if ((m = /return[^.]*?(?:with (?:a )?)?cost(?: of)?\s*(\d+)\s*or less[^.]*\bto the (?:owner's )?(?:hand|deck|bottom|top)/i.exec(t))) {
    T.produces.push(`Bounce:Cost<=${m[1]}`);
  }
  if (/(?:place .* at the )?bottom of (?:its owner's )?deck|bottom deck/i.test(t)) T.produces.push("BottomDeck:Cost<=99");
  if (/(?:place .* at the )?top of (?:its owner's )?deck|top deck/i.test(t)) T.produces.push("TopDeck:Cost<=99");

  // Rest as verb only (must target Character and not be "the rest")
  const isRestVerb = /\b(?:you may )?rest\b/i.test(t) && /character/i.test(t) && !/\bthe rest\b/i.test(t);
  if (isRestVerb) {
    if ((m = /\brest[^.]*?base cost(?: of)?\s*(\d+)\s*or less/i.exec(t))) T.produces.push(`Rest:BaseCost<=${m[1]}`);
    else T.produces.push("Rest");
  }

  // Look/Reveal Top N
  const mLookTop = /look at\s*(\d+)\s*cards? from the top of your deck/i.exec(t);
  if (mLookTop) T.produces.push(`LookTop:${mLookTop[1]}`);
  const mRevealTop = /reveal\s*(\d+)\s*cards? from the top of your deck/i.exec(t);
  if (mRevealTop) T.produces.push(`RevealTop:${mRevealTop[1]}`);

  // Arrange/Place rest (stacking)
  if (/(?:put|place) (?:them|those cards) in any order on top of your deck/i.test(t)) {
    const n = mLookTop?.[1] ?? mRevealTop?.[1] ?? "0";
    T.produces.push(`ArrangeTop:${n}`);
  }
  if (/(?:put|place) (?:them|those cards) in any order on the bottom of your deck/i.test(t)) {
    const n = mLookTop?.[1] ?? mRevealTop?.[1] ?? "0";
    T.produces.push(`ArrangeBottom:${n}`);
  }
  if (/place the rest (?:of (?:those )?cards )?on top of your deck/i.test(t)) T.produces.push("PlaceRest:Top");
  if (/place the rest (?:of (?:those )?cards )?on the bottom of your deck/i.test(t)) T.produces.push("PlaceRest:Bottom");

  // Top-of-deck play
  if ((m = /play [^.]* from the top of your deck[^.]*cost(?: of)?\s*(\d+)\s*or less/i.exec(t))) {
    T.produces.push(`PlayFromTop:Cost<=${m[1]}`);
    T.requires.push("NeedsTopDeckManipulation");
  } else if (/play [^.]* from the top of your deck/i.test(t)) {
    const n = mLookTop?.[1] ?? mRevealTop?.[1] ?? "1";
    T.produces.push(`PlayFromTop:${n}`);
    T.requires.push("NeedsTopDeckManipulation");
  }

  // Play/Return from trash
  if ((m = /play[^.]*?with a cost of\s*(\d+)\s*(?:to|[-–])\s*(\d+)[^.]*?from your trash/i.exec(t))) {
    const a = Math.min(parseInt(m[1],10), parseInt(m[2],10));
    const b = Math.max(parseInt(m[1],10), parseInt(m[2],10));
    T.produces.push(`PlayFromTrash:CostRange:${a}-${b}`);
  }
  if ((m = /play[^.]*?with a cost of\s*(\d+)\s*or less[^.]*?from your trash/i.exec(t))) {
    T.produces.push(`PlayFromTrash:Cost<=${m[1]}`);
  }
  if (/play[^.]*from your trash/i.test(t) && !T.produces.some(p=>p.startsWith("PlayFromTrash"))) {
    T.produces.push("PlayFromTrash:Generic");
  }
  if (/return[^.]*from your trash[^.]*to your hand/i.test(t)) T.produces.push("ReturnFromTrashToHand:Generic");

  // DON
  if ((m = /add up to\s*(\d+)\s*don/i.exec(t))) T.produces.push(`DONAdd:${m[1]}`);
  if ((m = /set up to\s*(\d+)\s*of your don!! cards as active/i.exec(t))) T.produces.push(`DONActive:${m[1]}`);
  for (const m2 of t.matchAll(/don!!\s*[-−]\s*(\d+)/gi)) T.produces.push(`DONRemove:${m2[1]}`);

  // Draw / discard
  for (const m2 of t.matchAll(/\bdraw\s*(\d+)\s*card/gi)) T.produces.push(`Draw:${m2[1]}`);
  for (const m2 of t.matchAll(/\btrash\s*(\d+)\s*card(?:s)? from your hand/gi)) T.produces.push(`DiscardSelf:${m2[1]}`);
  for (const m2 of t.matchAll(/\bopponent (?:trashes|discards)\s*(\d+)\s*card/gi)) T.produces.push(`DiscardOpponent:${m2[1]}`);

  // Life removed (Nami etc.)
  if (/removed from (?:either|any) player's life|removed from (?:your|their|the) life/i.test(t)) {
    T.mechanics.push("OnLifeRemoved");
    const d = /draw\s*(\d+)\s*card/i.exec(t);
    if (d) T.produces.push(`OnLifeRemoved:Draw:${d[1]}`);
    else T.produces.push("OnLifeRemoved:Effect");
  }

  // Leader locks
  if ((m = /your leader is\s*\{?\s*([A-Za-z ’'\-\.]+)\s*\}?/i.exec(t))) T.requires.push(`LeaderIsTrait:${m[1].trim()}`);
  if ((m = /your leader .* has .*?\{?\s*([A-Za-z ’'\-\.]+)\s*\}?[^.]* in (?:its )?type/i.exec(t))) T.requires.push(`LeaderTypeIncludes:${m[1].trim()}`);

  // Trash-gates
  if ((m = /have\s*(\d+)\s*or more\s*\{?\s*([A-Za-z ’'\-\.]+)\s*\}?\s*in your trash/i.exec(t))) {
    T.requires.push(`NeedsTrashTrait:${m[2].trim()>= '' ? m[2].trim() : 'Unknown'}>=${m[1]}`);
  }
  if ((m = /have\s*(\d+)\s*or more\s*(Events?|Characters?|Stages?)\s*in your trash/i.exec(t))) {
    const typ = m[2].replace(/s$/,'');
    T.requires.push(`NeedsTrashType:${typ}>=${m[1]}`);
  }

  // Ladder hints
  if (T.produces.some(p => /^KO:Cost(<=|==)/.test(p))) T.requires.push("Enable:LowerCost");
  if (T.produces.some(p => /^KO:(?:Power|BasePower)(<=|==)/.test(p))) T.requires.push("Enable:LowerPower");

  T.produces = uniq(T.produces);
  T.requires = uniq(T.requires);
  T.mechanics = uniq(T.mechanics);
  return T;
}
