import { useEffect, useMemo, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AppData } from '../types';
import { alignedSamples, LAGS, type PairResult } from '../stats/analyze';
import { rollingMean } from '../stats/correlation';
import { addDays, dateRange, fromISO } from '../dates';
import { evidence, evidenceLabel, fmt, fmtP, lagPhrase, lagShort } from './format';
import { IconX } from './Icons';

interface Props {
  data: AppData;
  results: PairResult[];
  habitId: string;
  outcomeId: string;
  initialLag: number;
  onClose: () => void;
}

export default function PairDetail({ data, results, habitId, outcomeId, initialLag, onClose }: Props) {
  const [lag, setLag] = useState(initialLag);
  const habit = data.habits.find((h) => h.id === habitId)!;
  const outcome = data.outcomes.find((o) => o.id === outcomeId)!;
  const byLag = LAGS.map((l) => results.find((r) => r.habitId === habitId && r.outcomeId === outcomeId && r.lag === l)!);
  const r = byLag[lag];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const series = useMemo(() => {
    const dates = Object.keys(data.entries).sort();
    if (!dates.length) return [];
    const all = dateRange(dates[0], dates[dates.length - 1]);
    const vals = all.map((d) => data.entries[d]?.outcomes[outcomeId] ?? null);
    const roll = rollingMean(vals, 7);
    return all.map((d, i) => {
      const src = data.entries[addDays(d, -lag)];
      return {
        date: d,
        label: fromISO(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        value: vals[i],
        rolling: roll[i] != null ? Math.round(roll[i]! * 100) / 100 : null,
        habit: src?.habits[habitId] ? 10 : 0,
      };
    });
  }, [data, outcomeId, habitId, lag]);

  const { x, y } = alignedSamples(data, habitId, outcomeId, lag);
  const ev = evidence(r);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <aside className="sheet" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <div>
            <div className="eyebrow"><span className="dot" style={{ background: habit.color }} /> {habit.name} → {outcome.name}</div>
            <h2>{ev === 'na' ? 'Not enough data' : `${outcome.name} ${r.diff < 0 ? 'drops' : 'rises'} ${fmt(Math.abs(r.diff), 1)} pts ${lagPhrase(lag)}`}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} title="Close (Esc)"><IconX /></button>
        </header>

        <div className="segmented full">
          {LAGS.map((l) => (
            <button key={l} className={lag === l ? 'on' : ''} onClick={() => setLag(l)}>{lagShort(l)}</button>
          ))}
        </div>

        <div className="kv-grid">
          <KV k="Correlation r" v={fmt(r.r)} />
          <KV k="95% CI" v={`[${fmt(r.ci[0])}, ${fmt(r.ci[1])}]`} />
          <KV k="p-value" v={fmtP(r.p)} />
          <KV k="q (FDR)" v={fmtP(r.q)} />
          <KV k="Cohen's d" v={fmt(r.d)} />
          <KV k="n days" v={`${r.n} (${r.nWith} with / ${r.nWithout} without)`} />
        </div>
        <div className={`evidence ev-${ev}`}>{evidenceLabel[ev]}</div>

        <h3 className="subhead">Effect by lag</h3>
        <LagProfile results={byLag} active={lag} onPick={setLag} higherIsBetter={outcome.higherIsBetter} />

        <h3 className="subhead">With vs. without</h3>
        <StripPlot x={x} y={y} color={habit.color} habitName={habit.name} />

        <h3 className="subhead">Timeline <span className="muted small">bars = {habit.name} {lag ? `${lag}d earlier` : 'that day'} · line = 7-day mean</span></h3>
        <div className="chart">
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={series} margin={{ top: 6, right: 6, left: -22, bottom: 0 }} barCategoryGap={0}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} interval="preserveStartEnd" minTickGap={30} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border-strong)', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number, name: string) => (name === 'habit' ? [v ? 'yes' : 'no', habit.name] : [v, name === 'value' ? outcome.name : '7-day mean'])}
              />
              <Bar dataKey="habit" fill={habit.color} fillOpacity={0.18} isAnimationActive={false} />
              <Line dataKey="value" stroke="var(--text-tertiary)" strokeWidth={1} dot={{ r: 1.5 }} connectNulls={false} isAnimationActive={false} />
              <Line dataKey="rolling" stroke="var(--accent)" strokeWidth={2.2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </aside>
    </div>
  );
}

const KV = ({ k, v }: { k: string; v: string }) => (
  <div className="kv"><span className="k">{k}</span><span className="v">{v}</span></div>
);

function LagProfile({ results, active, onPick, higherIsBetter }: { results: PairResult[]; active: number; onPick: (l: number) => void; higherIsBetter: boolean }) {
  const W = 320, H = 120, pad = 24, bw = (W - pad * 2) / results.length;
  const yOf = (v: number) => H / 2 - v * (H / 2 - 10);
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="lag-svg">
      <line x1={pad} x2={W - pad} y1={yOf(0)} y2={yOf(0)} className="axis" />
      {[-1, -0.5, 0.5, 1].map((t) => (
        <g key={t}><line x1={pad} x2={W - pad} y1={yOf(t)} y2={yOf(t)} className="gridline" /><text x={pad - 4} y={yOf(t) + 3} textAnchor="end" className="tick">{t}</text></g>
      ))}
      {results.map((r, i) => {
        const cx = pad + bw * i + bw / 2;
        if (!isFinite(r.r)) return <text key={i} x={cx} y={yOf(0) - 4} textAnchor="middle" className="tick">n/a</text>;
        const good = (higherIsBetter ? r.r : -r.r) > 0;
        const top = Math.min(yOf(0), yOf(r.r)), h = Math.abs(yOf(r.r) - yOf(0));
        return (
          <g key={i} onClick={() => onPick(r.lag)} style={{ cursor: 'pointer' }} opacity={r.lag === active ? 1 : 0.45}>
            <rect x={cx - bw * 0.28} y={top} width={bw * 0.56} height={Math.max(1, h)} rx={3} className={good ? 'bar-good' : 'bar-bad'} />
            <line x1={cx} x2={cx} y1={yOf(r.ci[0])} y2={yOf(r.ci[1])} className="whisker" />
            <line x1={cx - 5} x2={cx + 5} y1={yOf(r.ci[0])} y2={yOf(r.ci[0])} className="whisker" />
            <line x1={cx - 5} x2={cx + 5} y1={yOf(r.ci[1])} y2={yOf(r.ci[1])} className="whisker" />
            <text x={cx} y={H + 14} textAnchor="middle" className="tick">{lagShort(r.lag)}</text>
          </g>
        );
      })}
    </svg>
  );
}

function StripPlot({ x, y, color, habitName }: { x: number[]; y: number[]; color: string; habitName: string }) {
  const W = 320, H = 110, left = 96, right = 12;
  const xOf = (v: number) => left + (v / 10) * (W - left - right);
  const groups = [
    { label: `With`, vals: y.filter((_, i) => x[i] === 1), cy: 32, fill: color },
    { label: `Without`, vals: y.filter((_, i) => x[i] === 0), cy: 78, fill: 'var(--text-tertiary)' },
  ];
  // deterministic jitter
  const jit = (i: number) => (((i * 9301 + 49297) % 233280) / 233280 - 0.5) * 22;
  return (
    <svg viewBox={`0 0 ${W} ${H + 14}`} className="strip-svg" aria-label={`${habitName} with vs without`}>
      {[0, 2, 4, 6, 8, 10].map((t) => (
        <g key={t}><line x1={xOf(t)} x2={xOf(t)} y1={8} y2={H} className="gridline" /><text x={xOf(t)} y={H + 12} textAnchor="middle" className="tick">{t}</text></g>
      ))}
      {groups.map((g) => {
        const m = g.vals.length ? g.vals.reduce((a, b) => a + b, 0) / g.vals.length : NaN;
        return (
          <g key={g.label}>
            <text x={left - 10} y={g.cy + 4} textAnchor="end" className="strip-label">{g.label} <tspan className="tick">({g.vals.length})</tspan></text>
            {g.vals.map((v, i) => <circle key={i} cx={xOf(v) + jit(i) * 0.25} cy={g.cy + jit(i + 7)} r={3} fill={g.fill} fillOpacity={0.55} />)}
            {isFinite(m) && <line x1={xOf(m)} x2={xOf(m)} y1={g.cy - 16} y2={g.cy + 16} className="mean-line" />}
          </g>
        );
      })}
    </svg>
  );
}
