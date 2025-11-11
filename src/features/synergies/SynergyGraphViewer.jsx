import React, { useEffect, useMemo, useState } from 'react';

export default function SynergyGraphViewer() {
  const [index, setIndex] = useState({ byProduces: {}, byRequires: {} });
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/synergy_index_v2.json`)
      .then(r => r.ok ? r.json() : { byProduces: {}, byRequires: {} })
      .then(setIndex)
      .catch(() => setIndex({ byProduces: {}, byRequires: {} }));
  }, []);

  const toList = (rec) => Object.entries(rec).map(([t, ids]) => ({ t, c: ids.length, ids })).sort((a,b)=>b.c-a.c);
  const listProduces = useMemo(() => toList(index.byOutbound||{}), [index]);
  const listRequires = useMemo(() => toList(index.byInbound||{}), [index]);

  const matches = (t) => t.toLowerCase().includes(filter.toLowerCase());

  return (
    <div style={{ padding: 16 }}>
      <h2>Synergy Index</h2>
      <div style={{ marginBottom: 12 }}>
        <input placeholder='Filter tokens' value={filter} onChange={e=>setFilter(e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <h3>By Produces</h3>
          <div>
            {listProduces.filter(x => matches(x.t)).slice(0, 200).map(x => (
              <div key={x.t} style={{ padding: 6, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <strong>{x.t}</strong> <span style={{ opacity: 0.7 }}>({x.c})</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3>By Requires</h3>
          <div>
            {listRequires.filter(x => matches(x.t)).slice(0, 200).map(x => (
              <div key={x.t} style={{ padding: 6, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <strong>{x.t}</strong> <span style={{ opacity: 0.7 }}>({x.c})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
