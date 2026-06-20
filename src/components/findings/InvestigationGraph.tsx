'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { buildInvestigationGraph, NODE_COLOR, type GraphNode } from '@/lib/findings/graph';
import type { DrawerStackItem, DrawerType, Entity, Finding } from '@/lib/findings/types';
import { encodeStack, parseStack } from '@/lib/findings/stack';
import { InvestigationDrawerStack } from './InvestigationDrawerStack';

/**
 * The /graph surface - one explorable relationship map across every finding. Shared nodes collapse,
 * so the map shows what the per-finding drawer cannot: which names sit on the same bottleneck, theme
 * or buyer. Tap any node to open its drawer (reusing the investigation drawer stack against a merged
 * synthetic finding) and walk its connections + evidence; the drawer state is URL-persisted (?inv=)
 * so a graph investigation is shareable and survives reload. Deterministic layout, deterministic data.
 */

function drawerTypeForEntity(type: Entity['type']): DrawerType {
  if (type === 'company') return 'company';
  if (type === 'theme') return 'theme';
  if (type === 'supply_chain_node') return 'supply_chain_node';
  if (type === 'investor') return 'investor';
  return 'company';
}

const LEGEND: { type: Entity['type']; label: string }[] = [
  { type: 'company', label: 'Company' },
  { type: 'theme', label: 'Theme' },
  { type: 'supply_chain_node', label: 'Bottleneck' },
  { type: 'government_agency', label: 'Agency' },
];

export function InvestigationGraph({ findings }: { findings?: Finding[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Build from live findings, but ONLY use them if they actually produce nodes - a graph with no
  // company/theme/bottleneck nodes would render as a blank canvas. Otherwise fall back to the demo map
  // so the surface is never empty (and is honestly labelled below).
  const { graph, isLive } = useMemo(() => {
    if (findings && findings.length) {
      const live = buildInvestigationGraph(findings);
      if (live.nodes.length > 0) return { graph: live, isLive: true };
    }
    return { graph: buildInvestigationGraph(), isLive: false };
  }, [findings]);
  const [hovered, setHovered] = useState<string | null>(null);

  const stack = useMemo(() => parseStack(params.get('inv')), [params]);
  const selectedId = stack.length ? stack[stack.length - 1].id : null;
  const active = hovered ?? selectedId;

  const setStack = useCallback(
    (next: DrawerStackItem[]) => {
      const qs = next.length ? `?inv=${encodeURIComponent(encodeStack(next))}` : '';
      router.push(`${pathname}${qs}`, { scroll: false });
    },
    [router, pathname],
  );

  const openNode = useCallback(
    (n: GraphNode) => setStack([{ type: drawerTypeForEntity(n.type), id: n.id, title: n.name }]),
    [setStack],
  );
  const push = useCallback((item: DrawerStackItem) => setStack([...stack, item]), [setStack, stack]);
  const back = useCallback(() => setStack(stack.slice(0, -1)), [setStack, stack]);
  const close = useCallback(() => setStack([]), [setStack]);

  // Title the stack from the merged finding so the breadcrumb reads names, not ids.
  const titledStack = useMemo(
    () =>
      stack.map((item) => {
        const ent = graph.merged.entities.find((e) => e.id === item.id);
        const ev = graph.merged.evidence.find((e) => e.id === item.id);
        return { ...item, title: ent?.name ?? ev?.sourceName ?? item.id };
      }),
    [stack, graph.merged],
  );

  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);
  const isEdgeActive = (from: string, to: string) => active != null && (active === from || active === to);

  return (
    <div className="space-y-3 pb-28 xl:pb-6">
      <div className="terminal-panel overflow-x-auto rounded-md p-2">
        <svg
          viewBox={`0 0 ${graph.width} ${graph.height}`}
          className="mx-auto block h-auto w-full"
          style={{ minWidth: 540, maxWidth: 720 }}
          role="img"
          aria-label="Investigation relationship graph"
        >
          {/* edges */}
          {graph.edges.map((e, i) => {
            const a = nodeById.get(e.from);
            const b = nodeById.get(e.to);
            if (!a || !b) return null;
            const act = isEdgeActive(e.from, e.to);
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            return (
              <g key={`${e.from}-${e.to}-${e.relationshipType}-${i}`}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={act ? '#5bc8ff' : '#1b2530'}
                  strokeWidth={act ? 1.8 : 1}
                  strokeOpacity={active && !act ? 0.25 : 1}
                />
                {act && (
                  <text x={mx} y={my - 3} textAnchor="middle" className="fill-[#8190a0]" style={{ fontSize: 9 }}>
                    {e.relationshipType.replace(/_/g, ' ')}
                  </text>
                )}
              </g>
            );
          })}

          {/* nodes */}
          {graph.nodes.map((n) => {
            const r = Math.min(30, 15 + n.degree * 3);
            const color = NODE_COLOR[n.type] ?? '#8190a0';
            const dim = active != null && active !== n.id && !graph.edges.some((e) => (e.from === active && e.to === n.id) || (e.to === active && e.from === n.id));
            return (
              <g
                key={n.id}
                transform={`translate(${n.x} ${n.y})`}
                onClick={() => openNode(n)}
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer', opacity: dim ? 0.4 : 1 }}
              >
                <circle r={r} fill="#0b1016" stroke={color} strokeWidth={n.id === selectedId ? 3 : 1.6} />
                <text textAnchor="middle" dy="0.32em" fill={color} style={{ fontSize: 11, fontWeight: 600 }}>
                  {n.ref ?? n.name.slice(0, 6)}
                </text>
                <text textAnchor="middle" y={r + 12} className="fill-[#a8b5c2]" style={{ fontSize: 9 }}>
                  {n.name.length > 22 ? `${n.name.slice(0, 21)}…` : n.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-1">
        {LEGEND.map((l) => (
          <span key={l.type} className="flex items-center gap-1.5 text-[10px] text-[#8190a0]">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: NODE_COLOR[l.type] }} />
            {l.label}
          </span>
        ))}
        <span className="text-[10px] text-[#8190a0]">Tap a node to investigate - bigger = more connected.</span>
        <span className={`text-[10px] ${isLive ? 'text-[#43d18b]' : 'text-[#8190a0]'}`}>
          {isLive ? 'Live - built from your findings' : 'Demo map - live findings populate this as the scanner surfaces setups'}
        </span>
      </div>

      <InvestigationDrawerStack finding={graph.merged} stack={titledStack} onPush={push} onBack={back} onClose={close} />
    </div>
  );
}
