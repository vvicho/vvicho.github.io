import * as fs from "fs";
import * as path from "path";

type Effects = { inbound?: string[]; outbound?: string[]; keywords?: string[] };
type TagsFileV2 = { meta: any; cards: Record<string, { manual?: Effects; auto?: Effects }> };

const inPath = path.resolve(process.cwd(), "public/data/synergy_tags_v2.json");
const outPath = path.resolve(process.cwd(), "public/data/synergy_index_v2.json");

function effective(e: { manual?: Effects; auto?: Effects }): Effects {
  const m = e.manual || { inbound: [], outbound: [], keywords: [] };
  if ((m.inbound?.length || 0) + (m.outbound?.length || 0) + (m.keywords?.length || 0) > 0) return m;
  return e.auto || { inbound: [], outbound: [], keywords: [] };
}

const json = JSON.parse(fs.readFileSync(inPath, "utf8")) as TagsFileV2;
const byInbound: Record<string, string[]> = {};
const byOutbound: Record<string, string[]> = {};

for (const [cid, rec] of Object.entries(json.cards)) {
  const eff = effective(rec);
  for (const t of eff.inbound || []) (byInbound[t] ||= []).push(cid);
  for (const t of eff.outbound || []) (byOutbound[t] ||= []).push(cid);
}

const out = { byInbound, byOutbound, meta: { generatedAt: new Date().toISOString() } };
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`Wrote ${outPath}`);


