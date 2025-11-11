/**
 * @typedef {{ produces: string[]; requires: string[]; mechanics: string[] }} Effects
 */

/**
 * @param {string|undefined} text
 * @returns {Effects}
 */
export function inferTagsFromText(text) {
  const T = { produces: [], requires: [], mechanics: [] };
  if (!text) return T;
  const t = (text || '').replace(/\s+/g, ' ').trim();

  // timings / mechanics
  if (/\[?\s*On Play\s*\]?/i.test(t)) T.mechanics.push('OnPlay');
  if (/\[?\s*When Attacking\s*\]?/i.test(t)) T.mechanics.push('WhenAttacking');
  if (/\[?\s*Activate:\s*Main\s*\]?/i.test(t)) T.mechanics.push('ActivateMain');
  if (/\bTrigger\b/i.test(t)) T.mechanics.push('Trigger');
  if (/\bBlocker\b/i.test(t)) T.mechanics.push('Blocker');

  // KO windows
  if (/K\.?O\.?[^.]*cost(?: of)?\s*(\d+)\s*or less/i.test(t)) T.produces.push(`KO:Cost<=${RegExp.$1}`);
  if (/K\.?O\.?[^.]*cost(?: of)?\s*(\d+)\b(?!\s*or)/i.test(t)) T.produces.push(`KO:Cost==${RegExp.$1}`);
  if (/K\.?O\.?[^.]*base cost(?: of)?\s*(\d+)\s*or less/i.test(t)) T.produces.push(`KO:BaseCost<=${RegExp.$1}`);
  if (/K\.?O\.?[^.]*?(\d{3,5})\s*(?:base )?power\s*or less/i.test(t)) T.produces.push(`KO:Power<=${RegExp.$1}`);

  // reducers
  if (/reduce[^.]*cost[^.]*by\s*(\d+)/i.test(t)) T.produces.push(`ReduceCost:${RegExp.$1}:ThisTurn`);
  if (/give[^.]*?(-?\d+)\s*cost/i.test(t)) T.produces.push(`ReduceCost:${Math.abs(parseInt(RegExp.$1))}:ThisTurn`);
  if (/reduce[^.]*power[^.]*by\s*(\d{3,5})/i.test(t)) T.produces.push(`ReducePower:${RegExp.$1}:ThisTurn`);
  if (/give[^.]*?(-?\d{3,5})\s*power/i.test(t)) T.produces.push(`ReducePower:${Math.abs(parseInt(RegExp.$1))}:ThisTurn`);
  if (/until the end of your opponent's next turn/i.test(t)) {
    T.produces = T.produces.map(p => p.startsWith('Reduce') && p.endsWith('ThisTurn') ? p.replace('ThisTurn', 'UntilEndOfOppNextTurn') : p);
  } else if (/until (?:the )?end of (?:this|your) turn/i.test(t)) {
    T.produces = T.produces.map(p => p.startsWith('Reduce') && p.endsWith('ThisTurn') ? p.replace('ThisTurn', 'UntilEndOfTurn') : p);
  } else if (/until the start of your next turn/i.test(t)) {
    T.produces = T.produces.map(p => p.startsWith('Reduce') && p.endsWith('ThisTurn') ? p.replace('ThisTurn', 'UntilStartOfYourNextTurn') : p);
  }

  // bounce / bottom / top / rest
  if (/return[^.]*?(?:with (?:a )?)?cost(?: of)?\s*(\d+)\s*or less[^.]*\bto the (?:owner's )?(?:hand|deck|bottom|top)/i.test(t)) T.produces.push(`Bounce:Cost<=${RegExp.$1}`);
  if (/(?:place .* at the )?bottom of (?:its owner's )?deck|bottom deck/i.test(t)) T.produces.push('BottomDeck:Cost<=99');
  if (/(?:place .* at the )?top of (?:its owner's )?deck|top deck/i.test(t)) T.produces.push('TopDeck:Cost<=99');

  // Rest as verb only
  const isRestVerb = /\b(?:you may )?rest\b/i.test(t) && /character/i.test(t) && !/\bthe rest\b/i.test(t);
  if (isRestVerb) {
    if (/\brest[^.]*?base cost(?: of)?\s*(\d+)\s*or less/i.test(t)) T.produces.push(`Rest:BaseCost<=${RegExp.$1}`);
    else T.produces.push('Rest');
  }

  // Look/Reveal Top N
  const lookM = /look at\s*(\d+)\s*cards? from the top of your deck/i.exec(t);
  const revealM = /reveal\s*(\d+)\s*cards? from the top of your deck/i.exec(t);
  if (lookM) T.produces.push(`LookTop:${lookM[1]}`);
  if (revealM) T.produces.push(`RevealTop:${revealM[1]}`);
  if (/(?:put|place) (?:them|those cards) in any order on top of your deck/i.test(t)) {
    const n = lookM?.[1] ?? revealM?.[1] ?? '0';
    T.produces.push(`ArrangeTop:${n}`);
  }
  if (/(?:put|place) (?:them|those cards) in any order on the bottom of your deck/i.test(t)) {
    const n = lookM?.[1] ?? revealM?.[1] ?? '0';
    T.produces.push(`ArrangeBottom:${n}`);
  }
  if (/place the rest (?:of (?:those )?cards )?on top of your deck/i.test(t)) T.produces.push('PlaceRest:Top');
  if (/place the rest (?:of (?:those )?cards )?on the bottom of your deck/i.test(t)) T.produces.push('PlaceRest:Bottom');

  // Top-of-deck play
  const playTopM = /play [^.]* from the top of your deck[^.]*cost(?: of)?\s*(\d+)\s*or less/i.exec(t);
  if (playTopM) {
    T.produces.push(`PlayFromTop:Cost<=${playTopM[1]}`);
    T.requires.push('NeedsTopDeckManipulation');
  } else if (/play [^.]* from the top of your deck/i.test(t)) {
    const n = lookM?.[1] ?? revealM?.[1] ?? '1';
    T.produces.push(`PlayFromTop:${n}`);
    T.requires.push('NeedsTopDeckManipulation');
  }

  // trash / play-from-trash
  if (/play[^.]*?with a cost of\s*(\d+)\s*[-–to]\s*(\d+)[^.]*from your trash/i.test(t)) T.produces.push(`PlayFromTrash:CostRange:${RegExp.$1}-${RegExp.$2}`);
  if (/play[^.]*?with a cost of\s*(\d+)\s*or less[^.]*?from your trash/i.test(t)) T.produces.push(`PlayFromTrash:Cost<=${RegExp.$1}`);
  if (/play[^.]*from your trash/i.test(t) && !T.produces.some(x => x.startsWith('PlayFromTrash'))) T.produces.push('PlayFromTrash:Generic');
  if (/return[^.]*from your trash[^.]*to your hand/i.test(t)) T.produces.push('ReturnFromTrashToHand:Generic');

  // life
  if (/removed from (?:either|any) player's life|removed from (?:your|their|the) life/i.test(t)) {
    T.mechanics.push('OnLifeRemoved');
    const draw = /draw\s*(\d+)\s*card/i.exec(t); if (draw) T.produces.push(`OnLifeRemoved:Draw:${draw[1]}`);
  }

  // leader / trait
  const leaderIs = /your leader is\s*\{?\s*([A-Za-z ’'\-\.]+)\s*\}?/i.exec(t);
  if (leaderIs) T.requires.push(`LeaderIsTrait:${leaderIs[1].trim()}`);
  const leaderType = /your leader .* has .*?\{?\s*([A-Za-z ’'\-\.]+)\s*\}?[^.]* in (?:its )?type/i.exec(t);
  if (leaderType) T.requires.push(`LeaderTypeIncludes:${leaderType[1].trim()}`);

  // synergy hints
  if (T.produces.some(p => /^KO:Cost<=|^KO:Cost==/.test(p))) T.requires.push('Enable:LowerCost');
  if (T.produces.some(p => /^KO:(?:Power|BasePower)(<=|==)/.test(p))) T.requires.push('Enable:LowerPower');

  // de-dupe
  T.produces = Array.from(new Set(T.produces));
  T.requires = Array.from(new Set(T.requires));
  T.mechanics = Array.from(new Set(T.mechanics));
  return T;
}
