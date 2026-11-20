import { useEffect, useRef, useState } from 'react';
import type { AppData } from '../types';
import { benefit, type PairResult } from '../stats/analyze';
import { evidence, fmt, fmtP, lagShort } from './format';


interface Props {
  data: AppData;
  pick: (habitId: string, outcomeId: string) => PairResult | undefined;
  onSelect: (h: string, o: string, lag: number) => void;
}

/**
 * Dumbbell chart: for each outcome, every habit is a row with an arrow from
 * "average on days without the habit" to "average on days with it".
 */
export default function ImpactBoard({ data, pick, onSelect }: Props) {
  const habits = data.habits.filter((h) => !h.archived);
  const outcomes = data.outcomes.filter((o) => !o.archived);
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e.contentRect.width) - 24)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const compact = width < 440;
  const W = width, left = compact ? 112 : 150, right = compact ? 52 : 70, rowH = 34, top = 26;
  const maxName = compact ? 11 : 14;
  const xOf = (v: number) => left + (v / 10) * (W - left - right);

  return (
    <div className="impact-grid" ref={ref}>
      {outcomes.map((o) => {
        const rows = habits
          .map((h) => ({ h, r: pick(h.id, o.id) }))
          .filter((x): x is { h: typeof x.h; r: PairResult } => !!x.r && x.r.status === 'ok' && isFinite(x.r.diff))
          .sort((a, b) => benefit(b.r, o.higherIsBetter) - benefit(a.r, o.higherIsBetter));
        const H = top + rows.length * rowH + 22;
        return (
          <div className="impact-card" key={o.id}>
            <div className="impact-title">
              <span>{o.name}</span>
              <span className="muted small">{o.higherIsBetter ? 'higher is better →' : '← lower is better'}</span>
            </div>
            {rows.length === 0 ? (
              <p className="muted small">Not enough variation yet.</p>
            ) : (
              <svg viewBox={`0 0 ${W} ${H}`} className="impact-svg">
                <defs>
                  <marker id="arrow-good" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                    <path d="M0 0L10 5L0 10z" className="mk-good" />
                  </marker>
                  <marker id="arrow-bad" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                    <path d="M0 0L10 5L0 10z" className="mk-bad" />
                  </marker>
                  <linearGradient id={`scale-${o.id}`} x1="0" x2="1">
                    <stop offset="0" stopColor={o.higherIsBetter ? 'rgb(var(--bad-rgb))' : 'rgb(var(--good-rgb))'} stopOpacity="0.16" />
                    <stop offset="1" stopColor={o.higherIsBetter ? 'rgb(var(--good-rgb))' : 'rgb(var(--bad-rgb))'} stopOpacity="0.16" />
                  </linearGradient>
                </defs>
                <rect x={xOf(0)} y={top - 14} width={xOf(10) - xOf(0)} height={H - top - 8} rx={6} fill={`url(#scale-${o.id})`} />
                {[0, 2, 4, 6, 8, 10].map((t) => (
                  <g key={t}>
                    <line x1={xOf(t)} x2={xOf(t)} y1={top - 14} y2={H - 22} className="gridline" />
                    <text x={xOf(t)} y={H - 8} textAnchor="middle" className="tick">{t}</text>
                  </g>
                ))}
                <text x={xOf(0)} y={12} className="tick">○ without habit</text>
                <text x={xOf(0) + (compact ? 80 : 110)} y={12} className="tick">● with habit</text>
                {rows.map(({ h, r }, i) => {
                  const cy = top + i * rowH + rowH / 2 - 6;
                  const good = benefit(r, o.higherIsBetter) > 0;
                  const ev = evidence(r);
                  const sig = ev === 'strong' || ev === 'likely';
                  const x0 = xOf(r.meanWithout), x1 = xOf(r.meanWith);
                  const tiny = Math.abs(x1 - x0) < 8;
                  return (
                    <g key={h.id} className={`impact-row ${sig ? 'sig' : 'dim'}`} onClick={() => onSelect(h.id, o.id, r.lag)}>
                      <rect x={0} y={cy - rowH / 2 + 2} width={W} height={rowH - 4} className="row-hit" rx={6} />
                      <circle cx={10} cy={cy} r={4.5} fill={h.color} />
                      <text x={20} y={cy + 4} className="impact-name">{h.name.length > maxName ? h.name.slice(0, maxName - 1) + '…' : h.name}</text>
                      {!compact && <text x={left - 8} y={cy + 4} textAnchor="end" className="tick">{r.lag === 0 ? '0d' : `+${r.lag}d`}</text>}
                      {!tiny && (
                        <line x1={x0} x2={x1 + (x1 > x0 ? -6 : 6)} y1={cy} y2={cy}
                          className={good ? 'arrow-good' : 'arrow-bad'} markerEnd={`url(#arrow-${good ? 'good' : 'bad'})`} />
                      )}
                      <circle cx={x0} cy={cy} r={5} className="dot-without" />
                      <circle cx={x1} cy={cy} r={5.5} fill={h.color} className="dot-with" />
                      <text x={W - right + 8} y={cy + 4} className={`impact-delta ${good ? 'good' : 'bad'}`}>
                        {r.diff > 0 ? '+' : '−'}{fmt(Math.abs(r.diff), 1)}{sig ? (ev === 'strong' ? (compact ? '★' : ' ★★') : (compact ? '' : ' ★')) : ''}
                      </text>
                      <title>{`${h.name}: ${fmt(r.meanWithout, 1)} → ${fmt(r.meanWith, 1)} (${lagShort(r.lag)}), q = ${fmtP(r.q)}, n = ${r.n}`}</title>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}
