// Reads allCards.json and optional manual_overrides.json (downloaded via UI)
// Emits data/synergy_tags_v2.json

import * as fs from "fs";
import * as path from "path";
import CARDS from "../assets/allCards.json" assert { type: "json" };
import { autoFromText } from "./auto_rules";

type ManualOverride = {
  cardId: string;
  add?: { inbound?: string[]; outbound?: string[]; keywords?: string[] };
  remove?: { inbound?: string[]; outbound?: string[]; keywords?: string[] };
};

const outPath = path.resolve(process.cwd(), "public/data/synergy_tags_v2.json");
const manualPath = path.resolve(process.cwd(), "public/data/manual_overrides.json");

function uniq(a: string[]) { return Array.from(new Set(a)); }

function applyOverride(base: { inbound: string[]; outbound: string[]; keywords: string[] }, ov?: ManualOverride) {
  if (!ov) return base;
  const next = {
    inbound: uniq([...(base.inbound||[]), ...(ov.add?.inbound||[])]).filter(x => !(ov.remove?.inbound||[]).includes(x)),
    outbound: uniq([...(base.outbound||[]), ...(ov.add?.outbound||[])]).filter(x => !(ov.remove?.outbound||[]).includes(x)),
    keywords: uniq([...(base.keywords||[]), ...(ov.add?.keywords||[])]).filter(x => !(ov.remove?.keywords||[]).includes(x)),
  };
  return next;
}

function main() {
  const allCards: any = CARDS as any;
  let overrides: ManualOverride[] = [];
  if (fs.existsSync(manualPath)) {
    try { overrides = JSON.parse(fs.readFileSync(manualPath, "utf8")); } catch {}
  }

  const byId: Record<string, any> = allCards;
  const out: any = { meta: { version: 2, generatedAt: new Date().toISOString() }, cards: {} };

  for (const [cid, card] of Object.entries(byId)) {
    if (cid.includes("_")) continue; // skip alts
    const auto = autoFromText((card as any).text || "");
    const ov = overrides.find(o => o.cardId === cid);
    const manual = ov ? applyOverride({ inbound: [], outbound: [], keywords: [] }, ov) : { inbound: [], outbound: [], keywords: [] };
    out.cards[cid] = { auto, manual };
  }

  if (!fs.existsSync(path.dirname(outPath))) fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`Wrote ${outPath}`);
}

main();


