'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Maximize2, Minus, Network, Plus, X } from 'lucide-react';
import type { ServiceCriticality, ServiceEnvironment, ServiceHealthStatus, ServiceType } from '../../../lib/types';
import { EmptyState, ErrorBanner, HealthBadge, cn } from '../_components/ui';
import { Button, PageHeader, Pill, Select, Skeleton, useApi } from '../_components/kit';

type MapNode = { id: number; name: string; serviceType: ServiceType; environment: ServiceEnvironment; criticality: ServiceCriticality; healthStatus: ServiceHealthStatus; atRisk: boolean; openIncidentId: number | null };
type MapEdge = { id: number; from: number; to: number; kind: 'hard' | 'soft' };
type Placed = MapNode & { x: number; y: number; col: number };

const NODE_W = 196;
const NODE_H = 56;
const COL_W = NODE_W + 120;
const ROW_H = NODE_H + 26;
const PAD = 24;

const HEALTH_COLOR: Record<ServiceHealthStatus, string> = {
  healthy: '#22a35a',
  degraded: '#e3a008',
  down: '#dc2626',
  maintenance: '#0284c7',
  pending: '#7c3aed',
  unknown: '#94a3b8',
};
const CRIT_RANK: Record<ServiceCriticality, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/**
 * Layered layout: a service's column is its dependency depth (longest chain of dependencies below it).
 * Services with no dependencies sit in the right-most column; dependents flow in from the left, so every
 * arrow (dependent → dependency) points rightwards. Rows are ordered by barycenter sweeps to reduce crossings.
 */
function layout(nodes: MapNode[], edges: MapEdge[]) {
  const deps = new Map<number, number[]>();
  const users = new Map<number, number[]>();
  for (const n of nodes) {
    deps.set(n.id, []);
    users.set(n.id, []);
  }
  for (const e of edges) {
    deps.get(e.from)?.push(e.to);
    users.get(e.to)?.push(e.from);
  }
  const depth = new Map<number, number>();
  const visiting = new Set<number>();
  const depthOf = (id: number): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0; // cycle guard
    visiting.add(id);
    let d = 0;
    for (const t of deps.get(id) ?? []) d = Math.max(d, depthOf(t) + 1);
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };
  nodes.forEach((n) => depthOf(n.id));
  const maxDepth = Math.max(0, ...depth.values());
  const cols: MapNode[][] = Array.from({ length: maxDepth + 1 }, () => []);
  for (const n of nodes) cols[maxDepth - (depth.get(n.id) ?? 0)]!.push(n);
  cols.forEach((c) => c.sort((a, b) => CRIT_RANK[a.criticality] - CRIT_RANK[b.criticality] || a.name.localeCompare(b.name)));

  const rowPos = () => {
    const pos = new Map<number, number>();
    cols.forEach((c) => c.forEach((n, i) => pos.set(n.id, c.length > 1 ? i / (c.length - 1) : 0.5)));
    return pos;
  };
  for (let iter = 0; iter < 4; iter++) {
    const order = iter % 2 === 0 ? [...cols.keys()].reverse() : [...cols.keys()];
    for (const ci of order) {
      const pos = rowPos();
      const neighbours = (id: number) => [...(deps.get(id) ?? []), ...(users.get(id) ?? [])].map((x) => pos.get(x)).filter((v): v is number => v !== undefined);
      const bary = new Map(cols[ci]!.map((n, i) => {
        const nb = neighbours(n.id);
        return [n.id, nb.length ? nb.reduce((a, b) => a + b, 0) / nb.length : pos.get(n.id) ?? i];
      }));
      cols[ci]!.sort((a, b) => bary.get(a.id)! - bary.get(b.id)!);
    }
  }

  const maxRows = Math.max(1, ...cols.map((c) => c.length));
  const placed = new Map<number, Placed>();
  cols.forEach((c, ci) => {
    const offset = ((maxRows - c.length) * ROW_H) / 2;
    c.forEach((n, ri) => placed.set(n.id, { ...n, col: ci, x: PAD + ci * COL_W, y: PAD + offset + ri * ROW_H }));
  });
  return {
    placed,
    width: PAD * 2 + (cols.length - 1) * COL_W + NODE_W,
    height: PAD * 2 + (maxRows - 1) * ROW_H + NODE_H,
    deps,
    users,
  };
}

function reach(start: number, graph: Map<number, number[]>) {
  const seen = new Set<number>();
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of graph.get(cur) ?? []) {
      if (!seen.has(n) && n !== start) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return seen;
}

export default function DependencyMapPage() {
  const { data, error, loading, reload } = useApi<{ nodes: MapNode[]; edges: MapEdge[] }>('/api/dependency-map');
  const [env, setEnv] = useState<'' | ServiceEnvironment>('');
  const [hover, setHover] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null);
  const movedRef = useRef(false);

  const visible = useMemo(() => {
    const nodes = (data?.nodes ?? []).filter((n) => !env || n.environment === env);
    const ids = new Set(nodes.map((n) => n.id));
    const edges = (data?.edges ?? []).filter((e) => ids.has(e.from) && ids.has(e.to));
    return { nodes, edges };
  }, [data, env]);

  const graph = useMemo(() => layout(visible.nodes, visible.edges), [visible]);

  const focusId = hover ?? selected;
  const path = useMemo(() => {
    if (focusId === null || !graph.placed.has(focusId)) return null;
    return { down: reach(focusId, graph.deps), up: reach(focusId, graph.users) };
  }, [focusId, graph]);

  const fit = useCallback(() => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const k = Math.min(1.2, Math.max(0.25, Math.min(box.width / (graph.width + 20), box.height / (graph.height + 20))));
    setView({ k, x: (box.width - graph.width * k) / 2, y: (box.height - graph.height * k) / 2 });
  }, [graph.width, graph.height]);

  const hasData = Boolean(data);
  useEffect(() => {
    fit();
  }, [fit, hasData, visible.nodes.length]);

  useEffect(() => {
    if (selected !== null && !graph.placed.has(selected)) setSelected(null);
  }, [graph, selected]);

  const zoom = (factor: number) => {
    const box = boxRef.current?.getBoundingClientRect();
    const cx = (box?.width ?? 0) / 2;
    const cy = (box?.height ?? 0) / 2;
    setView((v) => {
      const k = Math.min(2.5, Math.max(0.2, v.k * factor));
      return { k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k };
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y, moved: false };
    movedRef.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (!d.moved && Math.hypot(dx, dy) > 4) {
      d.moved = true;
      movedRef.current = true;
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    }
    if (d.moved) setView((v) => ({ ...v, x: d.x + dx, y: d.y + dy }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const counts = useMemo(() => {
    const failing = visible.nodes.filter((n) => n.healthStatus === 'down' || n.healthStatus === 'degraded').length;
    return { services: visible.nodes.length, deps: visible.edges.length, failing, atRisk: visible.nodes.filter((n) => n.atRisk).length };
  }, [visible]);

  const sel = selected !== null ? graph.placed.get(selected) ?? null : null;
  const nameOf = (id: number) => graph.placed.get(id)?.name ?? `#${id}`;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dependency map"
        description="How services depend on each other, and what is at risk when one fails."
        actions={
          <Select className="w-auto min-w-[180px]" value={env} onChange={(e) => setEnv(e.target.value as ServiceEnvironment | '')} aria-label="Filter by environment">
            <option value="">All environments</option>
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="development">Development</option>
          </Select>
        }
      />

      {error && (
        <div className="space-y-2">
          <ErrorBanner message={error} />
          <Button variant="secondary" size="sm" onClick={reload}>Retry</Button>
        </div>
      )}

      {loading && !data ? (
        <Skeleton className="h-[560px] w-full" />
      ) : data && data.nodes.length === 0 ? (
        <EmptyState icon={Network} title="No services yet" description="Register services and record their dependencies to see the map." action={<Link href="/dashboard/services" className="font-semibold text-[#177a43] hover:underline">Go to services</Link>} />
      ) : data ? (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            <Pill tone="slate">{counts.services} services</Pill>
            <Pill tone="slate">{counts.deps} dependencies</Pill>
            <Pill tone={counts.failing ? 'red' : 'green'}>{counts.failing} failing</Pill>
            <Pill tone={counts.atRisk ? 'amber' : 'green'}>{counts.atRisk} at risk</Pill>
          </div>
          {visible.nodes.length === 0 ? (
            <EmptyState icon={Network} title="No services in this environment" description="Choose another environment to see its services." />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="relative overflow-hidden rounded-2xl border border-[#dfdbcc] bg-[#fbfaf6] shadow-[0_2px_0_#dfdbcc]">
                <div className="absolute right-3 top-3 z-10 flex flex-col gap-1 rounded-xl border border-[#dfdbcc] bg-white p-1 shadow">
                  <button type="button" onClick={() => zoom(1.2)} aria-label="Zoom in" className="rounded-lg p-1.5 text-[#3d4a42] hover:bg-[#eeebe0]"><Plus className="h-4 w-4" /></button>
                  <button type="button" onClick={() => zoom(1 / 1.2)} aria-label="Zoom out" className="rounded-lg p-1.5 text-[#3d4a42] hover:bg-[#eeebe0]"><Minus className="h-4 w-4" /></button>
                  <button type="button" onClick={fit} aria-label="Fit to screen" className="rounded-lg p-1.5 text-[#3d4a42] hover:bg-[#eeebe0]"><Maximize2 className="h-4 w-4" /></button>
                </div>
                {visible.edges.length === 0 && (
                  <div className="absolute left-3 top-3 z-10 max-w-[70%] rounded-lg border border-[#dfdbcc] bg-white px-3 py-2 text-xs text-[#3d4a42]">
                    No dependencies recorded yet. Add them from a service&apos;s page (Depends on → Add).
                  </div>
                )}
                <div ref={boxRef} className="h-[560px] w-full cursor-grab touch-none select-none active:cursor-grabbing" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
                  onClick={() => {
                    if (!movedRef.current) setSelected(null);
                  }}
                >
                  <svg width="100%" height="100%" role="img" aria-label="Service dependency graph">
                    <defs>
                      {([
                        ['arrow-base', 'var(--ink-3)'],
                        ['arrow-hi', '#177a43'],
                        ['arrow-up', '#7c3aed'],
                        ['arrow-dim', 'var(--rule)'],
                      ] as Array<[string, string]>).map(([mid, color]) => (
                        <marker key={mid} id={mid} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                          <path d="M0,0 L10,5 L0,10 z" fill={color} />
                        </marker>
                      ))}
                    </defs>
                    <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
                      {visible.edges.map((e) => {
                        const a = graph.placed.get(e.from);
                        const b = graph.placed.get(e.to);
                        if (!a || !b) return null;
                        const sx = a.x + NODE_W;
                        const sy = a.y + NODE_H / 2;
                        const tx = b.x;
                        const ty = b.y + NODE_H / 2;
                        const bend = Math.max(60, Math.abs(tx - sx) / 2);
                        const d = `M${sx},${sy} C${sx + bend},${sy} ${tx - bend},${ty} ${tx - 2},${ty}`;
                        let tone: 'base' | 'hi' | 'up' | 'dim' = 'base';
                        if (path && focusId !== null) {
                          const downEdge = (e.from === focusId || path.down.has(e.from)) && path.down.has(e.to);
                          const upEdge = (e.to === focusId || path.up.has(e.to)) && path.up.has(e.from);
                          tone = downEdge ? 'hi' : upEdge ? 'up' : 'dim';
                        }
                        const stroke = { base: 'var(--ink-3)', hi: '#177a43', up: '#7c3aed', dim: 'var(--rule)' }[tone];
                        return (
                          <path key={e.id} d={d} fill="none" stroke={stroke} strokeWidth={tone === 'hi' || tone === 'up' ? 2.4 : 1.4} strokeDasharray={e.kind === 'soft' ? '6 5' : undefined} markerEnd={`url(#arrow-${tone})`} opacity={tone === 'base' ? 0.75 : 1}>
                            <title>{`${a.name} depends on ${b.name} (${e.kind})`}</title>
                          </path>
                        );
                      })}
                      {[...graph.placed.values()].map((n) => {
                        const inPath = !path || n.id === focusId || path.down.has(n.id) || path.up.has(n.id);
                        const isSel = n.id === selected;
                        const color = HEALTH_COLOR[n.healthStatus] ?? HEALTH_COLOR.unknown;
                        return (
                          <g
                            key={n.id}
                            transform={`translate(${n.x},${n.y})`}
                            tabIndex={0}
                            role="button"
                            aria-label={`${n.name}, ${n.healthStatus}${n.atRisk ? ', at risk' : ''}`}
                            aria-pressed={isSel}
                            className="cursor-pointer outline-none"
                            opacity={inPath ? 1 : 0.35}
                            onMouseEnter={() => setHover(n.id)}
                            onMouseLeave={() => setHover(null)}
                            onFocus={() => setHover(n.id)}
                            onBlur={() => setHover(null)}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              if (!movedRef.current) setSelected(n.id);
                            }}
                            onKeyDown={(ev) => {
                              if (ev.key === 'Enter' || ev.key === ' ') {
                                ev.preventDefault();
                                setSelected(n.id);
                              }
                            }}
                          >
                            {n.atRisk && <rect x={-4} y={-4} width={NODE_W + 8} height={NODE_H + 8} rx={14} fill="none" stroke="#e3a008" strokeWidth={2} strokeDasharray="5 4" />}
                            <rect width={NODE_W} height={NODE_H} rx={11} fill="var(--card)" stroke={isSel ? '#177a43' : n.healthStatus === 'down' ? '#dc2626' : 'var(--rule)'} strokeWidth={isSel ? 2.5 : n.healthStatus === 'down' ? 1.8 : 1.2} />
                            <rect width={6} height={NODE_H} rx={3} fill={color} />
                            <circle cx={20} cy={19} r={5} fill={color} />
                            <text x={32} y={23} fontSize={13} fontWeight={700} fill="var(--ink)">{n.name.length > 20 ? `${n.name.slice(0, 19)}…` : n.name}</text>
                            <text x={16} y={42} fontSize={11} fill="var(--ink-3)">{`${n.serviceType} · ${n.environment}${n.criticality === 'critical' || n.criticality === 'high' ? ` · ${n.criticality}` : ''}`}</text>
                            {n.openIncidentId !== null && (
                              <g transform={`translate(${NODE_W - 34},8)`}>
                                <rect width={26} height={15} rx={7} fill="#dc2626" />
                                <text x={13} y={11} fontSize={9} fontWeight={800} fill="#ffffff" textAnchor="middle">INC</text>
                              </g>
                            )}
                            <title>{`${n.name} — ${n.healthStatus}${n.atRisk ? ' (at risk: depends on a failing service)' : ''}`}</title>
                          </g>
                        );
                      })}
                    </g>
                  </svg>
                </div>
                <Legend />
              </div>

              <aside className="rounded-2xl border border-[#dfdbcc] bg-white p-5 shadow-[0_2px_0_#dfdbcc]" aria-live="polite">
                {!sel ? (
                  <div className="text-sm text-[#5f6b64]">
                    <p className="font-display text-base font-bold text-[#14201a]">Select a service</p>
                    <p className="mt-1">Click a node to see its health, incidents and dependencies. Hover a node to trace what it depends on (green) and what depends on it (purple). Drag to pan; use the buttons to zoom.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate font-display text-lg font-bold text-[#14201a]">{sel.name}</h2>
                        <p className="text-xs capitalize text-[#5f6b64]">{sel.serviceType} · {sel.environment} · {sel.criticality} criticality</p>
                      </div>
                      <button type="button" onClick={() => setSelected(null)} aria-label="Close details" className="rounded-lg p-1 text-[#5f6b64] hover:bg-[#eeebe0]"><X className="h-4 w-4" /></button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <HealthBadge status={sel.healthStatus} />
                      {sel.atRisk && <Pill tone="amber"><AlertTriangle className="h-3 w-3" /> At risk</Pill>}
                    </div>
                    {sel.atRisk && <p className="text-xs text-[#92400e]">This service depends (directly or transitively) on a service that is down or degraded.</p>}
                    {sel.openIncidentId !== null ? (
                      <Link href={`/dashboard/incidents/${sel.openIncidentId}`} className="flex items-center justify-between rounded-xl border border-[#fecaca] bg-[#fee2e2] px-3 py-2 text-sm font-semibold text-[#991b1b] hover:opacity-90">
                        Open incident #{sel.openIncidentId} <ArrowRight className="h-4 w-4" />
                      </Link>
                    ) : (
                      <p className="text-xs text-[#5f6b64]">No open incident.</p>
                    )}
                    <RelBlock title="Depends on" ids={graph.deps.get(sel.id) ?? []} nameOf={nameOf} healthOf={(id) => graph.placed.get(id)?.healthStatus} onPick={setSelected} />
                    <RelBlock title="Used by" ids={graph.users.get(sel.id) ?? []} nameOf={nameOf} healthOf={(id) => graph.placed.get(id)?.healthStatus} onPick={setSelected} />
                    <Link href={`/dashboard/services/${sel.id}`} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#177a43] px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90">
                      Open service <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                )}
              </aside>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function RelBlock({ title, ids, nameOf, healthOf, onPick }: { title: string; ids: number[]; nameOf: (id: number) => string; healthOf: (id: number) => ServiceHealthStatus | undefined; onPick: (id: number) => void }) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[#5f6b64]">{title} ({ids.length})</h3>
      {ids.length === 0 ? (
        <p className="text-xs text-[#5f6b64]">None</p>
      ) : (
        <ul className="space-y-1">
          {ids.map((id) => (
            <li key={id}>
              <button type="button" onClick={() => onPick(id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm text-[#14201a] hover:bg-[#f6f4ec]">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: HEALTH_COLOR[healthOf(id) ?? 'unknown'] }} />
                <span className="truncate">{nameOf(id)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Legend() {
  const items: Array<[string, string]> = [
    ['Healthy', HEALTH_COLOR.healthy],
    ['Degraded', HEALTH_COLOR.degraded],
    ['Down', HEALTH_COLOR.down],
    ['Maintenance', HEALTH_COLOR.maintenance],
    ['Pending', HEALTH_COLOR.pending],
    ['Unknown', HEALTH_COLOR.unknown],
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#dfdbcc] bg-white px-4 py-2.5 text-[11px] text-[#3d4a42]">
      {items.map(([label, color]) => (
        <span key={label} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />{label}</span>
      ))}
      <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded border-2 border-dashed" style={{ borderColor: '#e3a008' }} />At risk</span>
      <span className="inline-flex items-center gap-1.5"><span className={cn('rounded px-1 text-[9px] font-extrabold text-white')} style={{ background: '#dc2626' }}>INC</span>Open incident</span>
      <span className="inline-flex items-center gap-1.5">
        <svg width="28" height="8" aria-hidden="true"><line x1="0" y1="4" x2="28" y2="4" stroke="var(--ink-3)" strokeWidth="1.6" /></svg>Hard
      </span>
      <span className="inline-flex items-center gap-1.5">
        <svg width="28" height="8" aria-hidden="true"><line x1="0" y1="4" x2="28" y2="4" stroke="var(--ink-3)" strokeWidth="1.6" strokeDasharray="5 4" /></svg>Soft
      </span>
      <span>Arrows point from a service to what it depends on.</span>
    </div>
  );
}
