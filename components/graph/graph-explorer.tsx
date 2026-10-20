"use client";

import { select } from "d3-selection";
import { zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior } from "d3-zoom";
import "d3-transition";
import { AlertTriangle, Crosshair, Image as ImageIcon, Maximize2, Minus, Plus, Search, Unlink } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CsLink } from "@/components/ui/cs-link";
import { csLinks, type LinkBase } from "@/lib/domain/cs-links";
import { adjacency, dependencies, dependents, graphStats } from "@/lib/domain/graph";
import type { GraphNode, ReferenceGraph, Severity } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";
import { layoutGraph } from "./layout";

export interface EntryIssues {
  open: number;
  worst: Severity;
  items: { id: string; label: string; locale: string; severity: Severity }[];
}

interface Props {
  graph: ReferenceGraph;
  issues: Record<string, EntryIssues>;
  links: LinkBase | null;
  masterLocale: string;
  mode: "live" | "demo";
}

const PALETTE = ["#38baa2", "#7aa2f7", "#f2a65a", "#c678dd", "#e5c07b", "#61afef", "#e06c75", "#98c379", "#56b6c2", "#d19a66"];
const DEPTH_COLORS = ["#ff6b61", "#ffa94d", "#ffd866", "#f4f1a8", "#e8f1c0", "#dce8d0"];
const SEV_COLOR: Record<Severity, string> = { critical: "#ff6b61", high: "#ffa94d", medium: "#b4c0ff", low: "#7fd6b5" };
type Direction = "impact" | "deps";

export function GraphExplorer({ graph, issues, links, masterLocale, mode }: Props) {
  const layout = useMemo(() => layoutGraph(graph), [graph]);
  const adj = useMemo(() => adjacency(graph), [graph]);
  const stats = useMemo(() => graphStats(graph), [graph]);
  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);

  const types = useMemo(() => {
    const uids = [...new Set(graph.nodes.filter((n) => n.kind !== "asset").map((n) => n.contentTypeUid ?? "unknown"))].sort();
    return uids.map((uid, i) => ({
      uid,
      title: graph.nodes.find((n) => n.contentTypeUid === uid)?.contentTypeTitle ?? uid,
      color: PALETTE[i % PALETTE.length] as string,
      count: graph.nodes.filter((n) => n.contentTypeUid === uid && n.kind === "entry").length,
    }));
  }, [graph]);
  const colorOf = useCallback((n: GraphNode) => (n.kind === "asset" ? "#8aa0b2" : n.kind === "missing" ? "#ff6b61" : types.find((t) => t.uid === n.contentTypeUid)?.color ?? "#9fb3c0"), [types]);

  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showAssets, setShowAssets] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [direction, setDirection] = useState<Direction>("impact");
  const [query, setQuery] = useState("");
  const [offsets, setOffsets] = useState<Record<string, { dx: number; dy: number }>>({});
  const [tf, setTf] = useState({ x: 0, y: 0, k: 1 });
  const [size, setSize] = useState({ w: 1000, h: 640 });

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const dragged = useRef(false);

  // ----- visibility -----
  const visible = useCallback(
    (n: GraphNode) => (n.kind === "asset" ? showAssets : !hidden.has(n.contentTypeUid ?? "unknown")),
    [hidden, showAssets],
  );
  const visibleIds = useMemo(() => new Set(graph.nodes.filter(visible).map((n) => n.id)), [graph, visible]);
  const visibleEdges = useMemo(() => graph.edges.filter((e) => visibleIds.has(e.from) && visibleIds.has(e.to)), [graph, visibleIds]);

  const pos = useCallback(
    (id: string) => {
      const p = layout.get(id);
      const o = offsets[id];
      return { x: (p?.x ?? 0) + (o?.dx ?? 0), y: (p?.y ?? 0) + (o?.dy ?? 0), r: p?.r ?? 8 };
    },
    [layout, offsets],
  );

  // ----- impact -----
  const impact = useMemo(() => {
    if (!selected) return null;
    return direction === "impact" ? dependents(adj, selected) : dependencies(adj, selected);
  }, [selected, direction, adj]);
  const active = useMemo(() => {
    if (selected && impact) return new Set([selected, ...impact.keys()]);
    if (hovered) {
      const s = new Set([hovered]);
      for (const e of adj.out.get(hovered) ?? []) s.add(e.to);
      for (const e of adj.inc.get(hovered) ?? []) s.add(e.from);
      return s;
    }
    return null;
  }, [selected, impact, hovered, adj]);

  // ----- zoom / pan -----
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 4])
      .filter((e) => !(e.target as Element).closest?.("[data-node]") && (!e.ctrlKey || e.type === "wheel"))
      .on("zoom", (e: D3ZoomEvent<SVGSVGElement, unknown>) => setTf({ x: e.transform.x, y: e.transform.y, k: e.transform.k }));
    zoomRef.current = z;
    const svg = svgRef.current;
    select(svg).call(z).on("dblclick.zoom", null);
    return () => { select(svg).on(".zoom", null); };
  }, []);

  const fit = useCallback((animate = true, only?: Set<string>, maxK = 2.2) => {
    if (!svgRef.current || !zoomRef.current) return;
    const pts = graph.nodes.filter((n) => visibleIds.has(n.id) && (!only || only.has(n.id))).map((n) => pos(n.id));
    if (!pts.length) return;
    const minX = Math.min(...pts.map((p) => p.x - p.r)), maxX = Math.max(...pts.map((p) => p.x + p.r));
    const minY = Math.min(...pts.map((p) => p.y - p.r)), maxY = Math.max(...pts.map((p) => p.y + p.r));
    const k = Math.min(maxK, Math.max(0.2, 0.82 * Math.min(size.w / (maxX - minX || 1), size.h / (maxY - minY || 1))));
    const t = zoomIdentity.translate(size.w / 2 - ((minX + maxX) / 2) * k, size.h / 2 - ((minY + maxY) / 2) * k).scale(k);
    const sel = select(svgRef.current);
    if (animate) sel.transition().duration(500).call(zoomRef.current.transform, t);
    else sel.call(zoomRef.current.transform, t);
  }, [graph, visibleIds, pos, size]);

  const didFit = useRef(false);
  useEffect(() => {
    if (!didFit.current && size.w > 0) {
      didFit.current = true;
      fit(false);
    }
  }, [fit, size.w]);

  const zoomBy = (f: number) => {
    if (svgRef.current && zoomRef.current) select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, f);
  };

  // Select a node and frame it together with its blast radius (or dependencies), not a blind zoom-in.
  const focusNode = useCallback((id: string) => {
    setSelected(id);
    const related = direction === "impact" ? dependents(adj, id) : dependencies(adj, id);
    fit(true, new Set([id, ...related.keys()]), 1.5);
  }, [adj, direction, fit]);

  // ----- node dragging (works in graph space, independent of zoom) -----
  const startDrag = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    dragged.current = false;
    const startX = e.clientX, startY = e.clientY;
    const base = offsets[id] ?? { dx: 0, dy: 0 };
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / tf.k, dy = (ev.clientY - startY) / tf.k;
      if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) > 3) dragged.current = true;
      setOffsets((o) => ({ ...o, [id]: { dx: base.dx + dx, dy: base.dy + dy } }));
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ----- search -----
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return graph.nodes.filter((n) => visibleIds.has(n.id) && `${n.title} ${n.uid} ${n.contentTypeTitle ?? ""}`.toLowerCase().includes(q)).slice(0, 6);
  }, [query, graph, visibleIds]);

  // ----- render helpers -----
  const labelFor = (n: GraphNode, inDeg: number) => {
    if (selected === n.id || hovered === n.id) return true;
    // With a selection, label only direct neighbours so the blast radius stays readable.
    if (selected) return impact?.get(n.id) === 1 && tf.k > 0.6 ? true : tf.k > 2.4;
    if (hovered) return active?.has(n.id) === true && tf.k > 0.55;
    return tf.k > 1.7 || (n.kind === "entry" && inDeg >= 3 && tf.k > 0.5);
  };
  const trunc = (s: string, n = 28) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

  const sel = selected ? nodeById.get(selected) : undefined;
  const selIssues = selected ? issues[selected] : undefined;
  const dependentsByDepth = useMemo(() => {
    const m = new Map<number, GraphNode[]>();
    if (impact) for (const [id, d] of impact) { const n = nodeById.get(id); if (n) m.set(d, [...(m.get(d) ?? []), n]); }
    return m;
  }, [impact, nodeById]);
  const impactNodes = impact ? [...impact.keys()].map((id) => nodeById.get(id)).filter((n): n is GraphNode => Boolean(n)) : [];
  const impactEntries = impactNodes.filter((n) => n.kind !== "asset");
  const impactTypes = new Set(impactEntries.map((n) => n.contentTypeTitle ?? n.contentTypeUid)).size;
  const impactWithIssues = impactEntries.filter((n) => issues[n.id]?.open).length;
  const referencedBy = sel ? (adj.inc.get(sel.id) ?? []).map((e) => ({ e, n: nodeById.get(e.from) })).filter((x): x is { e: typeof x.e; n: GraphNode } => Boolean(x.n)) : [];
  const references = sel ? (adj.out.get(sel.id) ?? []).map((e) => ({ e, n: nodeById.get(e.to) })).filter((x): x is { e: typeof x.e; n: GraphNode } => Boolean(x.n)) : [];

  const NodeRow = ({ n, hint }: { n: GraphNode; hint?: string }) => (
    <button onClick={() => focusNode(n.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-canvas">
      <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(n) }} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-text">{n.title}</span>
        <span className="block truncate text-[10px] text-muted">{n.kind === "asset" ? "Asset" : n.contentTypeTitle}{hint ? ` · ${hint}` : ""}</span>
      </span>
      {issues[n.id]?.open ? <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: SEV_COLOR[issues[n.id]!.worst] }} title="Open localization issues">{issues[n.id]!.open}</span> : null}
    </button>
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      {/* ---------------- canvas ---------------- */}
      <div className="relative overflow-hidden rounded-2xl border border-[#1f3042] bg-[#0f1824] shadow-card">
        <div ref={wrapRef} className="h-[72vh] min-h-[520px] w-full touch-none">
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            role="application"
            aria-label="Reference graph. Use the node list in the side panel for keyboard navigation."
            className="block cursor-grab active:cursor-grabbing"
            onClick={() => { if (!dragged.current) setSelected(null); }}
          >
            <defs>
              <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1" fill="#1d2d3f" /></pattern>
              <radialGradient id="vignette" cx="50%" cy="45%" r="75%"><stop offset="0" stopColor="#16283a" stopOpacity="0.9" /><stop offset="1" stopColor="#0b121b" stopOpacity="0" /></radialGradient>
              <filter id="glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              {["#4d6a82", "#7fd6cb", ...DEPTH_COLORS].map((c) => (
                <marker key={c} id={`arrow-${c.slice(1)}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" fill={c} /></marker>
              ))}
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
            <rect width="100%" height="100%" fill="url(#vignette)" pointerEvents="none" />

            <g transform={`translate(${tf.x},${tf.y}) scale(${tf.k})`}>
              {/* edges */}
              {visibleEdges.map((e) => {
                const a = pos(e.from), b = pos(e.to);
                const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || 1;
                const ux = dx / dist, uy = dy / dist;
                const x1 = a.x + ux * (a.r + 1), y1 = a.y + uy * (a.r + 1), x2 = b.x - ux * (b.r + 3), y2 = b.y - uy * (b.r + 3);
                const cx = (x1 + x2) / 2 - uy * dist * 0.1, cy = (y1 + y2) / 2 + ux * dist * 0.1;
                const on = active ? active.has(e.from) && active.has(e.to) : false;
                let color = "#4d6a82";
                if (on && selected && impact) {
                  const d = direction === "impact" ? impact.get(e.from) : impact.get(e.to);
                  color = DEPTH_COLORS[Math.min((d ?? 1) - 1, DEPTH_COLORS.length - 1)] ?? "#7fd6cb";
                } else if (on) color = "#7fd6cb";
                return (
                  <path
                    key={e.id}
                    d={`M${x1},${y1} Q${cx},${cy} ${x2},${y2}`}
                    fill="none"
                    stroke={color}
                    strokeWidth={on ? 1.8 : 1}
                    strokeDasharray={e.via === "asset" ? "3 3" : e.via === "rte" ? "1 3" : undefined}
                    opacity={active ? (on ? 0.9 : 0.05) : 0.32}
                    markerEnd={`url(#arrow-${color.slice(1)})`}
                  />
                );
              })}

              {/* nodes */}
              {graph.nodes.filter((n) => visibleIds.has(n.id)).map((n) => {
                const p = pos(n.id);
                const inDeg = adj.inc.get(n.id)?.length ?? 0;
                const iss = issues[n.id];
                const isSel = selected === n.id;
                const depth = impact?.get(n.id);
                const dim = active ? !active.has(n.id) : false;
                const ring = depth !== undefined ? DEPTH_COLORS[Math.min(depth - 1, DEPTH_COLORS.length - 1)] : iss ? SEV_COLOR[iss.worst] : "rgba(255,255,255,.28)";
                const fill = colorOf(n);
                return (
                  <g
                    key={n.id}
                    data-node
                    transform={`translate(${p.x},${p.y})`}
                    opacity={dim ? 0.13 : 1}
                    style={{ cursor: "pointer", transition: "opacity .2s" }}
                    tabIndex={0}
                    role="button"
                    aria-label={`${n.title}, ${n.kind === "asset" ? "asset" : n.contentTypeTitle}, referenced by ${inDeg}${iss ? `, ${iss.open} open localization issues` : ""}`}
                    aria-pressed={isSel}
                    onPointerDown={(e) => startDrag(e, n.id)}
                    onClick={(e) => { e.stopPropagation(); if (!dragged.current) setSelected(isSel ? null : n.id); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(isSel ? null : n.id); } if (e.key === "Escape") setSelected(null); }}
                    onPointerEnter={() => setHovered(n.id)}
                    onPointerLeave={() => setHovered(null)}
                    onFocus={() => setHovered(n.id)}
                    onBlur={() => setHovered(null)}
                  >
                    {isSel && <circle r={p.r + 10} fill={fill} opacity={0.22} filter="url(#glow)" />}
                    {depth === 1 && <circle r={p.r + 6} fill="none" stroke={ring} strokeWidth={1.5} opacity={0.6}><animate attributeName="r" values={`${p.r + 4};${p.r + 11};${p.r + 4}`} dur="2.2s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.7;0;0.7" dur="2.2s" repeatCount="indefinite" /></circle>}
                    {n.kind === "asset" ? (
                      <rect x={-p.r} y={-p.r} width={p.r * 2} height={p.r * 2} rx={3} fill={fill} fillOpacity={0.85} stroke={ring} strokeWidth={depth !== undefined ? 2.5 : 1.5} transform="rotate(45)" />
                    ) : (
                      <>
                        <circle r={p.r} fill={fill} fillOpacity={n.kind === "missing" ? 0.15 : 0.92} stroke={ring} strokeWidth={depth !== undefined || iss ? 2.6 : 1.4} strokeDasharray={n.kind === "missing" || n.unscanned ? "3 2" : undefined} />
                        {n.kind === "missing" && <text textAnchor="middle" dy="0.35em" fontSize={p.r} fontWeight={800} fill="#ff6b61">!</text>}
                      </>
                    )}
                    {iss && n.kind !== "missing" && <circle cx={p.r * 0.75} cy={-p.r * 0.75} r={4.5} fill={SEV_COLOR[iss.worst]} stroke="#0f1824" strokeWidth={1.5} />}
                    {labelFor(n, inDeg) && (
                      <text y={p.r + 13} textAnchor="middle" fontSize={11} fontWeight={isSel ? 700 : 500} fill="#e8f1f5" stroke="#0f1824" strokeWidth={3.5} paintOrder="stroke" style={{ pointerEvents: "none" }}>
                        {trunc(n.title)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* top-left: search + filters */}
        <div className="pointer-events-none absolute left-3 top-3 flex max-w-[calc(100%-5rem)] flex-col gap-2">
          <div className="pointer-events-auto relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7d93a6]" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find an entry…"
              aria-label="Find an entry in the graph"
              className="min-h-[38px] w-full rounded-lg border border-[#2a4057] bg-[#132033]/90 pl-8 pr-3 text-xs text-white placeholder:text-[#7d93a6] backdrop-blur"
            />
            {results.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-[#2a4057] bg-[#132033] text-xs text-white shadow-xl">
                {results.map((n) => (
                  <li key={n.id}>
                    <button className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[#1c3047]" onClick={() => { focusNode(n.id); setQuery(""); }}>
                      <i className="h-2 w-2 rounded-full" style={{ background: colorOf(n) }} />
                      <span className="truncate">{n.title}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-[#7d93a6]">{n.contentTypeTitle ?? "Asset"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="pointer-events-auto flex max-w-[34rem] flex-wrap gap-1.5" role="group" aria-label="Content type filters">
            {types.map((t) => {
              const off = hidden.has(t.uid);
              return (
                <button
                  key={t.uid}
                  aria-pressed={!off}
                  onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(t.uid)) n.delete(t.uid); else n.add(t.uid); return n; })}
                  className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold backdrop-blur transition", off ? "border-[#223347] bg-[#0f1824]/70 text-[#5d7388]" : "border-[#2a4057] bg-[#132033]/85 text-[#dce8ef]")}
                >
                  <i className="h-2 w-2 rounded-full" style={{ background: off ? "#3a4d60" : t.color }} aria-hidden />{t.title}<span className="text-[#7d93a6]">{t.count}</span>
                </button>
              );
            })}
            <button
              aria-pressed={showAssets}
              onClick={() => setShowAssets((v) => !v)}
              className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold backdrop-blur", showAssets ? "border-[#2a4057] bg-[#132033]/85 text-[#dce8ef]" : "border-[#223347] bg-[#0f1824]/70 text-[#5d7388]")}
            >
              <ImageIcon size={11} aria-hidden /> Assets <span className="text-[#7d93a6]">{stats.assets}</span>
            </button>
          </div>
        </div>

        {/* top-right: zoom */}
        <div className="absolute right-3 top-3 flex flex-col gap-1.5">
          <button onClick={() => zoomBy(1.4)} aria-label="Zoom in" title="Zoom in" className="grid h-9 w-9 place-items-center rounded-lg border border-[#2a4057] bg-[#132033]/90 text-[#dce8ef] backdrop-blur hover:bg-[#1c3047]"><Plus size={15} /></button>
          <button onClick={() => zoomBy(1 / 1.4)} aria-label="Zoom out" title="Zoom out" className="grid h-9 w-9 place-items-center rounded-lg border border-[#2a4057] bg-[#132033]/90 text-[#dce8ef] backdrop-blur hover:bg-[#1c3047]"><Minus size={15} /></button>
          <button onClick={() => fit(true)} aria-label="Fit graph to view" title="Fit graph to view" className="grid h-9 w-9 place-items-center rounded-lg border border-[#2a4057] bg-[#132033]/90 text-[#dce8ef] backdrop-blur hover:bg-[#1c3047]"><Maximize2 size={15} /></button>
        </div>

        {/* bottom-left: legend + mode */}
        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-end gap-3">
          <div className="pointer-events-auto rounded-xl border border-[#2a4057] bg-[#132033]/90 p-1 backdrop-blur" role="group" aria-label="Highlight mode">
            {([["impact", "Blast radius"], ["deps", "Dependencies"]] as const).map(([v, label]) => (
              <button key={v} aria-pressed={direction === v} onClick={() => setDirection(v)} className={cn("rounded-lg px-3 py-1.5 text-[11px] font-bold", direction === v ? "bg-accent text-white" : "text-[#9fb3c0] hover:text-white")}>{label}</button>
            ))}
          </div>
          <div className="rounded-xl border border-[#2a4057] bg-[#132033]/90 px-3 py-2 text-[10px] text-[#9fb3c0] backdrop-blur">
            <div className="mb-1 flex items-center gap-2">
              <span className="font-bold text-[#dce8ef]">{direction === "impact" ? "Edit impact" : "Depends on"}</span>
              {DEPTH_COLORS.slice(0, 3).map((c, i) => <span key={c} className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: c }} />{i + 1}{i === 2 ? "+" : ""} hop</span>)}
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: SEV_COLOR.critical }} />open issues</span>
              <span className="flex items-center gap-1"><i className="h-2 w-2 rotate-45 bg-[#8aa0b2]" />asset</span>
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full border border-dashed border-[#ff6b61]" />broken</span>
              <span>size = referenced by</span>
            </div>
          </div>
        </div>
        <p className="pointer-events-none absolute bottom-3 right-3 hidden text-[10px] text-[#5d7388] md:block">Scroll to zoom · drag canvas to pan · drag nodes · click to analyse</p>
      </div>

      {/* ---------------- side panel ---------------- */}
      <Card className="max-h-[72vh] min-h-[520px] overflow-y-auto p-0">
        {!sel ? (
          <div className="p-5">
            <div className="eyebrow">Reference impact graph</div>
            <h2 className="mt-1.5 text-lg font-bold tracking-tight">Know the blast radius before you edit.</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">Click any node to see everything that references it (what could change if you edit it) or everything it depends on.</p>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[["Entries", stats.entries], ["Assets", stats.assets], ["References", stats.edges]].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-line bg-[#fafcfb] py-2.5"><dd className="text-xl font-bold">{v}</dd><dt className="text-[10px] uppercase tracking-wide text-muted">{k}</dt></div>
              ))}
            </dl>

            <h3 className="mb-1 mt-5 text-[11px] font-extrabold uppercase tracking-wider text-[#8595a0]">Highest blast radius</h3>
            {stats.hubs.length === 0 ? <p className="text-xs text-muted">No entry is referenced by another entry.</p> : stats.hubs.map((h) => <NodeRow key={h.node.id} n={h.node} hint={`${h.transitive} dependents · ${h.direct} direct`} />)}

            <h3 className="mb-1 mt-5 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#8595a0]"><Unlink size={12} /> Broken references ({stats.broken.length})</h3>
            {stats.broken.length === 0 ? <p className="text-xs text-muted">None found among fully scanned content types.</p> : stats.broken.map((n) => <NodeRow key={n.id} n={n} hint={`referenced by ${adj.inc.get(n.id)?.length ?? 0}`} />)}

            <h3 className="mb-1 mt-5 text-[11px] font-extrabold uppercase tracking-wider text-[#8595a0]">Not referenced by anything ({stats.orphans.length})</h3>
            <p className="mb-1 text-[11px] text-muted">May be intentional (top-level pages). Review before assuming they are unused: pages can be reached by URL, not by reference.</p>
            {stats.orphans.slice(0, 6).map((n) => <NodeRow key={n.id} n={n} />)}
            {stats.orphans.length > 6 && <p className="px-2.5 text-[10px] text-muted">…and {stats.orphans.length - 6} more</p>}

            {graph.note && <p className="mt-5 rounded-lg border border-[#d9ece5] bg-[#eff8f5] p-3 text-[11px] leading-relaxed text-[#537169]">{graph.note} {mode === "demo" ? "Demo graph: sample fixtures." : ""}</p>}
          </div>
        ) : (
          <div>
            <div className="border-b border-line p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider" style={{ color: colorOf(sel) }}><i className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(sel) }} />{sel.kind === "asset" ? "Asset" : sel.contentTypeTitle}</span>
                    {sel.kind === "missing" && <Badge tone="critical">Broken reference</Badge>}
                    {sel.unscanned && <Badge tone="neutral">Not scanned</Badge>}
                  </div>
                  <h2 className="break-words text-lg font-bold leading-snug tracking-tight">{sel.title}</h2>
                  <p className="mt-0.5 break-all font-mono text-[10px] text-muted">{sel.id}</p>
                </div>
                <button onClick={() => setSelected(null)} className="rounded-lg border border-line px-2 py-1 text-[11px] font-bold text-muted hover:bg-canvas" aria-label="Clear selection">Clear</button>
              </div>
              <div className="mt-3 flex flex-wrap gap-4">
                {links && sel.kind === "entry" && sel.contentTypeUid && <CsLink href={csLinks.entry(links, sel.contentTypeUid, masterLocale, sel.uid)} label={`Open ${sel.title} in Contentstack`}>Open in Contentstack</CsLink>}
                <button onClick={() => focusNode(sel.id)} className="inline-flex items-center gap-1 text-[11px] font-bold text-accent hover:underline"><Crosshair size={12} /> Center</button>
              </div>
            </div>

            <div className="space-y-5 p-5">
              {sel.kind === "missing" ? (
                <div className="rounded-lg border border-[#f0c9c5] bg-danger-soft p-3 text-xs leading-relaxed text-[#8f2f2a]">
                  <p className="flex items-center gap-1.5 font-bold"><AlertTriangle size={13} /> This entry does not exist.</p>
                  <p className="mt-1">{referencedBy.length} entr{referencedBy.length === 1 ? "y points" : "ies point"} at it. Published pages that render this reference will show nothing or fail. Restore the entry or remove the reference.</p>
                </div>
              ) : (
                <div className="rounded-xl p-4 text-white" style={{ background: "linear-gradient(135deg,#16283a,#0f1824)" }}>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#7fd6cb]">{direction === "impact" ? "If you edit this" : "This depends on"}</div>
                  <div className="mt-1 text-3xl font-bold tracking-tight">{impact?.size ?? 0}<span className="ml-1.5 text-sm font-medium text-[#9fb3c0]">{direction === "impact" ? "entries & pages affected" : "items"}</span></div>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#9fb3c0]">
                    {impact && impact.size > 0
                      ? direction === "impact"
                        ? `${impactEntries.length} across ${impactTypes} content type${impactTypes === 1 ? "" : "s"}${impactWithIssues ? ` · ${impactWithIssues} already have open localization issues` : ""}. Every locale of this entry is affected, not just ${masterLocale}.`
                        : `${impactEntries.length} entries${impactNodes.length - impactEntries.length ? ` and ${impactNodes.length - impactEntries.length} assets` : ""} this content relies on.`
                      : direction === "impact" ? "Nothing references this entry: editing it cannot break another entry (it may still be reachable by URL)." : "This entry references nothing else."}
                  </p>
                  {impact && impact.size > 0 && (
                    <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-[#223347]" role="img" aria-label={`Depth breakdown: ${[...dependentsByDepth].map(([d, ns]) => `${ns.length} at ${d} hop`).join(", ")}`}>
                      {[...dependentsByDepth].sort((a, b) => a[0] - b[0]).map(([d, ns]) => <div key={d} style={{ width: `${(ns.length / impact.size) * 100}%`, background: DEPTH_COLORS[Math.min(d - 1, DEPTH_COLORS.length - 1)] }} title={`${ns.length} at ${d} hop`} />)}
                    </div>
                  )}
                </div>
              )}

              {selIssues && (
                <section>
                  <h3 className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#8595a0]">Localization issues on this entry ({selIssues.open})</h3>
                  {selIssues.items.map((i) => (
                    <Link key={i.id} href={`/localization?issue=${i.id}`} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs hover:bg-canvas">
                      <i className="h-2.5 w-2.5 rounded-full" style={{ background: SEV_COLOR[i.severity] }} />
                      <span className="flex-1 truncate font-semibold">{i.label}</span>
                      <span className="text-[10px] text-muted">{i.locale.toUpperCase()} · review →</span>
                    </Link>
                  ))}
                  {selIssues.open > selIssues.items.length && <p className="px-2.5 text-[10px] text-muted">…and {selIssues.open - selIssues.items.length} more in the issue queue</p>}
                </section>
              )}

              {impact && impact.size > 0 && (
                <section>
                  <h3 className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#8595a0]">{direction === "impact" ? "Affected by an edit" : "Depends on"}</h3>
                  {[...dependentsByDepth].sort((a, b) => a[0] - b[0]).map(([d, ns]) => (
                    <div key={d} className="mb-2">
                      <div className="mb-0.5 flex items-center gap-1.5 px-2.5 text-[10px] font-bold uppercase tracking-wide text-muted"><i className="h-2 w-2 rounded-full" style={{ background: DEPTH_COLORS[Math.min(d - 1, DEPTH_COLORS.length - 1)] }} />{d === 1 ? "Direct" : `${d} hops away`} · {ns.length}</div>
                      {ns.slice(0, 8).map((n) => <NodeRow key={n.id} n={n} />)}
                      {ns.length > 8 && <p className="px-2.5 text-[10px] text-muted">…and {ns.length - 8} more</p>}
                    </div>
                  ))}
                </section>
              )}

              {sel.kind !== "missing" && (
                <section>
                  <h3 className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#8595a0]">References ({references.length})</h3>
                  {references.length === 0 ? <p className="px-2.5 text-xs text-muted">None.</p> : references.slice(0, 10).map(({ e, n }) => <NodeRow key={e.id} n={n} hint={`via ${e.field}`} />)}
                  {references.length > 10 && <p className="px-2.5 text-[10px] text-muted">…and {references.length - 10} more</p>}
                </section>
              )}
              {sel.kind !== "missing" && direction === "deps" && (
                <section>
                  <h3 className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#8595a0]">Directly referenced by ({referencedBy.length})</h3>
                  {referencedBy.slice(0, 10).map(({ e, n }) => <NodeRow key={e.id} n={n} hint={`via ${e.field}`} />)}
                </section>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
