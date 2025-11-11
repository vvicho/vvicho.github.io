import React, { useEffect, useMemo, useRef, useState } from 'react';
import Fuse from 'fuse.js';
import { useHotkeys } from 'react-hotkeys-hook';
import '../../styles/TagWorkbench.css';
import allCardsJson from '/src/assets/allCards.json';
import donCardsJson from '/src/assets/donCards.json';

// Types (JS version)
// Card: { id, name, text, color, cardSetCode, cardType, imageUrl, cost, power, traits }

const IMAGE_PATH = `${import.meta.env.BASE_URL}cards`;

const defaultV2 = { meta: { version: 2, generatedAt: new Date().toISOString() }, cards: {} };

export default function TagWorkbench({ onClose }) {
  const [cards, setCards] = useState({});
  const [regularIds, setRegularIds] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);

  // Single source of truth: v2 tags
  const [v2, setV2] = useState(defaultV2);
  const [library, setLibrary] = useState([]);

  // --- V2 Expression Builder (manual_overrides.json) ---
  const [v2Kind, setV2Kind] = useState('CostMod');
  const [v2Num, setV2Num] = useState('-1');
  const [v2WhereCategory, setV2WhereCategory] = useState('');
  const [v2WhereCardName, setV2WhereCardName] = useState('');
  const [v2WhereMinCost, setV2WhereMinCost] = useState('');
  const [v2WhereType, setV2WhereType] = useState('');
  const [v2WhereAttr, setV2WhereAttr] = useState('');
  const [suggestCats, setSuggestCats] = useState([]);
  const [suggestNames, setSuggestNames] = useState([]);
  const [suggestAttrs, setSuggestAttrs] = useState([]);

  useEffect(() => {
    const merged = { ...allCardsJson, ...donCardsJson };
    setCards(merged);
    const ids = Object.keys(merged).filter(id => id.indexOf('_') === -1);
    setRegularIds(ids);
    // load v2 if present
    const local = localStorage.getItem('synergy_tags_v2');
    if (local) {
      try { setV2(JSON.parse(local)); } catch {}
    } else {
      fetch(`${import.meta.env.BASE_URL}data/synergy_tags_v2.json`).then(r=>r.ok?r.json():defaultV2).then(setV2).catch(()=>setV2(defaultV2));
    }
  }, []);

  // derive library from all assigned tags (base only, strip [where=...])
  useEffect(() => {
    const bases = new Set();
    for (const entry of Object.values(v2.cards || {})) {
      (entry?.inbound || []).forEach(t => {
        const base = String(t).split('[')[0].trim(); if (base) bases.add(base);
      });
      (entry?.outbound || []).forEach(t => {
        const base = String(t).split('[')[0].trim(); if (base) bases.add(base);
      });
    }
    setLibrary(Array.from(bases).sort());
  }, [v2]);

  const fuse = useMemo(() => new Fuse(regularIds.map(id => ({ id, name: cards[id]?.name ?? '' })), { keys: ['name', 'id'], threshold: 0.3 }), [regularIds, cards]);

  const filteredIds = useMemo(() => {
    let ids = regularIds;
    if (!query) return ids;
    return fuse.search(query).map(r => r.item.id).filter(id => ids.includes(id));
  }, [regularIds, cards, query, fuse]);

  const selectedId = filteredIds[selectedIndex];
  const card = cards[selectedId] || {};
  const entryV2 = v2.cards[selectedId] || { inbound: [], outbound: [], keywords: [], reviewed: false };

  // no auto/manual anymore

  // debounced save to localStorage
  const saveTimer = useRef(0);
  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      localStorage.setItem('synergy_tags_v2', JSON.stringify(v2));
    }, 400);
    return () => window.clearTimeout(saveTimer.current);
  }, [v2]);

  const isNeedsReview = (id) => {
    const entry = v2.cards[id];
    const empty = !entry || (((entry.inbound?.length||0)+(entry.outbound?.length||0)+(entry.keywords?.length||0))===0);
    return empty || entry?.reviewed === false || entry?.reviewed == null;
  };

  // Hotkeys
  useHotkeys('j', () => setSelectedIndex(i => Math.min(i + 1, filteredIds.length - 1)), [filteredIds.length]);
  useHotkeys('k', () => setSelectedIndex(i => Math.max(i - 1, 0)), [filteredIds.length]);
  useHotkeys('f', (e) => { e.preventDefault(); document.getElementById('tag-search-input')?.focus(); }, []);
  useHotkeys('r', (e) => { e.preventDefault(); toggleReviewed(); }, [selectedId, v2]);
  useHotkeys('s', (e) => { e.preventDefault(); localStorage.setItem('synergy_tags_v2', JSON.stringify(v2)); }, [v2]);
  useHotkeys('n', (e) => {
    e.preventDefault();
    for (let i = selectedIndex + 1; i < filteredIds.length; i++) {
      if (isNeedsReview(filteredIds[i])) { setSelectedIndex(i); return; }
    }
  }, [filteredIds, selectedIndex, v2]);
  useHotkeys('p', (e) => {
    e.preventDefault();
    for (let i = selectedIndex - 1; i >= 0; i--) {
      if (isNeedsReview(filteredIds[i])) { setSelectedIndex(i); return; }
    }
  }, [filteredIds, selectedIndex, v2]);

  const updateV2 = (updates) => {
    if (!selectedId) return;
    setV2(prev => ({
      ...prev,
      cards: {
        ...prev.cards,
        [selectedId]: { ...(prev.cards[selectedId] || { inbound: [], outbound: [], keywords: [] }), ...updates }
      }
    }));
    // persist immediately to survive reloads even before debounce
    try {
      const next = {
        ...v2,
        cards: {
          ...v2.cards,
          [selectedId]: { ...(v2.cards?.[selectedId] || { inbound: [], outbound: [], keywords: [] }), ...updates }
        }
      };
      localStorage.setItem('synergy_tags_v2', JSON.stringify(next));
    } catch {}
  };

  // V2 assign helpers
  const addAssignment = (section, expr) => {
    const list = Array.from(new Set([...(entryV2[section] || []), expr]));
    updateV2({ [section]: list });
  };
  const removeAssignment = (section, expr) => {
    const list = (entryV2[section] || []).filter(x => x !== expr);
    updateV2({ [section]: list });
  };

  const toggleReviewed = () => {
    if (!selectedId) return;
    const cur = v2.cards[selectedId]?.reviewed === true;
    setV2(prev => ({
      ...prev,
      cards: { ...prev.cards, [selectedId]: { ...(prev.cards[selectedId] || { inbound: [], outbound: [], keywords: [] }), reviewed: !cur } }
    }));
  };

  const downloadJson = (name, obj) => {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importV2 = (evt) => {
    const file = evt.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { const parsed = JSON.parse(reader.result); if (parsed?.meta && parsed?.cards) setV2(parsed); } catch {}
    };
    reader.readAsText(file);
  };

  // --- V2 helpers ---
  const v2AddOutbound = () => {
    if (!selectedId) return;
    let expr = '';
    if (v2Kind === 'CostMod') {
      const n = (v2Num || '').trim();
      const parts = [];
      if (v2WhereCategory.trim()) parts.push(`Category:{${v2WhereCategory.trim()}}`);
      if (v2WhereCardName.trim()) parts.push(`CardName:{${v2WhereCardName.trim()}}`);
      if (v2WhereMinCost.trim()) parts.push(`Cost>=${v2WhereMinCost.trim()}`);
      if (v2WhereType.trim()) parts.push(`Type:{${v2WhereType.trim()}}`);
      if (v2WhereAttr.trim()) parts.push(`Attribute:{${v2WhereAttr.trim()}}`);
      const where = parts.length ? `[where=${parts.join('; ')}]` : '';
      expr = `CostMod:${n}${where}`;
    }
    if (!expr) return;
    addAssignment('outbound', expr);
  };
  const v2RemoveOutbound = (t) => removeAssignment('outbound', t);
  const v2Download = () => {
    const blob = new Blob([JSON.stringify(v2, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'synergy_tags_v2.json'; a.click();
    URL.revokeObjectURL(url);
  };

  // Suggestions from cards (categories, names, attributes)
  useEffect(() => {
    const ids = Object.keys(allCardsJson).filter(id => id.indexOf('_') === -1);
    const cats = new Set();
    const names = new Set();
    const attrs = new Set();
    for (const id of ids) {
      (allCardsJson[id]?.category || []).forEach(c => cats.add(String(c)));
      if (allCardsJson[id]?.name) names.add(String(allCardsJson[id].name));
      if (allCardsJson[id]?.attribute) {
        String(allCardsJson[id].attribute).split('/').forEach(t => attrs.add(t.trim()));
      }
    }
    setSuggestCats(Array.from(cats).sort());
    setSuggestNames(Array.from(names).sort());
    setSuggestAttrs(Array.from(attrs).sort());
  }, []);

  const loadFromFile = (evt) => {
    const file = evt.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (parsed?.meta && parsed?.cards) {
          setTags(parsed);
          localStorage.setItem('synergy_tags', JSON.stringify(parsed));
        }
      } catch {}
    };
    reader.readAsText(file);
  };

  const leftWidth = showLeft ? '300px' : '0px';
  const rightWidth = showRight ? '360px' : '0px';
  return (
    <div className='twb-root'>
      <div className='twb-header'>
        <div className='twb-header-row'>
          <div className='twb-header-left'>
            <button className='twb-toggle' onClick={() => setShowLeft(v => !v)}>{showLeft ? 'Hide List' : 'Show List'}</button>
            <button className='twb-toggle' onClick={() => setShowRight(v => !v)}>{showRight ? 'Hide Editor' : 'Show Editor'}</button>
            <span className='twb-badge'>Regular art only: {regularIds.length.toLocaleString()}</span>
          </div>
          <div className='twb-header-right'>
            <input id='tag-search-input' className='twb-search' value={query} onChange={e => setQuery(e.target.value)} placeholder='Search name or id (f)' />
            <button className='twb-btn' onClick={() => { localStorage.setItem('synergy_tags_v2', JSON.stringify(v2)); }}>Save (s)</button>
            <button className='twb-btn' onClick={() => downloadJson('synergy_tags_v2.json', v2)}>Export v2</button>
            <label className='twb-btn'>
              <input type='file' accept='application/json' style={{ display: 'none' }} onChange={importV2} />
              Import v2
            </label>
          </div>
        </div>
      </div>
      <div className='twb-body' style={{ gridTemplateColumns: `${leftWidth} 1fr ${rightWidth}` }}>
        <div className='twb-left'>
          <div className='twb-list'>
            {filteredIds.map((id, idx) => (
              <div key={id} className={idx === selectedIndex ? 'twb-row twb-row-active' : 'twb-row'} onClick={() => setSelectedIndex(idx)}>
                <img src={`${IMAGE_PATH}/${cards[id]?.cardSetCode}/${id}.png`} />
                <div>
                  <div className='twb-name'>{cards[id]?.name}</div>
                  <div className='twb-sub'>{cards[id]?.cardSetCode} • {cards[id]?.cardType}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className='twb-right'>
          <div className='twb-card-header'>
            <div className='twb-title'>{card?.name}</div>
            <div className='twb-meta'>{selectedId} • {card?.cardSetCode} • {card?.cardType}</div>
          </div>
          <div className='twb-rules'>
            {card?.text ? card.text : 'No rules text available.'}
          </div>
          <div className='twb-section'>
            <div className='twb-section-title'>Tag Library</div>
            <TagLibrary
              library={library}
              onAdd={(t)=>setLibrary(prev=>Array.from(new Set([...prev, t].filter(Boolean))))}
              onRemove={(t)=>setLibrary(prev=>prev.filter(x=>x!==t))}
            />
          </div>
        </div>
        <div className='twb-center'>
          <AssignSection
            title='Inbound'
            items={entryV2.inbound || []}
            onRemove={(t)=>removeAssignment('inbound', t)}
            onAdd={(tagBase, conds)=>{
              const where = conds.length ? `[where=${conds.join('; ')}]` : '';
              addAssignment('inbound', `${tagBase}${where}`);
            }}
            library={library}
            catOptions={suggestCats}
            nameOptions={suggestNames}
            attrOptions={suggestAttrs}
          />
          <AssignSection
            title='Outbound'
            items={entryV2.outbound || []}
            onRemove={(t)=>removeAssignment('outbound', t)}
            onAdd={(tagBase, conds)=>{
              const where = conds.length ? `[where=${conds.join('; ')}]` : '';
              addAssignment('outbound', `${tagBase}${where}`);
            }}
            library={library}
            catOptions={suggestCats}
            nameOptions={suggestNames}
            attrOptions={suggestAttrs}
          />
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div className='twb-section-title'>V2 Expression Builder</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'center' }}>
              <label>Kind</label>
              <select value={v2Kind} onChange={e=>setV2Kind(e.target.value)}>
                <option value='CostMod'>CostMod</option>
              </select>
              <label>Value</label>
              <input value={v2Num} onChange={e=>setV2Num(e.target.value.replace(/[^0-9+-]/g,''))} placeholder='-1 or +1' />
              <label>Category</label>
              <input list='twb-cat-list' value={v2WhereCategory} onChange={e=>setV2WhereCategory(e.target.value)} placeholder='e.g. Celestial Dragons' />
              <datalist id='twb-cat-list'>
                {suggestCats.filter(c => c.toLowerCase().includes(v2WhereCategory.toLowerCase())).slice(0,50).map(c => <option key={c} value={c} />)}
              </datalist>
              <label>Card Name</label>
              <input list='twb-name-list' value={v2WhereCardName} onChange={e=>setV2WhereCardName(e.target.value)} placeholder='e.g. Trafalgar Law' />
              <datalist id='twb-name-list'>
                {suggestNames.filter(n => n.toLowerCase().includes(v2WhereCardName.toLowerCase())).slice(0,50).map(n => <option key={n} value={n} />)}
              </datalist>
              <label>Min Cost</label>
              <input value={v2WhereMinCost} onChange={e=>setV2WhereMinCost(e.target.value.replace(/[^0-9]/g,''))} placeholder='e.g. 2' />
              <label>Type</label>
              <select value={v2WhereType} onChange={e=>setV2WhereType(e.target.value)}>
                <option value=''>Any</option>
                <option value='Character'>Character</option>
                <option value='Event'>Event</option>
                <option value='Stage'>Stage</option>
                <option value='Leader'>Leader</option>
              </select>
              <label>Attribute</label>
              <input list='twb-attr-list' value={v2WhereAttr} onChange={e=>setV2WhereAttr(e.target.value)} placeholder='e.g. Slash' />
              <datalist id='twb-attr-list'>
                {suggestAttrs.filter(a => a.toLowerCase().includes(v2WhereAttr.toLowerCase())).slice(0,50).map(a => <option key={a} value={a} />)}
              </datalist>
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button className='twb-btn' onClick={()=>{ v2AddOutbound(); /* keep simple */ }}>Add to Outbound (v2)</button>
              <button className='twb-btn' onClick={v2Download}>Download v2 tags</button>
            </div>
            <div style={{ marginTop: 8 }}>
              <div className='twb-section-title'>Applied (Outbound v2)</div>
              <div className='twb-chips'>
                {(entryV2.outbound || []).map(t => (
                  <span key={t} className='twb-chip'>
                    <span className='twb-chip-label'>{t}</span>
                    <button className='twb-chip-remove' onClick={()=>v2RemoveOutbound(t)}>×</button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className='twb-actions'>
          <button onClick={toggleReviewed}>{entryV2?.reviewed ? 'Unreview' : 'Mark Reviewed'} (r)</button>
          <button onClick={() => onClose?.()}>Close</button>
        </div>
      </div>
    </div>
  );
}

function TagLibrary({ library, onAdd, onRemove }) {
  const [input, setInput] = useState('');
  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className='twb-search' placeholder='Add base tag (e.g., KO:Cost<=5 or CostMod:-1)'
          value={input} onChange={e=>setInput(e.target.value)} />
        <button className='twb-btn' onClick={()=>{ if(input.trim()){ onAdd(input.trim()); setInput(''); } }}>Add</button>
      </div>
      <div className='twb-chips' style={{ marginTop: 8 }}>
        {library.slice(0, 200).map(t => (
          <span className='twb-chip' key={t}>
            <span className='twb-chip-label'>{t}</span>
            <button className='twb-chip-remove' onClick={()=>onRemove?.(t)}>×</button>
          </span>
        ))}
      </div>
    </div>
  );
}

function AssignSection({ title, items, onRemove, onAdd, library, catOptions = [], nameOptions = [], attrOptions = [] }) {
  const [sel, setSel] = useState('');
  const [cats, setCats] = useState([]);
  const [catInput, setCatInput] = useState('');
  const [catExact, setCatExact] = useState(true);
  const [nm, setNm] = useState('');
  const [minc, setMinc] = useState('');
  const [types, setTypes] = useState([]);
  const [attr, setAttr] = useState('');

  const buildConds = () => {
    const parts = [];
    if ((cats || []).length) parts.push(`${catExact ? 'Category' : 'CategoryContains'}:{${cats.join('|')}}`);
    if (nm.trim()) parts.push(`CardName:{${nm.trim()}}`);
    if (minc.trim()) parts.push(`Cost>=${minc.trim()}`);
    if ((types || []).length) parts.push(`Type:{${types.join('|')}}`);
    if (attr.trim()) parts.push(`Attribute:{${attr.trim()}}`);
    return parts;
  };
  const typeOptions = ['Leader', 'Character', 'Event', 'Stage'];

  return (
    <div className='twb-section'>
      <div className='twb-section-title'>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'center' }}>
        <label>Tag</label>
        <input list={`twb-lib-${title}`} value={sel} onChange={e=>setSel(e.target.value)} placeholder='Select or type tag' />
        <datalist id={`twb-lib-${title}`}>
          {library.slice(0,500).map(t => <option key={t} value={t} />)}
        </datalist>
        <label>Category</label>
        <input
          list={`twb-cat-${title}`}
          value={catInput}
          onChange={e=>setCatInput(e.target.value)}
          onKeyDown={e=>{
            if (e.key === 'Enter') {
              e.preventDefault();
              const v = (catInput || '').trim();
              if (v) {
                setCats(prev => Array.from(new Set([...prev, v])));
                setCatInput('');
              }
            }
          }}
          placeholder='Type and press Enter'
        />
        <datalist id={`twb-cat-${title}`}>
          {catOptions.filter(c => c.toLowerCase().includes(catInput.toLowerCase())).slice(0,100).map(c => <option key={c} value={c} />)}
        </datalist>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input id={`cat-exact-${title}`} type='checkbox' checked={catExact} onChange={e=>setCatExact(e.target.checked)} />
          <label htmlFor={`cat-exact-${title}`}>Exact match</label>
        </div>
        <div style={{ gridColumn: '1 / span 2' }}>
          <div className='twb-chips'>
            {cats.map(c => (
              <span key={c} className='twb-chip'>
                <span className='twb-chip-label'>{c}</span>
                <button className='twb-chip-remove' onClick={()=>setCats(prev=>prev.filter(x=>x!==c))}>×</button>
              </span>
            ))}
          </div>
        </div>
        <label>Card Name</label>
        <input list={`twb-name-${title}`} value={nm} onChange={e=>setNm(e.target.value)} placeholder='Name contains' />
        <datalist id={`twb-name-${title}`}>
          {nameOptions.filter(n => n.toLowerCase().includes(nm.toLowerCase())).slice(0,100).map(n => <option key={n} value={n} />)}
        </datalist>
        <label>Min Cost</label>
        <input value={minc} onChange={e=>setMinc(e.target.value.replace(/[^0-9]/g,''))} placeholder='n' />
        <label>Type</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {typeOptions.map(o => (
            <label key={o} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '2px 6px', border: '1px solid #334155', borderRadius: 6 }}>
              <input type='checkbox' checked={types.includes(o)} onChange={(e)=>{
                setTypes(prev => e.target.checked ? Array.from(new Set([...prev, o])) : prev.filter(x=>x!==o));
              }} />
              <span>{o}</span>
            </label>
          ))}
        </div>
        <label>Attribute</label>
        <input list={`twb-attr-${title}`} value={attr} onChange={e=>setAttr(e.target.value)} placeholder='Slash, Ranged…' />
        <datalist id={`twb-attr-${title}`}>
          {attrOptions.filter(a => a.toLowerCase().includes(attr.toLowerCase())).slice(0,100).map(a => <option key={a} value={a} />)}
        </datalist>
      </div>
      <div style={{ marginTop: 8 }}>
        <button className='twb-btn' onClick={()=> sel && onAdd(sel, buildConds())}>Add {title}</button>
      </div>
      <div className='twb-chips' style={{ marginTop: 8 }}>
        {items.map(t => (
          <span key={t} className='twb-chip'>
            <span className='twb-chip-label'>{t}</span>
            <button className='twb-chip-remove' onClick={()=>onRemove(t)}>×</button>
          </span>
        ))}
      </div>
    </div>
  );
}
