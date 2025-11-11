import React, { useEffect, useMemo, useState } from "react";
import CARDS from "../../assets/allCards.json";
import { TAG_KINDS, NAV_KEYS } from "../../synergy2/taxonomy";
import { parseTagExpr } from "../../synergy2/tag_expr";

type Override = {
  cardId: string;
  add?: { inbound?: string[]; outbound?: string[]; keywords?: string[] };
  remove?: { inbound?: string[]; outbound?: string[]; keywords?: string[] };
};

export default function TagEditor() {
  const cards = useMemo(() => Object.values(CARDS as any).map((c:any)=>({id:c.cardId||c.id,name:c.name})), []);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [section, setSection] = useState<"inbound"|"outbound"|"keywords">("inbound");
  const [expr, setExpr] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [filterKinds, setFilterKinds] = useState("");

  useEffect(() => {
    fetch("/data/manual_overrides.json").then(r=>r.ok?r.json():[]).then(setOverrides).catch(()=>setOverrides([]));
  }, []);

  const filteredCards = query
    ? cards.filter(c => (c.name+c.id).toLowerCase().includes(query.toLowerCase()))
    : cards;

  const ov = useMemo(() => overrides.find(o=>o.cardId===selectedId) || {cardId:selectedId, add:{}, remove:{}}, [overrides, selectedId]);
  const applied = new Set([...(ov.add?.[section]||[])]);

  function upsertOverride(next: Override) {
    setOverrides(prev => {
      const arr = prev.filter(x => x.cardId !== next.cardId);
      return [...arr, next];
    });
  }

  function addTag(tag: string) {
    const p = parseTagExpr(tag);
    if (!p.ok) { setErrors(p.errors); return; }
    setErrors([]);
    const t = p.normalized;
    const next = {...ov, add:{...ov.add, [section]: Array.from(new Set([...(ov.add?.[section]||[]), t]))}};
    upsertOverride(next);
    setExpr("");
  }

  function removeTag(tag: string) {
    const list = (ov.add?.[section]||[]).filter(x => x!==tag);
    const next = {...ov, add:{...ov.add, [section]: list}};
    upsertOverride(next);
  }

  function save() {
    const blob = new Blob([JSON.stringify(overrides, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "manual_overrides.json"; a.click();
    URL.revokeObjectURL(url);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const combo = (e.shiftKey ? "Shift+" : "") + (e.key);
    if (combo === NAV_KEYS.nextSection) {
      e.preventDefault();
      setSection(s => s==="inbound"?"outbound": s==="outbound"?"keywords":"inbound");
    } else if (combo === NAV_KEYS.prevSection) {
      e.preventDefault();
      setSection(s => s==="keywords"?"outbound": s==="outbound"?"inbound":"keywords");
    }
  }

  const kindSuggestions = TAG_KINDS
    .filter(k => k.label.toLowerCase().includes(filterKinds.toLowerCase()))
    .slice(0, 16);

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Synergy Tag Editor v2</h2>

      <div className="flex gap-2 items-center">
        <input className="border px-2 py-1 rounded w-72" placeholder="Search card…" value={query} onChange={e=>setQuery(e.target.value)} />
        <select className="border px-2 py-1 rounded" value={selectedId} onChange={e=>setSelectedId(e.target.value)}>
          <option value="">— select card —</option>
          {filteredCards.slice(0,500).map(c => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
        </select>
        <select className="border px-2 py-1 rounded" value={section} onChange={e=>setSection(e.target.value as any)}>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
          <option value="keywords">Keywords</option>
        </select>
        <button className="border px-3 py-1 rounded" onClick={save}>Download overrides</button>
      </div>

      {selectedId && (
        <div className="space-y-3">
          <div className="flex gap-2 items-center">
            <input
              className="border px-2 py-1 rounded w-[36rem]"
              placeholder="Type tag expression, e.g. NeedsDON:>=2 or KO:Cost<=5"
              value={expr}
              onChange={e=>setExpr(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button className="border px-3 py-1 rounded" onClick={()=>addTag(expr)}>Add</button>
          </div>
          {!!errors.length && <div className="text-red-600 text-sm">{errors.join(" · ")}</div>}

          <div className="space-y-1">
            <div className="opacity-70 text-sm">Insert template</div>
            <div className="flex gap-2 items-center">
              <input className="border px-2 py-1 rounded w-64" placeholder="Filter kinds…" value={filterKinds} onChange={e=>setFilterKinds(e.target.value)} />
            </div>
            <div className="flex gap-2 flex-wrap">
              {kindSuggestions.map(k => (
                <button key={k.kind} className="border px-2 py-1 rounded text-sm"
                  title={k.help}
                  onClick={()=>setExpr(k.template)}>
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <div className="opacity-70 text-sm">Applied ({section})</div>
            <div className="flex gap-2 flex-wrap">
              {Array.from(applied).map(t => (
                <span key={t} className="border px-2 py-1 rounded text-sm">
                  {t} <button className="opacity-60 ml-1" onClick={()=>removeTag(t)}>✕</button>
                </span>
              ))}
            </div>
          </div>

          <div className="text-xs opacity-60">
            Tips: DON tags accept `NeedsDON:N` (auto → `NeedsDON:≥N`). Categories must be wrapped: {'{Category}'}.
          </div>
        </div>
      )}
    </div>
  );
}


