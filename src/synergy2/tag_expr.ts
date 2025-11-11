export type ParseOk = { ok: true; normalized: string; errors: string[] };
export type ParseErr = { ok: false; normalized?: string; errors: string[] };
export type ParseResult = ParseOk | ParseErr;

const num = (s: string) => /^\d+$/.test(s);
const cat = (s: string) => s.length > 0;

export function parseTagExpr(input: string): ParseResult {
  const s = input.trim();

  // bare keywords (no params)
  if (s === "NeedsLifeTaken" || s === "NeedsLifeChange") return { ok: true, normalized: s, errors: [] };

  // NeedsTarget:HasCounter:0
  if (s.startsWith("NeedsTarget:HasCounter:")) {
    const v = s.split(":").pop()!;
    if (!num(v)) return { ok:false, errors:["Counter value must be a number"] };
    return { ok:true, normalized:`NeedsTarget:HasCounter:${v}`, errors:[] };
  }

  // NeedsDON:>=N  or NeedsDON:N -> >=N
  if (s.startsWith("NeedsDON:")) {
    const rest = s.slice("NeedsDON:".length);
    const m = rest.match(/^(>=|<=|==)?\s*(\d+)$/);
    if (!m) return { ok:false, errors:["Format: NeedsDON:>=N or NeedsDON:N"] };
    const op = m[1] || ">=";
    const val = m[2];
    return { ok:true, normalized:`NeedsDON:${op}${val}`, errors:[] };
  }

  // NeedsLeaderType:{Category}
  if (s.startsWith("NeedsLeaderType:{") && s.endsWith("}")) {
    const inside = s.slice("NeedsLeaderType:{".length, -1).trim();
    if (!cat(inside)) return { ok:false, errors:["Empty category"] };
    return { ok:true, normalized:`NeedsLeaderType:{${inside}}`, errors:[] };
  }

  // WantsCurve:{C}:>=N  or WantsCurve:{C}:N
  if (s.startsWith("WantsCurve:{")) {
    const m = s.match(/^WantsCurve:\{([^}]+)\}:(>=|<=|==)?\s*(\d+)$/);
    if (!m) return { ok:false, errors:["Format: WantsCurve:{Category}:>=N"] };
    const c = m[1].trim(), op = m[2] || ">=", v = m[3];
    return { ok:true, normalized:`WantsCurve:{${c}}:${op}${v}`, errors:[] };
  }

  // Curve:{C}:>=N  or Curve:{C}:N
  if (s.startsWith("Curve:{")) {
    const m = s.match(/^Curve:\{([^}]+)\}:(>=|<=|==)?\s*(\d+)$/);
    if (!m) return { ok:false, errors:["Format: Curve:{Category}:>=N"] };
    const c = m[1].trim(), op = m[2] || ">=", v = m[3];
    return { ok:true, normalized:`Curve:{${c}}:${op}${v}`, errors:[] };
  }

  // KO:Cost<=N | KO:Power<=N
  if (/^KO:(Cost|Power)(>=|<=|==)\d+$/.test(s)) return { ok:true, normalized:s, errors:[] };

  // CostMod:-1 / +1
  if (/^CostMod:[+-]\d+$/.test(s)) return { ok:true, normalized:s, errors:[] };

  // Bounce:Cost<=N / BottomDeck:Cost<=N / RestTarget:Cost<=N
  if (/^(Bounce:Cost|BottomDeck:Cost|RestTarget:Cost)(>=|<=|==)\d+$/.test(s)) return { ok:true, normalized:s, errors:[] };

  // DON:AddActive:+N / DON:AddRested:+N / DON:AttachRested:+N / DON:Consume:N
  if (/^DON:(AddActive|AddRested|AttachRested):\+\d+$/.test(s)) return { ok:true, normalized:s, errors:[] };
  if (/^DON:Consume:\d+$/.test(s)) return { ok:true, normalized:s, errors:[] };

  // LifeFaceUp:+N / LifeTaken:+N
  if (/^(LifeFaceUp|LifeTaken):\+\d+$/.test(s)) return { ok:true, normalized:s, errors:[] };

  return { ok:false, errors:["Unrecognized tag expression"] };
}


