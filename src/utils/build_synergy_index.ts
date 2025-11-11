// build_synergy_index.ts
// Usage: npx tsx ./src/utils/build_synergy_index.ts ./data/synergy_tags.json ./data/synergy_index.json --source=auto|manual|both
import * as fs from "fs";

type Effects = { produces: string[]; requires: string[]; mechanics: string[] };
type CardEntry = { manual: Effects; auto: Effects; blocks?: Effects[]; reviewed: boolean; lastEditedAt?: string };
type TagsFile = { meta: { version: number }; cards: Record<string, CardEntry> };
type SynergyIndex = { byProduces: Record<string, string[]>; byRequires: Record<string, string[]>; meta: any };

const [input, output, flag] = process.argv.slice(2);
if (!input || !output) {
  console.error("Usage: npx tsx build_synergy_index.ts <in> <out> [--source=manual|auto|both]");
  process.exit(1);
}
const source = (flag?.startsWith("--source=") ? flag.split("=")[1] : "both") as "manual" | "auto" | "both";

const json = JSON.parse(fs.readFileSync(input, "utf8")) as TagsFile;

function isEmpty(e?: Effects) {
  return !e || (!(e.produces?.length) && !(e.requires?.length) && !(e.mechanics?.length));
}

const index: SynergyIndex = { byProduces: {}, byRequires: {}, meta: { source, generatedAt: new Date().toISOString() } };

for (const [cardId, entry] of Object.entries(json.cards)) {
  let eff: Effects = { produces: [], requires: [], mechanics: [] };

  if (source === "manual") eff = entry.manual || eff;
  else if (source === "auto") eff = entry.auto || eff;
  else eff = !isEmpty(entry.manual) ? entry.manual : entry.auto || eff;

  for (const p of eff.produces || []) (index.byProduces[p] ||= []).push(cardId);
  for (const r of eff.requires || []) (index.byRequires[r] ||= []).push(cardId);
}

fs.writeFileSync(output, JSON.stringify(index, null, 2));
console.log(
  `✅ Wrote ${output}\n  - produces: ${Object.keys(index.byProduces).length}\n  - requires: ${Object.keys(index.byRequires).length}\n  - source: ${source}`
);
