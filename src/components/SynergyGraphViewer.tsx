import React, { useEffect, useMemo, useRef, useState } from "react";
// Card assets for images
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import CARDS from "../assets/allCards.json";
// Install: npm i react-force-graph-2d
const ForceGraph2D = React.lazy(() => import("react-force-graph-2d"));

// Types that match edges_v2
export type Edge = { from: string; to: string; reason: string; score: number };
export type GraphJson = { meta?: any; edges: Edge[]; nodes?: string[] };

export type Props = {
  // path to synergy_edges.json produced by build_synergy_edges.ts
  src?: string;
  // alternatively, pass the JSON directly
  data?: GraphJson;
  height?: number;
};

const DEFAULT_HEIGHT = 720;

export default function SynergyGraphViewer({ src = "/data/synergy_edges_v2.json", data, height = DEFAULT_HEIGHT }: Props) {
  const [graph, setGraph] = useState<GraphJson | null>(data || null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const fgRef = useRef<any>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const [rightWidth, setRightWidth] = useState<number>(0);

  useEffect(() => {
    if (graph || !src) return;
    (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: GraphJson = await res.json();
        setGraph(json);
      } catch (e) {
        console.error("Failed to load graph", e);
      }
    })();
  }, [src, graph]);

  const allNodeIds = useMemo(() => {
    const ids = new Set<string>();
    (graph?.edges || []).forEach(e => { ids.add(e.from); ids.add(e.to); });
    return Array.from(ids);
  }, [graph]);
  const cardList = useMemo(() => {
    const arr = allNodeIds.map(id => ({ id, name: (CARDS as any)[id]?.name || id }));
    return arr
      .filter(c => (c.name + c.id).toLowerCase().includes(query.toLowerCase()))
      .sort((a,b)=> a.name.localeCompare(b.name));
  }, [allNodeIds, query]);

  // Build neighbors for selected card
  const focusData = useMemo(() => {
    if (!graph || !selectedId) return { nodes: [], links: [] } as any;
    const edges = graph.edges.filter(e => e.from === selectedId || e.to === selectedId)
      .sort((a,b)=> b.score - a.score)
      .slice(0, 10);
    const neigh = edges.map(e => ({ id: e.from === selectedId ? e.to : e.from, score: e.score, reason: e.reason }));
    const maxScore = edges.length ? Math.max(...edges.map(e=>e.score)) : 1;
    const center = { id: selectedId, fx: 0, fy: 0, size: 42 } as any;
    const margin = 24;
    const W = rightWidth || 600;
    const H = height || 600;
    const Rraw = Math.min((W/2) - margin, (H/2) - margin);
    const R = Math.max(60, Math.min(160, Rraw));
    const nodes = [center, ...neigh.map((n, i) => {
      const theta = (2*Math.PI*i)/Math.max(1, neigh.length);
      const base = 18;
      const size = base + 26 * (n.score / (maxScore || 1));
      return { id: n.id, fx: R*Math.cos(theta), fy: R*Math.sin(theta), size, score: n.score } as any;
    })];
    const links = neigh.map(n => ({ source: selectedId, target: n.id, reason: n.reason, score: n.score }));
    return { nodes, links } as any;
  }, [graph, selectedId, rightWidth, height]);

  // Card image helpers
  const imgCache = useRef(new Map<string, HTMLImageElement>()).current;
  function getCardAssetPath(id: string) {
    const c: any = (CARDS as any)[id];
    if (!c) return null;
    const base = (import.meta as any).env.BASE_URL || "/";
    return `${base}cards/${c.cardSetCode}/${c.imageName}`;
  }
  function getImage(id: string) {
    if (imgCache.has(id)) return imgCache.get(id)!;
    const src = getCardAssetPath(id);
    if (!src) return null;
    const img = new Image();
    img.src = src;
    imgCache.set(id, img);
    return img;
  }

  // Constrain graph to right pane width and keep it centered; disable pan/zoom/drag
  useEffect(() => {
    const onResize = () => {
      if (rightRef.current) setRightWidth(rightRef.current.clientWidth);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div style={{ display: 'flex', gap: 12, width: '100vw' }}>
      {/* Left list */}
      <div style={{ width: '20vw', display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 12, background: 'rgba(15,23,42,0.4)', border: '1px solid #334155' }}>
        <div style={{ color: '#e5e7eb', fontWeight: 600 }}>Cards</div>
        <input style={{ padding: '6px 8px', borderRadius: 6, background: '#1f2937', color: '#e5e7eb', border: '1px solid #334155' }} placeholder="Search by name or id" value={query} onChange={e=>setQuery(e.target.value)} />
        <div style={{ overflow: 'auto', maxHeight: height - 88 }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {cardList.slice(0, 1000).map(c => {
              const img = (CARDS as any)[c.id]?.imageName ? `${(import.meta as any).env.BASE_URL || "/"}cards/${(CARDS as any)[c.id]?.cardSetCode}/${(CARDS as any)[c.id]?.imageName}` : null;
              return (
                <li key={c.id} onClick={()=>setSelectedId(c.id)}
                  style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid rgba(51,65,85,0.5)', background: selectedId===c.id ? 'rgba(51,65,85,0.4)' : 'transparent' }}
                  onMouseEnter={e=>{ if(selectedId!==c.id) (e.currentTarget.style.background='rgba(31,41,55,0.4)') }}
                  onMouseLeave={e=>{ if(selectedId!==c.id) (e.currentTarget.style.background='transparent') }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {img ? <img src={img} alt={c.name} style={{ width: 44, height: 62, objectFit: 'cover', borderRadius: 6, border: '1px solid rgba(148,163,184,0.4)' }} /> : <div style={{ width: 44, height: 62, borderRadius: 6, background: '#1f2937' }} />}
                    <div style={{ minWidth: 0 }}>
                      <div title={c.name} style={{ color: '#e5e7eb', fontSize: 14, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                      <div style={{ color: '#94a3b8', fontSize: 12 }}>{c.id}</div>
                    </div>
                  </div>
                </li>
              );
            })}
            {cardList.length === 0 && <li style={{ padding: '8px', color: '#94a3b8' }}>No matches</li>}
          </ul>
        </div>
      </div>

      {/* Right graph */}
      <div ref={rightRef} style={{ position: 'relative', flex: '0 0 80vw', width: '80vw', borderRadius: 12, border: '1px solid #334155', overflow: 'hidden' }}>
        <React.Suspense fallback={<div style={{ padding: 16, color: '#cbd5e1' }}>Loading…</div>}>
          {/* @ts-ignore */}
          <ForceGraph2D
            ref={fgRef}
            height={height}
            width={rightWidth || undefined}
            graphData={focusData}
            nodeRelSize={6}
            linkDirectionalArrowLength={0}
            linkColor={() => "#94a3b8"}
            linkWidth={(l:any)=> 1 + 3*(l.score || 0)}
            enableZoomInteraction={true}
            enableNodeDrag={false}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D) => {
              const radius = node.size || 18;
              const img = getImage(node.id);
              ctx.save();
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius, 0, 2*Math.PI);
              ctx.closePath();
              ctx.clip();
              if (img && img.complete) ctx.drawImage(img, node.x - radius, node.y - radius, radius*2, radius*2);
              else { ctx.fillStyle = "#1f2937"; ctx.fill(); }
              ctx.restore();
              ctx.beginPath(); ctx.arc(node.x, node.y, radius, 0, 2*Math.PI);
              ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 2; ctx.stroke();

              // id label (above node)
              {
                const padX = 4, padY = 2;
                const label = String(node.id);
                ctx.font = `10px sans-serif`;
                const w = ctx.measureText(label).width + padX*2;
                const h = 12 + padY*2;
                const lx = node.x - w/2;
                const ly = node.y - radius - h - 6;
                ctx.fillStyle = "rgba(15,23,42,0.85)";
                ctx.fillRect(lx, ly, w, h);
                ctx.strokeStyle = "rgba(148,163,184,0.6)";
                ctx.strokeRect(lx, ly, w, h);
                ctx.fillStyle = "#e2e8f0";
                ctx.fillText(label, lx + padX, ly + 10 + padY - 2);
              }

              // score label for neighbors
              if (typeof node.score === 'number') {
                const label = node.score.toFixed(2);
                const padX = 4, padY = 2;
                ctx.font = `10px sans-serif`;
                const w = ctx.measureText(label).width + padX*2;
                const h = 12 + padY*2;
                const lx = node.x - w/2;
                const ly = node.y + radius + 6;
                ctx.fillStyle = "rgba(15,23,42,0.85)";
                ctx.fillRect(lx, ly, w, h);
                ctx.strokeStyle = "rgba(148,163,184,0.6)";
                ctx.strokeRect(lx, ly, w, h);
                ctx.fillStyle = "#e2e8f0";
                ctx.fillText(label, lx + padX, ly + 10 + padY - 2);
              }
            }}
            onNodeClick={(n:any) => {
              if (n && n.id) setSelectedId(n.id);
            }}
          />
        </React.Suspense>
        {/* Zoom controls */}
        <div style={{ position: 'absolute', right: 12, bottom: 12, display: 'flex', gap: 8 }}>
          <button
            onClick={() => { try { const k = (fgRef.current as any)?.zoom?.() || 1; (fgRef.current as any)?.zoom?.(Math.min(8, k * 1.2), 250); } catch {} }}
            style={{ padding: '6px 10px', borderRadius: 8, background: '#334155', color: '#e5e7eb', border: '1px solid #475569' }}
            title="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => { try { const k = (fgRef.current as any)?.zoom?.() || 1; (fgRef.current as any)?.zoom?.(Math.max(0.1, k / 1.2), 250); } catch {} }}
            style={{ padding: '6px 10px', borderRadius: 8, background: '#334155', color: '#e5e7eb', border: '1px solid #475569' }}
            title="Zoom out"
          >
            −
          </button>
          <button
            onClick={() => { try { (fgRef.current as any)?.zoomToFit?.(350, 40); } catch {} }}
            style={{ padding: '6px 10px', borderRadius: 8, background: '#334155', color: '#e5e7eb', border: '1px solid #475569' }}
            title="Reset view"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
