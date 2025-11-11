// Minimal, conservative auto-tagging from raw card text
// Emits normalized v2 strings only; no shortcut dictionaries.

export type AutoEffects = { inbound: string[]; outbound: string[]; keywords: string[] };

const uniq = (a: string[]) => Array.from(new Set(a));

export function autoFromText(textRaw?: string): AutoEffects {
  const t = (textRaw || "").replace(/\s+/g, " ").trim();
  if (!t) return { inbound: [], outbound: [], keywords: [] };

  const inbound: string[] = [];
  const outbound: string[] = [];
  const keywords: string[] = [];

  // DON gates: [DON!! xN]
  for (const m of t.matchAll(/\[\s*DON!!\s*x(\d+)\s*\]/gi)) {
    inbound.push(`NeedsDON:>=${m[1]}`);
  }

  // KO by cost/power
  const mKoCost = t.match(/k\.?o\.?[^.]*cost(?: of)?\s*(\d+)\s*or less/i);
  if (mKoCost) outbound.push(`KO:Cost<=${mKoCost[1]}`);
  const mKoPower = t.match(/k\.?o\.?[^.]*?(\d{3,5})\s*(?:base )?power\s*or less/i);
  if (mKoPower) outbound.push(`KO:Power<=${mKoPower[1]}`);

  // Rest by cost (target)
  const mRestCost = t.match(/rest[^.]*?cost(?: of)?\s*(\d+)\s*or less/i);
  if (mRestCost) outbound.push(`RestTarget:Cost<=${mRestCost[1]}`);

  // Cost modifiers (reduce by N)
  for (const r of t.matchAll(/cost[^.]*?reduc(?:e|ed) by\s*(\d+)/gi)) {
    outbound.push(`CostMod:-${r[1]}`);
  }

  // DON manipulation
  const mAddDon = t.match(/add up to\s*(\d+)\s*don!!\s*card/i);
  if (mAddDon) outbound.push(`DON:AddActive:+${mAddDon[1]}`);
  const mSetActive = t.match(/set up to\s*(\d+)\s*of your don!! cards as active/i);
  if (mSetActive) outbound.push(`DON:AddActive:+${mSetActive[1]}`);
  const mAttachRested = t.match(/give up to\s*(\d+)\s*rested\s*don!! card/i);
  if (mAttachRested) outbound.push(`DON:AttachRested:+${mAttachRested[1]}`);

  // Life interactions (very conservative)
  if (/life is taken|remove[d]? from (?:your|their|either) life/i.test(t)) {
    outbound.push("LifeTaken:+1");
  }
  if (/face up your life|turn (?:a|\d+) life card face up/i.test(t)) {
    outbound.push("LifeFaceUp:+1");
  }
  if (/when your life (?:is|are) taken|if your life (?:is|are) taken/i.test(t)) {
    inbound.push("NeedsLifeTaken");
  }
  if (/your (?:or opponent'?s )?life (?:increases|decreases|changes)/i.test(t)) {
    inbound.push("NeedsLifeChange");
  }

  return {
    inbound: uniq(inbound),
    outbound: uniq(outbound),
    keywords: uniq(keywords)
  };
}


