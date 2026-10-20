import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationNodeDatum } from "d3-force";
import type { ReferenceGraph } from "@/lib/domain/types";

export interface LaidOutNode {
  id: string;
  x: number;
  y: number;
  r: number;
  group: string;
}

interface SimNode extends SimulationNodeDatum {
  id: string;
  r: number;
  group: string;
}

const hash = (s: string) => {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967295;
};

export const nodeRadius = (inDegree: number, kind: string) => (kind === "asset" ? 5 + Math.min(4, Math.sqrt(inDegree)) : 7 + Math.min(16, Math.sqrt(inDegree) * 3.4));

/**
 * Deterministic force layout: nodes are pulled toward a per-content-type anchor on a ring so related
 * types form readable clusters, links keep references close, collision keeps labels apart.
 * Runs to completion synchronously (no animation jitter) so the picture is stable between renders.
 */
export function layoutGraph(g: ReferenceGraph): Map<string, LaidOutNode> {
  const inDeg = new Map<string, number>();
  for (const e of g.edges) inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1);

  const groups = [...new Set(g.nodes.map((n) => (n.kind === "asset" ? "asset" : n.contentTypeUid ?? "unknown")))].sort();
  const ringR = 150 + groups.length * 22;
  const anchor = new Map(groups.map((gr, i) => {
    const a = (i / groups.length) * Math.PI * 2 - Math.PI / 2;
    return [gr, { x: Math.cos(a) * ringR, y: Math.sin(a) * ringR }];
  }));

  const nodes: SimNode[] = g.nodes.map((n) => {
    const group = n.kind === "asset" ? "asset" : n.contentTypeUid ?? "unknown";
    const a = anchor.get(group) ?? { x: 0, y: 0 };
    return { id: n.id, group, r: nodeRadius(inDeg.get(n.id) ?? 0, n.kind), x: a.x + (hash(n.id) - 0.5) * 80, y: a.y + (hash(`${n.id}y`) - 0.5) * 80 };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const links = g.edges.filter((e) => byId.has(e.from) && byId.has(e.to)).map((e) => ({ source: e.from, target: e.to }));

  const sim = forceSimulation(nodes)
    .randomSource(() => 0.5)
    .force("link", forceLink<SimNode, { source: string; target: string }>(links).id((d) => d.id).distance(58).strength(0.25))
    .force("charge", forceManyBody<SimNode>().strength(-150).distanceMax(420))
    .force("x", forceX<SimNode>((d) => anchor.get(d.group)?.x ?? 0).strength(0.09))
    .force("y", forceY<SimNode>((d) => anchor.get(d.group)?.y ?? 0).strength(0.09))
    .force("collide", forceCollide<SimNode>((d) => d.r + 7).iterations(2))
    .stop();
  for (let i = 0; i < 420; i++) sim.tick();

  return new Map(nodes.map((n) => [n.id, { id: n.id, x: n.x ?? 0, y: n.y ?? 0, r: n.r, group: n.group }]));
}
